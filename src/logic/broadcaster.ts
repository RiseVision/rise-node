import { inject, injectable, postConstruct } from 'inversify';
import * as _ from 'lodash';
import * as PromiseThrottle from 'promise-parallel-throttle';
import { IAPIRequest } from '../apis/requests/BaseRequest';
import { RequestFactoryType } from '../apis/requests/requestFactoryType';
import { requestSymbols } from '../apis/requests/requestSymbols';
import { PostSignaturesRequest, PostSignaturesRequestDataType } from '../apis/requests/PostSignaturesRequest';
import { PostTransactionsRequest, PostTransactionsRequestDataType } from '../apis/requests/PostTransactionsRequest';
import { constants, ILogger } from '../helpers/';
import { IJobsQueue } from '../ioc/interfaces/helpers';
import { IAppState, IBroadcasterLogic, IPeersLogic, ITransactionLogic } from '../ioc/interfaces/logic/';
import { IPeersModule, ITransactionsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { AppConfig } from '../types/genericTypes';
import { PeerType } from './peer';
import { IBaseTransaction } from './transactions/';

// tslint:disable interface-over-type-literal

export type BroadcastTaskOptions = {
  immediate?: boolean;
  requestHandler: IAPIRequest<any, any>;
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
  private config: AppConfig;

  // Helpers
  @inject(Symbols.helpers.constants)
  private constants: typeof constants;
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

  @inject(requestSymbols.postTransactions)
  private ptrFactory: RequestFactoryType<PostTransactionsRequestDataType, PostTransactionsRequest>;
  @inject(requestSymbols.postSignatures)
  private psrFactory: RequestFactoryType<PostSignaturesRequestDataType, PostSignaturesRequest>;

  @postConstruct()
  public afterConstruct() {
    if (this.config.forging.force) {
      this.appState.set('node.consensus', undefined);
    } else {
      this.appState.set('node.consensus', 100);
    }
    this.jobsQueue.register(
      'broadcasterNextRelease',
      () => this.releaseQueue()
        .catch((err) => {
          this.logger.log('Broadcast timer', err);
          return;
        }),
      this.config.broadcasts.broadcastInterval
    );

  }

  public async getPeers(params: { limit?: number, broadhash?: string }): Promise<PeerType[]> {
    params.limit     = params.limit || this.constants.maxPeers;
    params.broadhash = params.broadhash || null;

    const originalLimit = params.limit;

    const peersList = await this.peersModule.list(params);
    const peers     = peersList.peers;
    let consensus   = peersList.consensus;

    if (originalLimit === this.constants.maxPeers) {
      if (this.config.forging.force) {
        consensus = 100;
      }
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

    this.logger.debug('Begin broadcast', options);

    if (params.limit === this.constants.maxPeers) {
      peers = peers.slice(0, this.config.broadcasts.broadcastLimit);
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
      { maxInProgress: this.config.broadcasts.parallelLimit }
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

    if (Math.abs(object.relays) >= this.config.broadcasts.relayLimit) {
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
      } else if (task.options.requestHandler.getOrigOptions().data) {
        if (await this.filterTransaction(
            (task.options.requestHandler.getOrigOptions().data.transaction
              || task.options.requestHandler.getOrigOptions().data.signature))
        ) {
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
