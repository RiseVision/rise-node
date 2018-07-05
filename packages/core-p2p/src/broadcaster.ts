import { Symbols } from '@risevision/core-helpers';
import {
  IAppState,
  IBroadcasterLogic,
  IJobsQueue,
  ILogger,
  IPeersLogic,
  IPeersModule,
  ITransactionLogic,
  ITransactionsModule
} from '@risevision/core-interfaces';
import { BroadcastTask, BroadcastTaskOptions, ConstantsType, IBaseTransaction, PeerType } from '@risevision/core-types';
import { inject, injectable, postConstruct } from 'inversify';
import * as _ from 'lodash';
import * as PromiseThrottle from 'promise-parallel-throttle';
import { P2pConfig, P2PConstantsType, p2pSymbols } from './helpers';

@injectable()
export class BroadcasterLogic implements IBroadcasterLogic {
  public queue: BroadcastTask[] = [];

  // Broadcast routes
  public routes = [{
    collection: 'transactions',
    method    : 'POST',
    object    : 'transaction',
    path      : '/transactions',
  }, {
    collection: 'signatures',
    method    : 'POST',
    object    : 'signature',
    path      : '/signatures',
  }];

  // Generics
  @inject(Symbols.generic.appConfig)
  private config: P2pConfig;

  // Helpers
  @inject(p2pSymbols.constants)
  private p2pConstants: P2PConstantsType;

  @inject(Symbols.helpers.constants)
  private constants: ConstantsType;

  @inject(Symbols.helpers.jobsQueue)
  private jobsQueue: IJobsQueue;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  // Logic
  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.logic.peers)
  private peersLogic: IPeersLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  // Modules
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;

  @postConstruct()
  public afterConstruct() {
    this.jobsQueue.register(
      'broadcasterNextRelease',
      () => this.releaseQueue()
        .catch((err) => {
          this.logger.log('Broadcast timer', err);
          return;
        }),
      this.p2pConstants.broadcastInterval
    );
  }

  public async getPeers(params: { limit?: number, broadhash?: string }): Promise<PeerType[]> {
    params.limit     = params.limit || this.constants.maxPeers;
    params.broadhash = params.broadhash || null;

    const originalLimit = params.limit;

    const peersList = await this.peersModule.list(params);
    const peers     = peersList.peers;
    const consensus   = peersList.consensus;

    if (originalLimit === this.constants.maxPeers) {
      this.appState.set('node.consensus', consensus);
    }
    return peers;
  }

  public enqueue(params: any, options: BroadcastTaskOptions): number {
    options.immediate = false;
    return this.queue.push({ params, options });
  }

  public async broadcast(params: {
                           limit?: number, broadhash?: string,
                           peers?: PeerType[]
                         } = {},
                         options: any): Promise<{ peer: PeerType[] }> {

    params.limit     = params.limit || this.constants.maxPeers;
    params.broadhash = params.broadhash || null;

    let peers = params.peers;
    if (!params.peers) {
      peers = await this.getPeers(params);
    }

    this.logger.debug('Begin broadcast', options);

    if (params.limit === this.constants.maxPeers) {
      peers = peers.slice(0, this.p2pConstants.broadcastLimit);
    }

    await PromiseThrottle.all(
      peers
        .map((p) => this.peersLogic.create(p))
        .map((peer) => () => peer.makeRequest(options)
          .catch((err) => {
            this.logger.debug(`Failed to broadcast to peer: ${peer.string}`, err);
            return null;
          })
        ),
      { maxInProgress: this.p2pConstants.parallelLimit }
    );
    this.logger.debug('End broadcast');
    return { peer: peers };
  }

  /**
   * Count relays, eventually increment by one and return true if broadcast is exhausted
   */
  public maxRelays(object: { relays?: number }): boolean {
    if (!Number.isInteger(object.relays)) {
      object.relays = 0;
    }

    if (Math.abs(object.relays) >= this.p2pConstants.relayLimit) {
      this.logger.debug('Broadcast relays exhausted', object);
      return true;
    } else {
      object.relays++;
      return false;
    }
  }

  /**
   * Filter the queue basd on the tasks included.
   * Will include the ones with the immediate flag and transactions which are in pool or in unconfirmed state
   */
  private async filterQueue(): Promise<void> {
    this.logger.debug(`Broadcast before filtering: ${this.queue.length}`);
    const newQueue = [];
    for (const task of this.queue) {
      if (task.options.immediate) {
        newQueue.push(task);
      } else if (task.options.data) {
        if (await this.filterTransaction((task.options.data.transaction || task.options.data.signature))) {
          newQueue.push(task);
        }
      } else {
        newQueue.push(task);
      }
    }

    this.queue = newQueue;
    this.logger.debug(`Broadcasts after filtering: ${this.queue.length}`);
  }

  /**
   * returns true if tx is in pool or is non confirmed.
   */
  private async filterTransaction(tx: IBaseTransaction<any>): Promise<boolean> {
    if (typeof(tx) !== 'undefined') {
      if (this.transactionsModule.transactionInPool(tx.id)) {
        return true;
      } else {
        return (await this.transactionsModule.filterConfirmedIds([tx.id])).length === 0;
      }
    }
    return false;
  }

  /**
   * Group broadcast requests by API.
   */
  private squashQueue(broadcasts: BroadcastTask[]): BroadcastTask[] {
    const groupedByAPI = _.groupBy(broadcasts, (b) => b.options.api);

    const squashed: BroadcastTask[] = [];

    this.routes
    // Filter out empty grouped requests
      .filter((route) => Array.isArray(groupedByAPI[route.path]))
      .forEach((route) => {
        const data             = {};
        data[route.collection] = groupedByAPI[route.path]
          .map((b) => b.options.data[route.object])
          .filter((item) => !!item); // needs to be defined.
        squashed.push({
          options: {
            api      : route.path,
            data,
            immediate: false,
            method   : route.method,
          },
        });
      });

    return squashed;
  }

  /**
   * Release and broadcasts enqueued stuff
   */
  private async releaseQueue(): Promise<void> {
    this.logger.debug('Releasing enqueued broadcasts');
    if (this.queue.length === 0) {
      this.logger.debug('Queue empty');
      return;
    }

    await this.filterQueue();
    let broadcasts = this.queue.splice(0, this.p2pConstants.releaseLimit);

    broadcasts = this.squashQueue(broadcasts);

    try {
      for (const brc of broadcasts) {
        await this.broadcast(brc.params, brc.options);
      }
      this.logger.debug(`Broadcasts released ${broadcasts.length}`);
    } catch (e) {
      this.logger.warn('Failed to release broadcast queue', e);
    }

  }
}
