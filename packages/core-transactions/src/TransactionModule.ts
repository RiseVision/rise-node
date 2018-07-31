import {
  IAccountsModel,
  IAccountsModule,
  ILogger,
  ITransactionLogic,
  ITransactionPoolLogic,
  ITransactionsModel,
  ITransactionsModule,
  Symbols
} from '@risevision/core-interfaces';
import { DBHelper, ModelSymbols } from '@risevision/core-models';
import { ConstantsType, IBaseTransaction, SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';

@injectable()
export class TransactionsModule implements ITransactionsModule {
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;

  @inject(Symbols.helpers.db)
  private dbHelper: DBHelper;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.logic.txpool)
  private transactionPool: ITransactionPoolLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  @inject(ModelSymbols.model)
  @named(Symbols.models.transactions)
  private TXModel: typeof ITransactionsModel;

  public cleanup() {
    return Promise.resolve();
  }

  /**
   * Checks if txid is in pool
   */
  public transactionInPool(id: string): boolean {
    return this.transactionPool.transactionInPool(id);
  }

  public transactionUnconfirmed(id: string): boolean {
    return this.transactionPool.unconfirmed.has(id);
  }

  /**
   * filters the provided input ids returning only the ids that are
   * @param {string[]} ids transaction ids.
   * @return {Promise<string[]>} already existing ids
   */
  public async filterConfirmedIds(ids: string[]): Promise<string[]> {
    const idObjs = await this.TXModel.findAll({ attributes: ['id'], raw: true, where: { id: ids } });
    return idObjs.map((idObj) => idObj.id);
  }

  /**
   * Get unconfirmed transaction from pool by id
   */
  public getUnconfirmedTransaction<T = any>(id: string): IBaseTransaction<T> {
    return this.transactionPool.unconfirmed.get(id);
  }

  /**
   * Get queued tx from pool by id
   */
  public getQueuedTransaction<T = any>(id: string): IBaseTransaction<T> {
    return this.transactionPool.queued.get(id);
  }

  /**
   * Get pending tx from pool by id
   */
  public getPendingTransaction<T = any>(id: string): IBaseTransaction<T> {
    return this.transactionPool.pending.get(id);
  }

  /**
   * Gets unconfirmed transactions based on limit and reverse option.
   */
  public getUnconfirmedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return this.transactionPool.unconfirmed.list(reverse, limit);
  }

  /**
   * Gets queued transactions based on limit and reverse option.
   */
  public getQueuedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return this.transactionPool.queued.list(reverse, limit);
  }

  /**
   * Gets pending transactions based on limit and reverse option.
   */
  public getPendingTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return this.transactionPool.pending.list(reverse, limit);
  }

  /**
   * Gets unconfirmed, multisignature and queued transactions based on limit and reverse option.
   */
  public getMergedTransactionList(limit?: number): Array<IBaseTransaction<any>> {
    return this.transactionPool.getMergedTransactionList(limit);
  }

  /**
   * Removes transaction from unconfirmed, queued and multisignature.
   * @return true if the tx was in the unconfirmed queue.
   */
  public removeUnconfirmedTransaction(id: string) {
    const wasUnconfirmed = this.transactionPool.unconfirmed.remove(id);
    this.transactionPool.queued.remove(id);
    this.transactionPool.pending.remove(id);
    this.transactionPool.bundled.remove(id);
    return wasUnconfirmed;
  }

  /**
   * Checks kind of unconfirmed transaction and process it, resets queue
   * if limit reached.
   * NOTE: transaction must be unknown and already checked AGAINST database for its non existence.
   */
  public processUnconfirmedTransaction(transaction: IBaseTransaction<any>,
                                       broadcast: boolean): Promise<void> {
    return this.transactionPool.processNewTransaction(transaction);
  }

  /**
   * Gets requester if requesterPublicKey and calls applyUnconfirmed.
   */
  // tslint:disable-next-line max-line-length
  public async applyUnconfirmed(transaction: IBaseTransaction<any> & { blockId?: string }, sender: IAccountsModel): Promise<void> {
    // tslint:disable-next-line max-line-length
    this.logger.debug(`Applying unconfirmed transaction ${transaction.id} - AM: ${transaction.amount} - SB: ${(sender || { u_balance: undefined }).u_balance}`);

    if (!sender && transaction.blockId !== this.genesisBlock.id) {
      throw new Error('Invalid block id');
    } else {
      if (transaction.requesterPublicKey) {
        const requester = await this.accountsModule.getAccount({ publicKey: transaction.requesterPublicKey });
        if (!requester) {
          throw new Error('Requester not found');
        }

        await this.dbHelper.performOps(await this.transactionLogic.applyUnconfirmed(transaction, sender, requester));
      } else {
        await this.dbHelper.performOps(await this.transactionLogic.applyUnconfirmed(transaction, sender));
      }
    }
  }

  /**
   * Validates account and Undoes unconfirmed transaction.
   */
  public async undoUnconfirmed(transaction): Promise<void> {
    const sender = await this.accountsModule.getAccount({ publicKey: transaction.senderPublicKey });
    // tslint:disable-next-line max-line-length
    this.logger.debug(`Undoing unconfirmed transaction ${transaction.id} - AM: ${transaction.amount} - SB: ${sender.u_balance}`);
    await this.dbHelper.performOps(await this.transactionLogic.undoUnconfirmed(transaction, sender));
  }

  public async count(): Promise<{ confirmed: number, multisignature: number, queued: number, unconfirmed: number }> {
    return {
      confirmed     : await this.TXModel.count(),
      multisignature: this.transactionPool.pending.count,
      queued        : this.transactionPool.queued.count,
      unconfirmed   : this.transactionPool.unconfirmed.count,
    };
  }

  /**
   * Fills the pool.
   */
  public async fillPool(): Promise<void> {
    const newUnconfirmedTXs   = await this.transactionPool.fillPool();
    const ids                 = newUnconfirmedTXs.map((tx) => tx.id);
    const alreadyConfirmedIDs = await this.filterConfirmedIds(ids);
    for (const confirmedID of alreadyConfirmedIDs) {
      this.logger.debug(`TX ${confirmedID} was already confirmed but still in pool`);
      this.removeUnconfirmedTransaction(confirmedID);
      const idx = newUnconfirmedTXs.findIndex((a) => a.id === confirmedID);
      newUnconfirmedTXs.splice(idx, 1);
    }
    await this.transactionPool.applyUnconfirmedList(newUnconfirmedTXs, this);
  }

  /**
   * Get transaction by id
   */
  public async getByID<T = any>(id: string): Promise<ITransactionsModel> {
    const tx = await this.TXModel.findById(id);
    if (tx === null) {
      throw new Error('Transaction not found');
    }
    return tx;
  }

  /**
   * Check transaction - perform transaction validation when processing block
   * If it does not throw the tx should be valid.
   * NOTE: this must be called with an unconfirmed transaction
   */
  public async checkTransaction(tx: IBaseTransaction<any>, accountsMap: {[address: string]: IAccountsModel}, height: number): Promise<void> {
    const acc = accountsMap[tx.senderId];
    if (!acc) {
      throw new Error('Cannot find account from accounts');
    }
    let requester = null;
    if (tx.requesterPublicKey) {
      requester = accountsMap[this.accountsModule.generateAddressByPublicKey(tx.requesterPublicKey)];
      if (!requester) {
        throw new Error('Cannot find requester from accounts');
      }
    }
    // Verify will throw if any error occurs during validation.
    if (!this.transactionLogic.ready(tx, acc)) {
      throw new Error(`Transaction ${tx.id} is not ready`);
    }
    await this.transactionLogic.verify(tx, acc, requester, height);

  }

}
