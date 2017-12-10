import * as ip from 'ip';
import * as _ from 'lodash';
import * as pgpCreator from 'pg-promise';
import { IDatabase } from 'pg-promise';
import * as shuffle from 'shuffle-array';
import * as z_schema from 'z-schema';
import peerSQL from '../../sql/peers';
import { Bus, constants, ILogger } from '../helpers/';
import { IPeersModule, ISystemModule, ITransportModule } from '../ioc/interfaces/modules/';
import { PeerLogic, PeersLogic, PeerState, PeerType } from '../logic/';
import { AppConfig } from '../types/genericTypes';
import { SystemModule } from './system';

const pgp = pgpCreator();

// tslint:disable-next-line
export type PeersLibrary = {
  logger: ILogger,
  db: IDatabase<any>,
  schema: z_schema,
  bus: Bus,
  nonce: string;
  build: string;
  lastCommit: string;
  logic: {
    peers: PeersLogic;
  },
  config: AppConfig
};

// tslint:disable-next-line
export type PeerFilter = { limit?: number, offset?: number, orderBy?: string, ip?: string, port?: number, state?: PeerState };

export class PeersModule implements IPeersModule {
  public modules: { system: ISystemModule };

  constructor(public library: PeersLibrary) {
  }

  public onBind(scope: { system: SystemModule }) {
    this.modules = {
      system   : scope.system,
    };
  }

  public cleanup() {
    // save on cleanup.
    return this.dbSave();
  }

  /**
   * Sets peer state to active and updates it to the list
   */
  public update(peer: PeerLogic) {
    peer.state = PeerState.CONNECTED;
    return this.library.logic.peers.upsert(peer, false);
  }

  /**
   * Remove a peer from the list if its not one from config files
   */
  public remove(peerIP: string, port: number): boolean {
    const frozenPeer = _.find(this.library.config.peers.list, (p) => p.ip === peerIP && p.port === port);
    if (frozenPeer) {
      // FIXME: Keeping peer frozen is bad idea at all
      this.library.logger.debug('Cannot remove frozen peer', peerIP + ':' + port);
      return false;
    } else {
      return this.library.logic.peers.remove({ ip: peerIP, port });
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

    const peers = this.library.logic.peers.list(true)
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
    options.broadhash     = options.broadhash || this.modules.system.broadhash;
    options.allowedStates = options.allowedStates || [PeerState.CONNECTED];

    let peersList = (await this.getByFilter({}))
    // only matching states
      .filter((p) => options.allowedStates.indexOf(p.state) !== -1)
      // and only same broadhash
      .filter((p) => options.broadhash === p.broadhash);

    peersList = this.library.logic.peers.acceptable(peersList);

    const matchedBroadhash = peersList.length;

    if (options.limit > peersList.length) {
      let unmatchedBroadPeers = (await this.getByFilter({}))
      // only matching states
        .filter((p) => options.allowedStates.indexOf(p.state) !== -1)
        // but different broadhashes
        .filter((p) => options.broadhash !== p.broadhash);

      unmatchedBroadPeers = this.library.logic.peers.acceptable(unmatchedBroadPeers);
      peersList           = peersList.concat(unmatchedBroadPeers);
    }
    peersList = peersList.slice(0, options.limit);

    let consensus = Math.round(matchedBroadhash / peersList.length * 1e2 * 1e2) / 1e2;
    consensus     = isNaN(consensus) ? 0 : consensus;

    this.library.logger.debug(`Listing ${peersList.length} total peers`);
    return { consensus, peers: peersList };
  }

  public async onBlockchainReady() {
    await this.insertSeeds();
    await this.dbLoad();
    await this.library.bus.message('peersReady');
  }

  private async dbSave() {
    const peers = this.library.logic.peers.list(true);
    if (peers.length === 0) {
      this.library.logger.debug('Export peers to database failed: Peers list empty');
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
    ], {table: 'peers'});

    try {
      // Wrap sql queries in transaction and execute
      await this.library.db.tx((t) => {
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
      this.library.logger.info('Peers exported to database');
    } catch (err) {
      this.library.logger.error('Export peers to database failed', {error: err.message || err});
    }
  }

  /**
   * Loads peers from db and calls ping on any peer.
   */
  private async dbLoad() {
    this.library.logger.trace('Importing peers from database');
    try {
      const rows  = await this.library.db.any(peerSQL.getAll);
      let updated = 0;
      for (const rawPeer of rows) {
        const peer = this.library.logic.peers.create(rawPeer);
        if (!this.library.logic.peers.exists(peer)) {
          // Update also sets the peer as connected.
          this.update(peer);
          updated++;
        }
      }
      this.library.logger.trace('Peers->dbLoad Peers discovered', {updated, total: rows.length});
    } catch (e) {
      this.library.logger.error('Import peers from database failed', {error: e.message || e});
    }
  }

  /**
   * Returns peers length when using the provided filter
   */
  private async countByFilter(filter: PeerFilter): Promise<number> {
    const p = await this.getByFilter(filter);
    return p.length;
  }

  private async insertSeeds() {
    this.library.logger.trace('Peers->insertSeeds');
    let updated = 0;
    await Promise.all(this.library.config.peers.list.map(async (seed) => {
      const peer = this.library.logic.peers.create(seed);
      this.library.logger.trace(`Processing seed peer ${peer.string}`);
      // Sets the peer as connected. Seed can be offline but it will be removed later.
      this.update(peer);
      updated++;
    }));
    this.library.logger.info('Peers->insertSeeds - Peers discovered', {
      total: this.library.config.peers.list.length,
      updated,
    });
  }

}
