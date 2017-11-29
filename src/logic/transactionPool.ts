import { Bus, constants, ILogger, JobsQueue, promiseToCB, TransactionType } from '../helpers/';
import { AccountsModule, LoaderModule, TransactionsModule } from '../modules/';
import { AppConfig } from '../types/genericTypes';
import { TransactionLogic } from './transaction';
import { IBaseTransaction } from './transactions/';
// tslint:disable-next-line

export class InnerTXQueue<T = { receivedAt: Date }> {
  private transactions: Array<IBaseTransaction<any>> = [];
  private index: { [k: string]: number }             = {};
  private payload: { [k: string]: T }                = {};

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

  public get(txID: string): IBaseTransaction<any> {
    if (!this.has(txID)) {
      throw new Error(`Transaction not found in this queue ${txID}`);
    }
    return this.transactions[this.index[txID]];
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

  // tslint:disable-next-line
  public listWithPayload(reverse: boolean, limit?: number, filterFn?: (tx: IBaseTransaction<any>) => boolean): Array<{ tx: IBaseTransaction<any>, payload: T }> {
    const txs   = this.list(reverse, limit, filterFn);
    const toRet = [];
    for (const tx of txs) {
      toRet.push({ tx, payload: this.payload[tx.id] });
    }
    return toRet;
  }

}

export class TransactionPool {

  public unconfirmed    = new InnerTXQueue();
  public bundled        = new InnerTXQueue();
  public queued         = new InnerTXQueue();
  public multisignature = new InnerTXQueue();

  private library: {
    logger: ILogger,
    bus: Bus,
    logic: {
      transaction: TransactionLogic
    }
    config: AppConfig
  };
  private expiryInterval    = 30000;
  private bundledInterval: number;
  private bundleLimit: number;
  private processed: number = 0;
  // TODO: Describe these.
  private modules: { accounts: AccountsModule, transactions: TransactionsModule, loader: LoaderModule };

  constructor(transactionLogic: TransactionLogic,
              bus: Bus, logger: ILogger, config: AppConfig) {
    this.library = {
      bus,
      config,
      logger,
      logic : { transaction: transactionLogic },
    };

    this.bundledInterval = config.broadcasts.broadcastInterval;
    this.bundleLimit     = config.broadcasts.releaseLimit;
    JobsQueue.register(
      'transactionPoolNextBundle',
      (cb) => {
        return promiseToCB(this.processBundled(), cb);
      },
      this.bundledInterval
    );
    JobsQueue.register(
      'transactionPoolNextExpiry',
      (cb) => {
        this.expireTransactions();
        process.nextTick(cb);
      },
      this.expiryInterval
    );
  }

  public bind(accounts, transactions: TransactionsModule, loader) {
    this.modules = { accounts, transactions, loader };
  }

  /**
   * Queue a transaction or throws an error if it couldnt
   */
  public queueTransaction(tx: IBaseTransaction<any>, bundled: boolean): void {
    const payload = { receivedAt: new Date() };

    let queue: InnerTXQueue;
    if (bundled) {
      queue = this.bundled;
    } else if (tx.type === TransactionType.MULTI || Array.isArray(tx.signatures)) {
      queue = this.multisignature;
    } else {
      queue = this.queued;
    }

    if (queue.count >= this.library.config.transactions.maxTxsPerQueue) {
      throw new Error('Transaction pool is full');
    } else {
      queue.add(tx, payload);
    }
  }

  public fillPool(): Promise<void> {
    if (this.modules.loader.isSyncing) {
      return Promise.resolve();
    }

    const unconfirmedCount = this.unconfirmed.count;
    this.library.logger.debug(`Transaction pool size: ${unconfirmedCount}`);

    const spare = constants.maxTxsPerBlock - unconfirmedCount;
    if (spare <= 0) {
      return Promise.resolve();
    }

    const multignatures = this.multisignature.list(
      true,
      5,
      // tslint:disable-next-line
      (tx) => (tx as any)['ready']);

    const inQueue = this.queued.list(true, Math.max(0, spare - multignatures.length));

    const txs = multignatures.concat(inQueue);
    txs.forEach((tx) => this.unconfirmed.add(tx));

    return this.applyUnconfirmedList(txs);
  }

  public transactionInPool(txID: string) {
    return this.allQueues
      .map((queue) => queue.has(txID))
      .filter((isInQueue) => isInQueue)
      .length > 0;
  }

  /**
   * Gets unconfirmed, multisig and queued txs based on limit and reverse opts
   * FIXME Parameters are not taken into account!
   */
  public getMergedTransactionList(reverse: boolean, limit: number) {
    const minLimit = (constants.maxTxsPerBlock + 2);

    if (limit <= minLimit || limit > constants.maxSharedTxs) {
      limit = minLimit;
    }

    const unconfirmed = this.modules.transactions.getUnconfirmedTransactionList(false, constants.maxTxsPerBlock);
    limit -= unconfirmed.length;

    const multisignatures = this.multisignature.list(false, constants.maxTxsPerBlock, ((t) => (t as any).ready));
    limit -= multisignatures.length;

    const queued = this.modules.transactions.getQueuedTransactionList(false, limit);
    limit -= queued.length;

    return unconfirmed.concat(multisignatures).concat(queued);
  }

  public expireTransactions(): string[] {
    const unconfirmed    = this.unconfirmed.listWithPayload(true);
    const queued         = this.queued.listWithPayload(true);
    const multisignature = this.multisignature.listWithPayload(true);

    const all = unconfirmed.concat(queued).concat(multisignature);

    const ids: string[] = [];
    for (const txP of all) {
      const { tx, payload } = txP;
      if (!tx) {
        continue;
      }
      const now     = Math.floor(Date.now() / 1000);
      const timeOut = this.txTimeout(tx);
      const seconds = now - Math.floor(payload.receivedAt.getTime() / 1000);
      if (seconds > timeOut) {
        ids.push(tx.id);
        this.removeUnconfirmedTransaction(tx.id);
        this.library.logger.info(`Expired transaction: ${tx.id} received at: ${payload.receivedAt.toUTCString()}`);
      }
    }
    return ids;
  }

  /**
   * Picks bundled transactions, verifies them and then enqueue them
   */
  public async processBundled() {
    const bundledTxs = this.bundled.list(true, this.bundleLimit);
    for (const tx of bundledTxs) {
      if (!tx) {
        continue;
      }
      this.bundled.remove(tx.id);
      try {
        await this.processVerifyTransaction(
          tx,
          true
        );
        try {
          this.queueTransaction(tx, true);
        } catch (e) {
          this.library.logger.debug(`Failed to queue bundled transaction: ${tx.id}`, e);
        }
      } catch (e) {
        this.library.logger.debug(`Failed to process / verify bundled transaction: ${tx.id}`, e);
        this.unconfirmed.remove(tx.id);
      }
    }
  }

  /**
   * Cycles through the transactions and calls processNewTransaction.
   * It will fail at the first not valid tx
   * @param {Array<IBaseTransaction<any>>} txs
   * @param {boolean} broadcast
   * @param {boolean} bundled
   */
  public async receiveTransactions(txs: Array<IBaseTransaction<any>>,
                                   broadcast: boolean, bundled: boolean): Promise<void> {
    for (const tx of txs) {
      await this.processNewTransaction(tx, broadcast, bundled);
    }
  }

  /**
   * process a new incoming transaction. It may reject in case  the tx is not valid.
   */
  public async processNewTransaction(tx: IBaseTransaction<any>, broadcast: boolean, bundled: boolean): Promise<void> {
    if (this.transactionInPool(tx.id)) {
      return Promise.reject(`Transaction is already processed: ${tx.id}`);
    }
    this.processed++;
    if (this.processed > 1000) {
      // Reindex queues.
      this.reindexAllQueues();
      this.processed = 1; // TODO: Maybe one day use a different counter to keep stats clean
    }

    if (bundled) {
      return this.queueTransaction(tx, bundled);
    }

    await this.processVerifyTransaction(tx, broadcast);
    // IF i'm here it means verify went through and did not throw.
    // So lets enqueue the transaction!
    this.queueTransaction(tx, bundled);

  }

  /**
   * Calls processVerifyTransaction for each transaction and applies
   * unconfirmed transaction.
   */
  // tslint:disable-next-line
  public async applyUnconfirmedList(txs: Array<IBaseTransaction<any> | string> = this.unconfirmed.list(true)): Promise<void> {
    for (let theTx of txs) {
      if (!theTx) {
        continue; // move on the next item.
      }
      if (typeof(theTx) === 'string') {
        theTx = this.unconfirmed.get(theTx);
      }

      try {
        const sender = await this.processVerifyTransaction(
          theTx,
          false
        );
        try {
          await this.modules.transactions.applyUnconfirmed(
            theTx as any, // TODO: check me.
            sender);
        } catch (e) {
          this.library.logger.error(`Failed to apply unconfirmed transaction ${theTx.id}`, e);
          this.unconfirmed.remove(theTx.id);
        }
      } catch (e) {
        this.library.logger.error(`Failed to process / verify unconfirmed transaction: ${theTx.id}`, e);
        this.unconfirmed.remove(theTx.id);
      }
    }
  }

  public async undoUnconfirmedList(): Promise<string[]> {
    const ids: string[] = [];
    const txs           = this.unconfirmed.list(false);
    for (const tx of txs) {
      if (!tx) {
        continue;
      }
      ids.push(tx.id);
      await this.modules.transactions.undoUnconfirmed(tx)
        .catch((err) => {
          if (err) {
            this.library.logger.error(`Failed to undo unconfirmed transaction: ${tx.id}`, err);
            this.removeUnconfirmedTransaction(tx.id);
          }
        });
    }
    return ids;
  }

  /**
   * Calls reindex to each queue to clean memory
   */
  private reindexAllQueues() {
    this.allQueues
      .forEach((queue) => queue.reindex());
  }

  private get allQueues(): InnerTXQueue[] {
    return [this.unconfirmed, this.bundled, this.queued, this.multisignature];
  }

  private removeUnconfirmedTransaction(txID: string) {
    this.unconfirmed.remove(txID);
    this.queued.remove(txID);
    this.multisignature.remove(txID);
  }

  /**
   * Gets sender account verifies if its multisignature and evnetually gets requester
   * process transaaction and verifies it.
   */
  private async processVerifyTransaction(transaction: IBaseTransaction<any>, broadcast: any) {
    if (!transaction) {
      throw new Error('Missing transaction');
    }

    const sender = await this.modules.accounts.setAccountAndGet({ publicKey: transaction.senderPublicKey });

    const isMultisigAccount = Array.isArray(sender.multisignatures) && sender.multisignatures.length > 0;
    if (isMultisigAccount) {
      // TODO: fixme please
      (transaction as any).signatures = (transaction as any).signatures || [];
    }
    let requester = null;
    if (sender && transaction.requesterPublicKey && isMultisigAccount) {
      // Fetch the requester
      requester = await this.modules.accounts.getAccount({ publicKey: transaction.requesterPublicKey });
    }

    // Process the transaction!
    await this.library.logic.transaction.process(transaction, sender, requester);

    // Normalize tx.
    const normalizedTx = this.library.logic.transaction.objectNormalize(transaction);

    // Verify the transaction
    // TODO: check why here we've to cast to any
    await this.library.logic.transaction.verify(normalizedTx as any, sender, requester, null);

    await this.library.bus.message('unconfirmedTransaction', normalizedTx, broadcast);
    return sender;
  }

  /**
   * Returns a tx expiration timeout in seconds
   * @returns {number}
   */
  private txTimeout(tx: IBaseTransaction<any>): number {
    if (tx.type === TransactionType.MULTI) {
      return tx.asset.multisignature.lifetime * 3600;
    } else if (Array.isArray(tx.signatures)) {
      return constants.unconfirmedTransactionTimeOut * 8;
    } else {
      return constants.unconfirmedTransactionTimeOut;
    }
  }

}
