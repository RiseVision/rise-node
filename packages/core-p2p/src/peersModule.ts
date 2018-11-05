import {
  IAppState,
  IBlocksModule,
  ILogger,
  IPeersModel,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import {
  AppConfig,
  ConstantsType,
  PeerState,
  PeerType,
} from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import * as ip from 'ip';
import * as _ from 'lodash';
import * as shuffle from 'shuffle-array';
import { p2pSymbols } from './helpers';
import { IPeersModule, PeerFilter } from './interfaces';
import { Peer } from './peer';
import { PeersLogic } from './peersLogic';

@injectable()
export class PeersModule implements IPeersModule {
  // Generic
  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;

  // Helpers
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  // Logic
  @inject(Symbols.logic.peers)
  private peersLogic: PeersLogic;
  @inject(Symbols.logic.appState)
  private appState: IAppState;

  // Modules
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  @inject(ModelSymbols.model)
  @named(p2pSymbols.model)
  private PeersModel: typeof IPeersModel;

  public cleanup() {
    // save on cleanup.
    return this.dbSave();
  }

  public async updateConsensus() {
    await this.getPeers({ limit: this.constants.maxPeers });
    return this.appState.get('node.consensus');
  }

  /**
   * Given a list of peers (with associated blockchain height), we find a list
   * of good peers (likely to sync with), then perform a histogram cut, removing
   * peers far from the most common observed height. This is not as easy as it
   * sounds, since the histogram has likely been made accross several blocks,
   * therefore need to aggregate).
   * Gets the list of good peers.
   */
  public findGoodPeers(
    peers: Peer[]
  ): {
    height: number;
    peers: Peer[];
  } {
    const lastBlockHeight: number = this.blocksModule.lastBlock.height;

    this.logger.trace('Good peers - received', { count: peers.length });

    // Removing unreachable peers or heights below last block height
    peers = peers.filter((p) => p !== null && p.height >= lastBlockHeight);

    this.logger.trace('Good peers - filtered', { count: peers.length });

    // No peers found
    if (peers.length === 0) {
      return { height: 0, peers: [] };
    } else {
      // Ordering the peers with descending height
      peers.sort((a, b) => b.height - a.height);

      const histogram = {};
      let max = 0;
      let height;

      // Aggregating height by 2.
      const aggregation = 2;

      // Histogram calculation, together with histogram maximum
      for (const peer of peers) {
        const val = Math.floor(peer.height / aggregation) * aggregation;
        histogram[val] = (histogram[val] ? histogram[val] : 0) + 1;

        if (histogram[val] > max) {
          max = histogram[val];
          height = val;
        }
      }

      // Performing histogram cut of peers too far from histogram maximum
      const peerObjs = peers.filter(
        (peer) => peer && Math.abs(height - peer.height) < aggregation + 1
      );

      this.logger.trace('Good peers - accepted', { count: peerObjs.length });
      this.logger.debug('Good peers', peerObjs.map((p) => p.string));

      return { height, peers: peerObjs };
    }
  }

  public async getPeers(params: {
    limit?: number;
    broadhash?: string;
  }): Promise<Peer[]> {
    params.limit = params.limit || this.constants.maxPeers;
    params.broadhash = params.broadhash || null;

    const originalLimit = params.limit;

    const peersList = await this.list(params);
    const peers = peersList.peers;
    const consensus = peersList.consensus;

    if (originalLimit === this.constants.maxPeers) {
      this.appState.set('node.consensus', consensus);
    }
    return peers;
  }
  /**
   * Sets peer state to active and updates it to the list
   */
  public update(peer: Peer) {
    peer.state = PeerState.CONNECTED;
    return this.peersLogic.upsert(peer, false);
  }

  /**
   * Remove a peer from the list if its not one from config files
   */
  public remove(peerIP: string, port: number): boolean {
    return this.peersLogic.remove({ ip: peerIP, port });
  }

  /**
   * Gets the peers using the given filter.
   * if orderBy Is not specified then returned peers are shuffled.
   */
  public async getByFilter(filter: PeerFilter): Promise<Peer[]> {
    const allowedFields = [
      'ip',
      'port',
      'state',
      'os',
      'version',
      'broadhash',
      'height',
      'nonce',
    ];
    const limit = filter.limit ? Math.abs(filter.limit) : 0;
    const offset = filter.offset ? Math.abs(filter.offset) : 0;
    const sortPeers = (field: string, asc: boolean) => (
      a: PeerType,
      b: PeerType
    ) =>
      a[field] === b[field]
        ? 0
        : a[field] === null
          ? 1
          : b[field] === null
            ? -1
            : // Ascending
              asc
              ? a[field] < b[field]
                ? -1
                : 1
              : // Descending
                a[field] < b[field]
                ? 1
                : -1;

    const peers = this.peersLogic.list(false).filter((peer) => {
      let passed = true;
      const filterKeys = Object.keys(filter);
      for (let i = 0; i < filterKeys.length && passed; i++) {
        const key = filterKeys[i];
        const value = filter[key];
        // Every filter field need to be in allowed fields, exists and match value
        if (
          _.includes(allowedFields, key) &&
          !(typeof peer[key] !== 'undefined' && peer[key] === value)
        ) {
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
      return peers.slice(offset, offset + limit);
    }
    return peers.slice(offset);
  }

  /**
   * Gets peers list and calculated consensus.
   */
  // tslint:disable-next-line max-line-length
  public async list(options: {
    limit?: number;
    broadhash?: string;
    allowedStates?: PeerState[];
  }): Promise<{ consensus: number; peers: Peer[] }> {
    options.limit = options.limit || this.constants.maxPeers;
    options.broadhash = options.broadhash || this.systemModule.broadhash;
    options.allowedStates = options.allowedStates || [PeerState.CONNECTED];

    let peersList = (await this.getByFilter({ broadhash: options.broadhash }))
      // only matching states
      .filter((p) => options.allowedStates.indexOf(p.state) !== -1);

    peersList = this.peersLogic.acceptable(peersList);
    peersList = peersList.slice(0, options.limit);

    const matchedBroadhash = peersList.length;

    if (options.limit > peersList.length) {
      let unmatchedBroadPeers = (await this.getByFilter({}))
        // only matching states
        .filter((p) => options.allowedStates.indexOf(p.state) !== -1)
        // but different broadhashes
        .filter((p) => options.broadhash !== p.broadhash);

      unmatchedBroadPeers = this.peersLogic.acceptable(unmatchedBroadPeers);
      peersList = peersList.concat(unmatchedBroadPeers);
      peersList = peersList.slice(0, options.limit);
    }

    let consensus =
      Math.round((matchedBroadhash / peersList.length) * 1e2 * 1e2) / 1e2;

    consensus = isNaN(consensus) ? 0 : consensus;

    this.logger.debug(`Listing ${peersList.length} total peers`);
    return { consensus, peers: peersList };
  }

  private async dbSave() {
    const peers = this.peersLogic.list(true);
    if (peers.length === 0) {
      this.logger.debug('Export peers to database failed: Peers list empty');
      return;
    }
    // Wrap sql queries in transaction and execute
    await this.PeersModel.sequelize
      .transaction(async (transaction) => {
        await this.PeersModel.truncate({ transaction });
        await this.PeersModel.bulkCreate(
          peers.map((p) => {
            if (p.broadhash) {
              return {
                ...p,
                ...{ broadhash: Buffer.from(p.broadhash, 'hex') },
              };
            }
            return p;
          }),
          { transaction }
        );
        this.logger.info('Peers exported to database');
      })
      .catch((err) => {
        this.logger.error('Export peers to database failed', {
          error: err.message || err,
        });
      });
  }
}
