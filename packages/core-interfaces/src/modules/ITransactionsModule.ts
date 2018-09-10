import { BasePeerType, IBaseTransaction, IConfirmedTransaction, ITransportTransaction } from '@risevision/core-types';
import { IAccountsModel, ITransactionsModel } from '../models';
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
   * Get pending tx from pool by id
   */
  getPendingTransaction<T = any>(id: string): IBaseTransaction<T>;

  /**
   * Gets unconfirmed transactions based on limit and reverse option.
   */
  getUnconfirmedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>>;

  /**
   * Gets queued transactions based on limit and reverse option.
   */
  getQueuedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>>;

  /**
   * Gets pending transactions based on limit and reverse option.
   */
  getPendingTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>>;

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
  applyUnconfirmed(transaction: IBaseTransaction<any> | IConfirmedTransaction<any>, sender: IAccountsModel): Promise<void>;

  /**
   * Validates account and Undoes unconfirmed transaction.
   */
  undoUnconfirmed(transaction: IBaseTransaction<any>): Promise<void>;

  count(): Promise<{ confirmed: number, pending: number, queued: number, unconfirmed: number }>;

  /**
   * Fills the pool.
   */
  fillPool(): Promise<void>;

  /**
   * Get transaction by id
   */
  getByID<T = any>(id: string): Promise<ITransactionsModel>;

  /**
   * Check transaction - perform transaction validation when processing block
   * If it does not throw the tx should be valid.
   * NOTE: this must be called with an unconfirmed transaction
   */
  checkTransaction(tx: IBaseTransaction<any>, accountsMap: { [address: string]: IAccountsModel }, height: number): Promise<void>;

  /**
   * Loops over the received transactions, Checks tx is ok by normalizing it and eventually remove peer if tx is not valid
   * Also checks tx is not already confirmed.
   * calls processUnconfirmedTransaction over it.
   * @returns {Promise<void>}
   */
  processIncomingTransactions(transactions: Array<IBaseTransaction<any>>,
                              peer: BasePeerType | null,
                              broadcast: boolean): Promise<void>;
}
