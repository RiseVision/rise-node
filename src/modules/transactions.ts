import { inject, injectable } from 'inversify';
import { constants as constantsType, DBHelper, ILogger } from '../helpers/';
import { ITransactionLogic, ITransactionPoolLogic } from '../ioc/interfaces/logic';
import { IAccountsModule, ITransactionsModule } from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import { SignedAndChainedBlockType, SignedBlockType } from '../logic/';
import { IBaseTransaction, IConfirmedTransaction } from '../logic/transactions/';
import { AccountsModel, BlocksModel, TransactionsModel } from '../models';

@injectable()
export class TransactionsModule implements ITransactionsModule {
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  @inject(Symbols.helpers.db)
  private dbHelper: DBHelper;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.logic.transactionPool)
  private transactionPool: ITransactionPoolLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  @inject(Symbols.models.transactions)
  private TXModel: typeof TransactionsModel;

  public cleanup() {
    return Promise.resolve();
  }

  /**
   * Checks if txid is in pool
   */
  public transactionInPool(id: string): boolean {
    return this.transactionPool.transactionInPool(id);
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
   * Get multisignature tx from pool by id
   */
  public getMultisignatureTransaction<T = any>(id: string): IBaseTransaction<T> {
    return this.transactionPool.multisignature.get(id);
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
   * Gets multisignature transactions based on limit and reverse option.
   */
  public getMultisignatureTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return this.transactionPool.multisignature.list(reverse, limit);
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
    this.transactionPool.multisignature.remove(id);
    return wasUnconfirmed;
  }

  /**
   * Checks kind of unconfirmed transaction and process it, resets queue
   * if limit reached.
   */
  public processUnconfirmedTransaction(transaction: IBaseTransaction<any>,
                                       broadcast: boolean, bundled: boolean): Promise<void> {
    return this.transactionPool.processNewTransaction(transaction, broadcast, bundled);
  }

  /**
   * Applies unconfirmed list to unconfirmed Ids.
   */
  public applyUnconfirmedIds(ids: string[]): Promise<void> {
    return this.transactionPool.applyUnconfirmedList(ids, this);
  }

  /**
   * Applies unconfirmed list
   */
  public applyUnconfirmedList(): Promise<void> {
    return this.transactionPool.applyUnconfirmedList(
      this.transactionPool.unconfirmed.list(true),
      this
    );
  }

  /**
   * Undoes unconfirmed list from queue.
   */
  public undoUnconfirmedList(): Promise<string[]> {
    return this.transactionPool.undoUnconfirmedList(this);
  }

  /**
   * Applies confirmed transaction.
   */
  public async apply(transaction: IConfirmedTransaction<any>,
                     block: SignedBlockType, sender: AccountsModel): Promise<void> {
    this.logger.debug('Applying confirmed transaction', transaction.id);
    await this.dbHelper.performOps(await this.transactionLogic.apply(transaction, block, sender));
  }

  /**
   * Undoes confirmed transaction.
   */
  public async undo(transaction: IConfirmedTransaction<any>,
                    block: BlocksModel, sender: AccountsModel): Promise<void> {
    this.logger.debug('Undoing confirmed transaction', transaction.id);
    await this.dbHelper.performOps(await this.transactionLogic.undo(transaction, block, sender));
  }

  /**
   * Gets requester if requesterPublicKey and calls applyUnconfirmed.
   */
  // tslint:disable-next-line max-line-length
  public async applyUnconfirmed(transaction: IBaseTransaction<any> & { blockId?: string }, sender: AccountsModel): Promise<void> {
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

  /**
   * Receives transactions
   */
  public receiveTransactions(transactions: Array<IBaseTransaction<any>>,
                             broadcast: boolean, bundled: boolean): Promise<void> {
    return this.transactionPool.receiveTransactions(
      transactions,
      broadcast,
      bundled
    );
  }

  public async count(): Promise<{ confirmed: number, multisignature: number, queued: number, unconfirmed: number }> {
    return {
      confirmed     : await this.TXModel.count(),
      multisignature: this.transactionPool.multisignature.count,
      queued        : this.transactionPool.queued.count,
      unconfirmed   : this.transactionPool.unconfirmed.count,
    };
  }

  /**
   * Fills the pool.
   */
  public async fillPool(): Promise<void> {
    const newUnconfirmedTXs = await this.transactionPool.fillPool();
    await this.transactionPool.applyUnconfirmedList(newUnconfirmedTXs, this);
  }

  /**
   * Checks if `modules` is loaded.
   * @return {boolean} True if `modules` is loaded.
   */
  public isLoaded() {
    return true;
  }

  /**
   * Get transaction by id
   */
  public async getByID<T = any>(id: string): Promise<TransactionsModel> {
    const tx = await TransactionsModel.findById(id) as any;
    if (tx === null) {
      throw new Error('Transaction not found');
    }
    return tx;
  }

}
