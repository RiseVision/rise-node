import { inject, injectable } from 'inversify';
import * as ip from 'ip';
import * as _ from 'lodash';
import * as pgpCreator from 'pg-promise';
import { IDatabase } from 'pg-promise';
import * as shuffle from 'shuffle-array';
import { Bus, constants, ILogger } from '../helpers/';
import { IPeerLogic, IPeersLogic } from '../ioc/interfaces/logic/';
import { IPeersModule } from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import { PeerState, PeerType } from '../logic/';
import peerSQL from '../sql/peers';
import { AppConfig } from '../types/genericTypes';

const pgp = pgpCreator();

// tslint:disable-next-line
export type PeerFilter = { limit?: number, offset?: number, orderBy?: string, ip?: string, port?: number, state?: PeerState };

@injectable()
export class PeersModule implements IPeersModule {
  @inject(Symbols.modules.system)
  private systemModule;

  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.bus)
  private bus: Bus;
  @inject(Symbols.logic.peers)
  private peersLogic: IPeersLogic;
  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;

  public cleanup() {
    // save on cleanup.
    return this.dbSave();
  }

  /**
   * Sets peer state to active and updates it to the list
   */
  public update(peer: IPeerLogic) {
    peer.state = PeerState.CONNECTED;
    return this.peersLogic.upsert(peer, false);
  }

  /**
   * Remove a peer from the list if its not one from config files
   */
  public remove(peerIP: string, port: number): boolean {
    const frozenPeer = _.find(this.appConfig.peers.list, (p) => p.ip === peerIP && p.port === port);
    if (frozenPeer) {
      // FIXME: Keeping peer frozen is bad idea at all
      this.logger.debug('Cannot remove frozen peer', peerIP + ':' + port);
      return false;
    } else {
      return this.peersLogic.remove({ ip: peerIP, port });
    }
  }

  /**
   * Gets the peers using the given filter.
   * if orderBy Is not specified then returned peers are shuffled.
   */
  public async getByFilter(filter: PeerFilter): Promise<PeerType[]> {
    const allowedFields = ['ip', 'port', 'state', 'os', 'version', 'broadhash', 'height', 'nonce'];
    const limit         = filter.limit ? Math.abs(filter.limit) : 0;
    const offset        = filter.offset ? Math.abs(filter.offset) : 0;
    const sortPeers     = (field: string, asc: boolean) => (a: PeerType, b: PeerType) => a[field] === b[field] ? 0 :
      a[field] === null ? 1 :
        b[field] === null ? -1 :
          // Ascending
          asc ? (a[field] < b[field] ? -1 : 1) :
            // Descending
            (a[field] < b[field] ? 1 : -1);

    const peers = this.peersLogic.list(true)
      .filter((peer) => {
        let passed       = true;
        const filterKeys = Object.keys(filter);
        for (let i = 0; i < filterKeys.length && passed; i++) {
          const key   = filterKeys[i];
          const value = filter[key];
          if (key === 'dappid' && (peer[key] === null || (Array.isArray(peer[key]) &&
              !_.includes(peer[key], String(value))))) {
            passed = false;
          }
          // Every filter field need to be in allowed fields, exists and match value
          if (_.includes(allowedFields, key) && !(peer[key] !== undefined && peer[key] === value)) {
            passed = false;
          }
        }
        return passed;
      });

    if (filter.orderBy) {
      const [field, method] = filter.orderBy.split(':');
      if (field && _.includes(allowedFields, field)) {
        peers.sort(sortPeers(field, method !== 'desc'));
      }
    } else {
      // By default shuffle the peers
      shuffle(peers);
    }

    if (limit) {
      return peers.slice(offset, (offset + limit));
    }
    return peers.slice(offset);
  }

  /**
   * Gets peers list and calculated consensus.
   */
  // tslint:disable-next-line max-line-length
  public async list(options: { limit?: number, broadhash?: string, allowedStates?: PeerState[] }): Promise<{ consensus: number, peers: PeerType[] }> {
    options.limit         = options.limit || constants.maxPeers;
    options.broadhash     = options.broadhash || this.systemModule.broadhash;
    options.allowedStates = options.allowedStates || [PeerState.CONNECTED];

    let peersList = (await this.getByFilter({}))
    // only matching states
      .filter((p) => options.allowedStates.indexOf(p.state) !== -1)
      // and only same broadhash
      .filter((p) => options.broadhash === p.broadhash);

    peersList = this.peersLogic.acceptable(peersList);

    const matchedBroadhash = peersList.length;

    if (options.limit > peersList.length) {
      let unmatchedBroadPeers = (await this.getByFilter({}))
      // only matching states
        .filter((p) => options.allowedStates.indexOf(p.state) !== -1)
        // but different broadhashes
        .filter((p) => options.broadhash !== p.broadhash);

      unmatchedBroadPeers = this.peersLogic.acceptable(unmatchedBroadPeers);
      peersList           = peersList.concat(unmatchedBroadPeers);
    }
    peersList = peersList.slice(0, options.limit);

    let consensus = Math.round(matchedBroadhash / peersList.length * 1e2 * 1e2) / 1e2;
    consensus     = isNaN(consensus) ? 0 : consensus;

    this.logger.debug(`Listing ${peersList.length} total peers`);
    return { consensus, peers: peersList };
  }

  public async onBlockchainReady() {
    await this.insertSeeds();
    await this.dbLoad();
    await this.bus.message('peersReady');
  }

  private async dbSave() {
    const peers = this.peersLogic.list(true);
    if (peers.length === 0) {
      this.logger.debug('Export peers to database failed: Peers list empty');
      return;
    }
    const cs = new pgp.helpers.ColumnSet([
      'ip', 'port', 'state', 'height', 'os', 'version', 'clock',
      {
        name: 'broadhash',
        init(col) {
          return col.value ? Buffer.from(col.value, 'hex') : null;
        },
      },
    ], { table: 'peers' });

    try {
      // Wrap sql queries in transaction and execute
      await this.db.tx((t) => {
        // Generating insert query
        const insertPeers = pgp.helpers.insert(peers, cs);

        const queries = [
          // Clear peers table
          t.none(peerSQL.clear),
          // Insert all peers
          t.none(insertPeers),
        ];

        // Inserting dapps peers
        _.each(peers, (peer) => {
          if (peer.dappid) {
            // If there are dapps on peer - push separately for every dapp
            _.each(peer.dappid, (dappid) => {
              const dappPeer  = peer;
              dappPeer.dappid = dappid;
              // TODO: unused dappPeer.
              queries.push(t.none(peerSQL.addDapp, peer));
            });
          }
        });

        return t.batch(queries);
      });
      this.logger.info('Peers exported to database');
    } catch (err) {
      this.logger.error('Export peers to database failed', { error: err.message || err });
    }
  }

  /**
   * Loads peers from db and calls ping on any peer.
   */
  private async dbLoad() {
    this.logger.trace('Importing peers from database');
    try {
      const rows  = await this.db.any(peerSQL.getAll);
      let updated = 0;
      await Promise.all(rows
        .map((rawPeer) => this.peersLogic.create(rawPeer))
        .filter((peer) => !this.peersLogic.exists(peer))
        .map(async (peer) => {
          await peer.pingAndUpdate();
          updated++;
        })
      );
      this.logger.trace('Peers->dbLoad Peers discovered', { updated, total: rows.length });
    } catch (e) {
      this.logger.error('Import peers from database failed', { error: e.message || e });
    }
  }

  private async insertSeeds() {
    this.logger.trace('Peers->insertSeeds');
    let updated = 0;
    await Promise.all(this.appConfig.peers.list.map(async (seed) => {
      const peer = this.peersLogic.create(seed);
      this.logger.trace(`Processing seed peer ${peer.string}`);
      // Sets the peer as connected. Seed can be offline but it will be removed later.
      await peer.pingAndUpdate();
      updated++;
    }));
    this.logger.info('Peers->insertSeeds - Peers discovered', {
      total: this.appConfig.peers.list.length,
      updated,
    });
  }

}
