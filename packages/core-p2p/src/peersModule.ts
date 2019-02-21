import {
  IAppState,
  ILogger,
  IPeersModel,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { AppConfig, PeerState, PeerType } from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import * as ip from 'ip';
import * as _ from 'lodash';
import * as shuffle from 'shuffle-array';
import { P2PConstantsType, p2pSymbols } from './helpers';
import { IPeersModule, PeerFilter } from './interfaces';
import { Peer } from './peer';
import { PeersLogic } from './peersLogic';

@injectable()
export class PeersModule implements IPeersModule {
  // Generic
  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;

  // Helpers
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(p2pSymbols.constants)
  private p2pConstants: P2PConstantsType;
  // Logic
  @inject(Symbols.logic.peers)
  private peersLogic: PeersLogic;
  @inject(Symbols.logic.appState)
  private appState: IAppState;

  // Modules
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(ModelSymbols.model)
  @named(p2pSymbols.model)
  private PeersModel: typeof IPeersModel;

  public cleanup() {
    // save on cleanup.
    return this.dbSave();
  }

  public updateConsensus() {
    const { consensus } = this.determineConsensus(this.systemModule.broadhash);
    this.appState.set('node.consensus', consensus);
  }

  /**
   * Calculate consensus for given broadhash (defaults to current node broadhash).
   */
  public determineConsensus(
    broadhash: string
  ): {
    consensus: number;
    matchingPeers: number;
    totalPeers: number;
  } {
    let peersList = this.peersLogic
      .list(false)
      .filter((p) => p.state === PeerState.CONNECTED);
    peersList = this.peersLogic.acceptable(peersList);

    const totalPeers = peersList.length;
    const matchingPeers = peersList.filter((p) => p.broadhash === broadhash)
      .length;

    let consensus = Math.round((matchingPeers / totalPeers) * 1e2 * 1e2) / 1e2;
    consensus = isNaN(consensus) ? 0 : consensus;

    return {
      consensus,
      matchingPeers,
      totalPeers,
    };
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
    const lastBlockHeight: number = this.systemModule.getHeight();

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

  /**
   * Sets peer state to active and updates it to the list
   */
  public update(peer: Peer) {
    peer.state = PeerState.CONNECTED;
    const updated = this.peersLogic.upsert(peer, false);
    if (updated) {
      this.updateConsensus();
    }
    return updated;
  }

  /**
   * Remove a peer from the list
   */
  public remove(peerIP: string, port: number): boolean {
    const removed = this.peersLogic.remove({ ip: peerIP, port });
    if (removed) {
      this.updateConsensus();
    }
    return removed;
  }

  /**
   * Gets the peers using the given filter.
   * if orderBy Is not specified then returned peers are shuffled.
   */
  // tslint:disable-next-line cognitive-complexity
  public getByFilter(filter: PeerFilter): Peer[] {
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
   * Gets peers list
   */
  public getPeers(options: {
    limit?: number;
    broadhash?: string;
    allowedStates?: PeerState[];
  }): Peer[] {
    options.limit = options.limit || this.p2pConstants.maxPeers;
    options.broadhash = options.broadhash || this.systemModule.broadhash;
    options.allowedStates = options.allowedStates || [PeerState.CONNECTED];

    let peersList = this.getByFilter({ broadhash: options.broadhash })
      // only matching states
      .filter((p) => options.allowedStates.indexOf(p.state) !== -1);

    peersList = this.peersLogic.acceptable(peersList);
    peersList = peersList.slice(0, options.limit);

    if (options.limit > peersList.length) {
      let unmatchedBroadPeers = this.getByFilter({})
        // only matching states
        .filter((p) => options.allowedStates.indexOf(p.state) !== -1)
        // but different broadhashes
        .filter((p) => options.broadhash !== p.broadhash);

      unmatchedBroadPeers = this.peersLogic.acceptable(unmatchedBroadPeers);
      peersList = peersList.concat(unmatchedBroadPeers);
      peersList = peersList.slice(0, options.limit);
    }

    this.logger.debug(`Listing ${peersList.length} total peers`);
    return peersList;
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
        await this.PeersModel.bulkCreate(peers, { transaction });
        this.logger.info('Peers exported to database');
      })
      .catch((err) => {
        this.logger.error('Export peers to database failed', {
          error: err.message || err,
        });
      });
  }
}
