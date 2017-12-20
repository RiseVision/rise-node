import { SignedBlockType } from '../../../logic';
import { IBaseTransaction, IConfirmedTransaction } from '../../../logic/transactions';
import { IModule } from './IModule';

export interface ITransactionsModule extends IModule {
  /**
   * Checks if txid is in pool
   */
  transactionInPool(id: string): boolean;

  /**
   * Get unconfirmed transaction from pool by id
   */
  getUnconfirmedTransaction<T = any>(id: string): IBaseTransaction<T>;

  /**
   * Get queued tx from pool by id
   */
  getQueuedTransaction<T = any>(id: string): IBaseTransaction<T>;

  /**
   * Get multisignature tx from pool by id
   */
  getMultisignatureTransaction<T = any>(id: string): IBaseTransaction<T>;

  /**
   * Gets unconfirmed transactions based on limit and reverse option.
   */
  getUnconfirmedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>>;

  /**
   * Gets queued transactions based on limit and reverse option.
   */
  getQueuedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>>;

  /**
   * Gets multisignature transactions based on limit and reverse option.
   */
  getMultisignatureTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>>;

  /**
   * Gets unconfirmed, multisignature and queued transactions based on limit and reverse option.
   */
  getMergedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>>;

  /**
   * Removes transaction from unconfirmed, queued and multisignature.
   */
  removeUnconfirmedTransaction(id: string): void;

  /**
   * Checks kind of unconfirmed transaction and process it, resets queue
   * if limit reached.
   */
  processUnconfirmedTransaction(transaction: IBaseTransaction<any>,
                                broadcast: boolean, bundled: boolean): Promise<void>;

  /**
   * Applies unconfirmed list to unconfirmed Ids.
   */
  applyUnconfirmedIds(ids: string[]): Promise<void>;

  /**
   * Applies unconfirmed list
   */
  applyUnconfirmedList(): Promise<void>;

  /**
   * Undoes unconfirmed list from queue.
   */
  undoUnconfirmedList(): Promise<string[]>;

  /**
   * Applies confirmed transaction.
   */
  apply(transaction: IConfirmedTransaction<any>, block: SignedBlockType, sender: any): Promise<void>;

  /**
   * Undoes confirmed transaction.
   */
  undo(transaction: IConfirmedTransaction<any>, block: SignedBlockType, sender: any): Promise<void>;

  /**
   * Gets requester if requesterPublicKey and calls applyUnconfirmed.
   */
  applyUnconfirmed(transaction: IBaseTransaction<any> & { blockId: string }, sender: any): Promise<void>;

  /**
   * Validates account and Undoes unconfirmed transaction.
   */
  undoUnconfirmed(transaction): Promise<void>;

  /**
   * Receives transactions
   */
  receiveTransactions(transactions: Array<IBaseTransaction<any>>,
                      broadcast: boolean, bundled: boolean): Promise<void>;

  count(): Promise<{ confirmed: number, multisignature: number, queued: number, unconfirmed: number }>;

  /**
   * Fills the pool.
   */
  fillPool(): Promise<void>;

  /**
   * Checks if `modules` is loaded.
   * @return {boolean} True if `modules` is loaded.
   */
  isLoaded(): boolean;

  list(filter): Promise<{ count: number, transactions: Array<IConfirmedTransaction<any>> }>;

  /**
   * Get transaction by id
   */
  getByID<T = any>(id: string): Promise<IConfirmedTransaction<T>>;

}
