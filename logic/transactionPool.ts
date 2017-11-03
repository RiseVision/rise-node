import * as async from 'async';
import constants from '../helpers/constants';
import jobsQueue from '../helpers/jobsQueue';
import { cback } from '../helpers/promiseToCback';
import { ILogger } from '../logger';
import { IBus } from '../types/bus';
import { IBaseTransaction } from './transactions/baseTransaction';
import { TransactionType } from '../helpers/transactionTypes';
// tslint:disable-next-line
const config = require('../config.json');

class InnerTXQueue<T = { receivedAt: Date }> {
  private transactions: Array<IBaseTransaction<any>> = [];
  private index: { [k: string]: number };
  private payload: { [k: string]: T };

  constructor() {
  }

  public has(id: string) {
    return id in this.index;
  }

  public get count() {
    return Object.keys(this.index).length;
  }

  public remove(id: string) {
    if (this.has(id)) {
      const index = this.index[id];
      delete this.index[id];
      delete this.transactions[index];
      delete this.payload[id];
    }
  }

  public add(tx: IBaseTransaction<any>, payload?: T) {
    if (!this.has(tx.id)) {
      this.transactions.push(tx);
      this.index[tx.id]   = this.transactions.indexOf(tx);
      this.payload[tx.id] = payload;
    }
  }

  public reindex() {
    this.transactions = this.transactions
      .filter((tx) => typeof(tx) !== 'undefined');

    this.index = {};
    this.transactions.forEach((tx, idx) => this.index[tx.id] = idx);
  }

  public list(reverse: boolean, limit?: number,
              filterFn?: (tx: IBaseTransaction<any>) => boolean): Array<IBaseTransaction<any>> {
    let res = this.transactions
      .filter((tx) => typeof(tx) !== 'undefined');

    if (typeof(filterFn) === 'function') {
      res = res.filter(filterFn);
    }

    if (reverse) {
      res = res.reverse();
    }
    if (limit) {
      res.splice(limit);
    }
    return res;
  }

}

export class TransactionPool {
  private library: {
    logger: ILogger,
    bus: IBus,
    logic: {
      transaction: any
    }
    config: {
      broadcasts: {
        broadcastInterval: number,
        releaseLimit: number,
      }
    }
  };
  private unconfirmed       = new InnerTXQueue();
  private bundled           = new InnerTXQueue();
  private queued            = new InnerTXQueue();
  private multisignature    = new InnerTXQueue();
  private expiryInterval    = 30000;
  private bundledInterval: number;
  private bundleLimit: number;
  private processed: number = 0;
  // TODO: Describe these.
  private modules: { accounts: any, transactions: any, loader: any };

  constructor(broadcastInterval: number, releaseLimit: number, transactionLogic: any, bus: IBus, logger: ILogger) {
    this.library = {
      bus,
      config: {
        broadcasts: {broadcastInterval, releaseLimit},
      },
      logger,
      logic : {transaction: transactionLogic},
    };

    this.bundledInterval = broadcastInterval;
    this.bundleLimit     = releaseLimit;

    jobsQueue.register(
      'transactionPoolNextBundle',
      (cb) => {
      },
      this.bundledInterval
    );
    jobsQueue.register(
      'transactionPoolNextExpiry',
      () => {

      },
      this.expiryInterval
    );
  }

  public bind(accounts, transactions, loader) {
    this.modules = {accounts, transactions, loader};
  }

  /**
   * Queue a transaction or throws an error if it couldnt
   */
  public queueTransaction(tx: IBaseTransaction<any>, bundled: boolean): void {
    const payload = {receivedAt: new Date()};

    let queue: InnerTXQueue;
    if (bundled) {
      queue = this.bundled;
    } else if (tx.type === TransactionType.MULTI || Array.isArray(tx.signatures)) {
      queue = this.multisignature;
    } else {
      queue = this.queued;
    }

    if (queue.count >= config.transactions.maxTxsPerQueue) {
      throw new Error('Transaction pool is full');
    } else {
      queue.add(tx, payload);
    }
  }

  public fillPool(cb) {
    if (this.modules.loader.syncing()) {
      return setImmediate(cb);
    }

    const unconfirmedCount = this.unconfirmed.count;
    this.library.logger.debug(`Transaction pool size: ${unconfirmedCount}`);

    const spare = constants.maxTxsPerBlock - unconfirmedCount;
    if (spare <= 0) {
      return setImmediate(cb);
    }
    const multignatures = this.multisignature.list(
      true,
      5,
      // tslint:disable-next-line
      (tx) => (tx as any)['ready']);

    const inQueue = this.queued.list(true, Math.max(0, spare - multignatures.length))

    const txs = multignatures.concat(inQueue);
    txs.forEach((tx) => this.unconfirmed.add(tx));

  }

  /**
   * Calls processVerifyTransaction for each transaction and applies
   * unconfirmed transaction.
   */
  private applyUnconfirmedList(txs: Array<IBaseTransaction<any>>, cb: cback<void>) {
    async.eachSeries(txs, (tx, serieCB) => {
      const theTx: IBaseTransaction<any> = tx as any;
      if (!theTx) {
        return serieCB();
      }
      this.processVerifyTransaction(
        theTx,
        false,
        (err, sender) => {
          if (err) {
            this.library.logger.error(`Failed to process / verify unconfirmed transaction: ${theTx.id}`, err);
            this.unconfirmed.remove(theTx.id);
            return serieCB();
          }
          this.modules.transactions.applyUnconfirmed(
            theTx,
            sender,
            (err2) => {
              if (err2) {
                this.library.logger.error(`Failed to apply unconfirmed transaction ${theTx.id}`, err2);
                this.unconfirmed.remove(theTx.id);
              }
              return serieCB();
            }
          );
        }
      );
    });
  }

  private undoUnconfirmedList(cb: cback<void>) {
    const ids = [];
    async.eachSeries(
      this.unconfirmed.list(false),
      (tx, ecb) => {
        if (tx) {
          ids.push(tx.id);
          this.modules.transactions.undoUnconfirmed(tx, (err) => {
            if (err) {
              this.library.logger.error(``)
            }
          });
        }
      })
  }

  /**
   * Gets sender account verifies if its multisignature and evnetually gets requester
   * process transaaction and verifies it.
   */
  private processVerifyTransaction(transaction: IBaseTransaction<any>, broadcast: any, cb: cback<any>) {
    if (!transaction) {
      return setImmediate(cb, new Error('Missing transaction'));
    }
    async.waterfall([
        (wcb) => {
          this.modules.accounts.setAccountAndGet({publicKey: transaction.senderPublicKey}, wcb);
        },
        // Check if multisig
        (sender, wcb) => {
          const hasMultisignatures = Array.isArray(sender.multisignature) && sender.multisignature.length > 0;
          if (hasMultisignatures) {
            // TODO: Fixme
            (transaction as any).signatures = (transaction as any).signatures || [];
          }
          if (sender && transaction.requesterPublicKey && hasMultisignatures) {
            this.modules.accounts.getAccount({publicKey: transaction.requesterPublicKey}, (err, requester) => {
              if (!requester) {
                return wcb(new Error('Requester not found'));
              }
              return wcb(null, sender, requester);
            });
          } else {
            return wcb(null, sender, null);
          }
        },
        // Process transaction
        (sender, requester, wcb) => {
          this.library.logic.transaction.process(transaction, sender, requester, (err) => {
            if (err) {
              return wcb(err);
            }
            return wcb(null, sender);
          });
        },
        // Normalize transaction
        (sender, wcb) => {
          try {
            transaction = this.library.logic.transaction.objectNormalize(transaction);
            return wcb(null, sender);
          } catch (err) {
            return wcb(err);
          }
        },
        // Verify Transaction
        (sender, wcb) => {
          this.library.logic.transaction.verify(transaction, sender, null, (err) => {
            if (err) {
              return wcb(err);
            }
            return wcb(null, sender);
          });
        },
      ],
      (err: Error, sender: any) => {
        if (!err) {
          this.library.bus.message('unconfirmedTransaction', transaction, broadcast);
        }
        return cb(err, sender);
      }
    );
  }


}