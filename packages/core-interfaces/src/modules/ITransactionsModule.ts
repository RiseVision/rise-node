import { IBaseTransaction, IConfirmedTransaction } from '@risevision/core-types';
import { IModule } from './IModule';

export interface ITransactionsModule extends IModule {
  /**
   * Checks if txid is in pool
   */
  transactionInPool(id: string): boolean;

  /**
   * Checks if tx is in unconfirmed state.
   */
  transactionUnconfirmed(id: string): boolean;

  /**
   * filters the provided input ids returning only the ids that are
   * @param {string[]} ids transaction ids.
   * @return {Promise<string[]>} already existing ids
   */
  filterConfirmedIds(ids: string[]): Promise<string[]>;

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
  getMergedTransactionList(limit?: number): Array<IBaseTransaction<any>>;

  /**
   * Removes transaction from unconfirmed, queued and multisignature.
   */
  removeUnconfirmedTransaction(id: string): boolean;

  /**
   * Checks kind of unconfirmed transaction and process it, resets queue
   * if limit reached.
   */
  processUnconfirmedTransaction(transaction: IBaseTransaction<any>, broadcast: boolean): Promise<void>;

  /**
   * Gets requester if requesterPublicKey and calls applyUnconfirmed.
   */
  applyUnconfirmed(transaction: IBaseTransaction<any>|IConfirmedTransaction<any>, sender: AccountsModel): Promise<void>;

  /**
   * Validates account and Undoes unconfirmed transaction.
   */
  undoUnconfirmed(transaction: IBaseTransaction<any>): Promise<void>;

  count(): Promise<{ confirmed: number, multisignature: number, queued: number, unconfirmed: number }>;

  /**
   * Fills the pool.
   */
  fillPool(): Promise<void>;

  /**
   * Get transaction by id
   */
  getByID<T = any>(id: string): Promise<TransactionsModel>;

}
