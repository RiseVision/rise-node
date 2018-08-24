import {
  IAppState,
  IBroadcasterLogic,
  IJobsQueue,
  ILogger,
  IPeersLogic,
  IPeersModule,
  ITransactionLogic,
  ITransactionsModule,
  Symbols
} from '@risevision/core-interfaces';
import { BroadcastTask, BroadcastTaskOptions, ConstantsType, IBaseTransaction, PeerType } from '@risevision/core-types';
import { inject, injectable, postConstruct } from 'inversify';
import * as _ from 'lodash';
import * as PromiseThrottle from 'promise-parallel-throttle';
import { P2pConfig, P2PConstantsType, p2pSymbols } from './helpers';

// tslint:disable interface-over-type-literal

export type BroadcastTaskOptions = {
  immediate?: boolean;
  data: any;
  api: string;
  method: string;
};
export type BroadcastTask = {
  options: BroadcastTaskOptions;
  params?: any
};

// tslint:enable interface-over-type-literal
@injectable()
export class BroadcasterLogic implements IBroadcasterLogic {
  public queue: BroadcastTask[] = [];
  // Generics
  @inject(Symbols.generic.appConfig)
  private config: P2pConfig;

  // Helpers
  @inject(p2pSymbols.constants)
  private p2pConstants: P2PConstantsType;

  @inject(Symbols.generic.constants)
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

  public cleanup() {
    this.jobsQueue.unregister('broadcasterNextRelease');
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
                         options: BroadcastTaskOptions): Promise<{ peer: PeerType[] }> {

    params.limit     = params.limit || this.constants.maxPeers;
    params.broadhash = params.broadhash || null;

    let peers = params.peers;
    if (!params.peers) {
      peers = await this.getPeers(params);
    }

    this.logger.debug('Begin broadcast');

    if (params.limit === this.constants.maxPeers) {
      peers = peers.slice(0, this.p2pConstants.broadcastLimit);
    }

    await PromiseThrottle.all(
      peers
        .map((p) => this.peersLogic.create(p))
        .map((peer) => () => {
            return peer.makeRequest(options.requestHandler)
              .catch((err) => {
                this.logger.debug(`Failed to broadcast to peer: ${peer.string}`, err);
                return null;
              });
          }
        ),
      { maxInProgress: this.p2pConstants.parallelLimit }
    );
    this.logger.debug('End broadcast');
    return { peer: peers };
  }

  /**
   * Count relays, eventually increment by one and return true if broadcast is exhausted
   */
  public maxRelays(): number {
    return this.p2pConstants.relayLimit;
  }

  /**
   * Filter the queue basd on the tasks included.
   * Will include the ones with the immediate flag and transactions which are in pool or in unconfirmed state
   */
  private async filterQueue(): Promise<void> {
    this.logger.debug(`Broadcast before filtering: ${this.queue.length}`);
    const newQueue = [];
    const oldQueue = this.queue.slice();
    this.queue = [];
    for (const task of oldQueue) {
      if (task.options.immediate) {
        newQueue.push(task);
      } else if (! await task.options.requestHandler.isRequestExpired()) {
        newQueue.push(task);
      }
    }

    this.queue.push(...newQueue);
    this.logger.debug(`Broadcasts after filtering: ${this.queue.length}`);
  }

  /**
   * Group broadcast requests by API.
   */
  private squashQueue(broadcasts: BroadcastTask[]): BroadcastTask[] {
    const byRequests = _.groupBy(broadcasts, ((b) => b.options.requestHandler.constructor.name));

    const squashed: BroadcastTask[] = [];

    for (const type in byRequests) {
      const requests = byRequests[type];
      const [first] = requests;
      first.options.requestHandler.mergeIntoThis(... requests.slice(1).map((item) => item.options.requestHandler));
      squashed.push({
        options: {
          immediate: false,
          requestHandler: first.options.requestHandler,
        },
      });
    }

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
    let broadcasts = this.queue.splice(0, this.config.broadcasts.releaseLimit);

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
