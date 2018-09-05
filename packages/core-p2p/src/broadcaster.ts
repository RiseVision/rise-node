import {
  BroadcastParams, BroadcastTask, BroadcastTaskOptions, IAPIRequest,
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
import { AppConfig, ConstantsType, PeerType } from '@risevision/core-types';
import { inject, injectable, postConstruct } from 'inversify';
import * as _ from 'lodash';
import * as PromiseThrottle from 'promise-parallel-throttle';
import { P2PConstantsType, p2pSymbols } from './helpers';

@injectable()
export class BroadcasterLogic implements IBroadcasterLogic {
  public queue: BroadcastTask[] = [];
  // Generics
  @inject(Symbols.generic.appConfig)
  private config: AppConfig;

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

  // Modules
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;

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
    const consensus = peersList.consensus;

    if (originalLimit === this.constants.maxPeers) {
      this.appState.set('node.consensus', consensus);
    }
    return peers;
  }

  /**
   * Checks if object is entitled for being broadcasted. If so it will enqueue the object.
   * @param obj
   * @param requestHandler
   * @param params
   */
  public maybeEnqueue<T, K>(obj: any & { relays?: number }, requestHandler: IAPIRequest<T, K>, params?: BroadcastParams): boolean {
    obj.relays = (obj.relays || 0) + 1;
    if (obj.relays < this.maxRelays()) {
      this.enqueue(params, {
        immediate: false,
        requestHandler,
      });
      return true;
    }
    return false;
  }

  public enqueue(params: BroadcastParams, options: BroadcastTaskOptions): number {
    options.immediate = false;
    return this.queue.push({ params, options });
  }

  public async broadcast(params: BroadcastParams = {},
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
    this.queue     = [];
    for (const task of oldQueue) {
      if (task.options.immediate) {
        newQueue.push(task);
      } else if (!await task.options.requestHandler.isRequestExpired()) {
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
      const [first]  = requests;
      first.options.requestHandler.mergeIntoThis(... requests.slice(1).map((item) => item.options.requestHandler));
      squashed.push({
        options: {
          immediate     : false,
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
