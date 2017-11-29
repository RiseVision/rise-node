import * as ip from 'ip';
import * as _ from 'lodash';
import * as pgpCreator from 'pg-promise';
import { IDatabase, ITask } from 'pg-promise';
import * as shuffle from 'shuffle-array';
import * as z_schema from 'z-schema';
import peerSQL from '../../sql/peers';
import { Bus, cbToPromise, constants, ILogger, JobsQueue } from '../helpers/';
import { Peer, Peers, PeerState, PeerType } from '../logic/';
import schema from '../schema/peers';
import { AppConfig } from '../types/genericTypes';
import { SystemModule } from './system';
import { TransportModule } from './transport';

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
    peers: Peers;
  },
  config: AppConfig
};

// tslint:disable-next-line
export type PeerFilter = { limit?: number, offset?: number, orderBy?: string, ip?: string, port?: number, state?: PeerState };

export class PeersModule {
  public modules: { transport: TransportModule, system: SystemModule };

  constructor(public library: PeersLibrary) {
  }

  public onBind(scope: { transport: any, system: SystemModule }) {
    this.modules = {
      system   : scope.system,
      transport: scope.transport,
    };
  }

  /**
   * Filters peers with private ips or same nonce
   */
  public acceptable(peers: PeerType[]): PeerType[] {
    return _(peers)
      .uniqWith((a, b) => `${a.ip}${a.port}` === `${b.ip}${b.port}`)
      .filter((peer) => {
        if ((process.env.NODE_ENV || '').toUpperCase() === 'TEST') {
          return peer.nonce !== this.modules.system.getNonce() && (peer.os !== 'lisk-js-api');
        }
        return !ip.isPrivate(peer.ip) && peer.nonce !== this.modules.system.getNonce() && (peer.os !== 'lisk-js-api');
      })
      .value();
  }

  public cleanup() {
    // save on cleanup.
    return this.dbSave();
  }
  /**
   * Pings a peer
   */
  public async ping(peer: Peer) {
    this.library.logger.trace(`Pinging peer: ${peer.string}`);
    try {
      await this.modules.transport.getFromPeer(
        peer,
        {
          api   : '/height',
          method: 'GET',
        }
      );
    } catch (err) {
      this.library.logger.trace(`Ping peer failed: ${peer.string}`, err);
      throw err;
    }
  }

  /**
   * Sets peer state to active and updates it to the list
   */
  public update(peer: Peer) {
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
      return this.library.logic.peers.remove({ip: peerIP, port});
    }
  }

  /**
   * Discover peers by getting list and validates them
   */
  public async discover(): Promise<void> {
    this.library.logger.trace('Peer->discover');
    const response = await this.modules.transport.getFromRandomPeer<any>(
      {},
      {
        api   : '/list',
        method: 'GET',
      }
    );

    await cbToPromise((cb) => this.library.schema.validate(response.body, schema.discover.peers, cb));

    // Filter only acceptable peers.
    const acceptablePeers = this.acceptable(response.body.peers);

    let discovered = 0;
    let rejected   = 0;
    for (const rawPeer of acceptablePeers) {
      const peer: Peer = this.library.logic.peers.create(rawPeer);
      if (this.library.schema.validate(peer, schema.discover.peer)) {
        peer.state = PeerState.DISCONNECTED;
        this.library.logic.peers.upsert(peer, true);
        discovered++;
      } else {
        this.library.logger.warn(`Rejecting invalid peer: ${peer.string}`);
        rejected++;
      }
    }

    this.library.logger.trace(`Discovered ${discovered} peers - Rejected ${rejected}`);

  }

  /**
   * Gets the peers using the given filter.
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

    peersList = this.acceptable(peersList);

    const matchedBroadhash = peersList.length;

    if (options.limit > peersList.length) {
      let unmatchedBroadPeers = (await this.getByFilter({}))
      // only matching states
        .filter((p) => options.allowedStates.indexOf(p.state) !== -1)
        // but different broadhashes
        .filter((p) => options.broadhash !== p.broadhash);

      unmatchedBroadPeers = this.acceptable(unmatchedBroadPeers);
      peersList           = peersList.concat(unmatchedBroadPeers);
    }
    peersList = peersList.slice(0, options.limit);

    let consensus = Math.round(matchedBroadhash / peersList.length * 1e2 * 1e2) / 1e2;
    consensus     = isNaN(consensus) ? 0 : consensus;

    this.library.logger.debug(`Listing ${peersList.length} total peers`);
    return {consensus, peers: peersList};
  }

  public async onBlockchainReady() {
    await this.insertSeeds();
    await this.dbLoad();
    await this.discover();
    await this.library.bus.message('peersReady');
  }

  public async onPeersReady() {
    this.library.logger.trace('Peers ready');

    JobsQueue.register('peersDiscoveryAndUpdate', async (cb) => {
      try {
        await this.discover();
      } catch (err) {
        this.library.logger.error('Discovering new peers failed', err);
      }
      let updated = 0;

      const peers = this.library.logic.peers.list(false);
      this.library.logger.trace('Updating peers', {count: peers.length});

      for (const p of peers) {
        if (p && p.state !== PeerState.BANNED && (!p.updated || Date.now() - p.updated > 3000)) {
          this.library.logger.trace('Updating peer', p);
          try {
            await this.ping(p);
          } catch (err) {
            this.library.logger.debug(`Ping failed when updating peer ${p.string}`);
          } finally {
            updated++;
          }
        }
      }
    }, 5000);

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
   * TODO: remove ping as it's useless since it does not really update anything
   */
  private async dbLoad() {
    this.library.logger.trace('Importing peers from database');
    try {
      const rows  = await this.library.db.any(peerSQL.getAll);
      let updated = 0;
      for (const rawPeer of rows) {
        let peer = this.library.logic.peers.create(rawPeer);
        if (this.library.logic.peers.exists(peer)) {
          peer = this.library.logic.peers.get(peer);
          if (peer && peer.state !== PeerState.BANNED && Date.now() - peer.updated > 3000) {
            try {
              await this.ping(peer);
              updated++;
            } catch (err) {
              // who cares!
            }
          }
        } else {
          try {
            await this.ping(peer);
            updated++;
          } catch (err) {
            // who cares
          }
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
      await this.ping(peer);
      updated++;
    }));
    this.library.logger.info('Peers->insertSeeds - Peers discovered', {
      total: this.library.config.peers.list.length,
      updated,
    });
  }

}
