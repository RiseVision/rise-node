import { BasePeerType, IBaseTransaction, IConfirmedTransaction } from '@risevision/core-types';
import { IAccountsModel } from '../models';

export interface ITransactionsModule {
  /**
   * Checks if txid is in pool
   */
  transactionInPool(id: string): boolean;

  /**
   * filters the provided input ids returning only the ids that are
   * @param {string[]} ids transaction ids.
   * @return {Promise<string[]>} already existing ids
   */
  filterConfirmedIds(ids: string[]): Promise<string[]>;

  /**
   * Gets requester if requesterPublicKey and calls applyUnconfirmed.
   */
  applyUnconfirmed(transaction: IBaseTransaction<any> | IConfirmedTransaction<any>, sender: IAccountsModel): Promise<void>;

  /**
   * Validates account and Undoes unconfirmed transaction.
   */
  undoUnconfirmed(transaction: IBaseTransaction<any>): Promise<void>;

  count(): Promise<{ [k: string]: number }>;

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
                              peer: BasePeerType | null): Promise<void>;
}
