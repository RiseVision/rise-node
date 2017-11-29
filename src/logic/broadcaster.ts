import * as extend from 'extend';
import * as _ from 'lodash';
import * as PromiseThrottle from 'promise-parallel-throttle';
import {constants, ILogger, JobsQueue, promiseToCB} from '../helpers/';
import {PeersModule, TransportModule} from '../modules/';
import {PeerType} from './peer';
import {Peers} from './peers';
import {TransactionLogic} from './transaction';
import {IBaseTransaction} from './transactions/';

// tslint:disable interface-over-type-literal
export type BroadcastsType = {
  broadcastInterval: number;
  broadcastLimit: number;
  parallelLimit: number;
  releaseLimit: number;
  relayLimit: number;
};

type BroadcastLibrary = {
  logger: ILogger,
  logic: {
    peers: Peers,
    transactions: TransactionLogic
  },
  config: {
    broadcasts: BroadcastsType,
    forging: {
      force: boolean
    }
  }
};

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

export class BroadcasterLogic {
  public queue: BroadcastTask[] = [];
  public config: {
    broadcasts: BroadcastsType,
    peerLimit: number
  };
  public consensus: number;
  // Broadcast routes
  public routes                 = [{
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

  public modules: { peers: PeersModule, transport: TransportModule, transactions: any };

  constructor(public library: BroadcastLibrary) {
    this.config = {
      broadcasts: library.config.broadcasts,
      peerLimit : constants.maxPeers,
    };

    if (this.library.config.forging.force) {
      this.consensus = undefined;
    } else {
      this.consensus = 100;
    }

    JobsQueue.register(
      'broadcasterNextRelease',
      (cb) => promiseToCB(this.releaseQueue()
          .catch((err) => {
            library.logger.log('Broadcast timer', err);
            return;
          }),
        cb),
      this.config.broadcasts.broadcastInterval
    );

  }

  public bind(peers: any, transport: any, transactions: any) {
    this.modules = { peers, transport, transactions };
  }

  public async getPeers(params: { limit?: number, broadhash?: string }): Promise<PeerType[]> {
    params.limit     = params.limit || this.config.peerLimit;
    params.broadhash = params.broadhash || null;

    const originalLimit = params.limit;

    const { peers, consensus } = await this.modules.peers.list(params);

    if (originalLimit === constants.maxPeers) {
      this.consensus = consensus;
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
                         },
                         options: any): Promise<{ peer: PeerType[] }> {

    params.limit     = params.limit || this.config.peerLimit;
    params.broadhash = params.broadhash || null;

    let peers = params.peers;
    if (!params.peers) {
      peers = await this.getPeers(params);
    }

    this.library.logger.debug('Begin broadcast', options);

    if (params.limit === this.config.peerLimit) {
      peers = peers.slice(0, this.config.broadcasts.broadcastLimit);
    }

    await PromiseThrottle.all(
      peers
        .map((p) => this.library.logic.peers.create(p))
        .map((peer) => () => this.modules.transport.getFromPeer(peer, options)
          .catch((err) => {
            this.library.logger.debug(`Failed to broadcast to peer: ${peer.string}`, err);
            return null;
          })
        ),
      { maxInProgress: this.config.broadcasts.parallelLimit }
    );
    this.library.logger.debug('End broadcast');
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
      this.library.logger.debug('Broadcast relays exhausted', object);
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
    this.library.logger.debug(`Broadcast before filtering: ${this.queue.length}`);
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
    this.library.logger.debug(`Broadcasts after filtering: ${this.queue.length}`);
  }

  /**
   * returns true if tx is in pool or is non confirmed.
   */
  private async filterTransaction(tx: IBaseTransaction<any>): Promise<boolean> {
    if (typeof(tx) !== 'undefined') {
      if (this.modules.transactions.transactionInPool(tx.id)) {
        return true;
      } else {
        try {
          this.library.logic.transactions.assertNonConfirmed(tx);
          return true;
        } catch (e) {
          // Tx is confirmed.
          return false;
        }
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
    this.library.logger.debug('Releasing enqueued broadcasts');
    if (this.queue.length === 0) {
      this.library.logger.debug('Queue empty');
      return;
    }

    await this.filterQueue();
    let broadcasts = this.queue.splice(0, this.config.broadcasts.releaseLimit);

    broadcasts  = this.squashQueue(broadcasts);
    const peers = this.getPeers({});

    try {
      for (const brc of broadcasts) {
        await this.broadcast(extend({}, { peers }, brc.params), brc.options);
      }
      this.library.logger.debug(`Broadcasts released ${broadcasts.length}`);
    } catch (e) {
      this.library.logger.debug('Failed to release broadcast queue', e);
    }

  }
}
