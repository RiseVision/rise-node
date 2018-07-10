import { InnerTXQueue } from '../../../logic';
import { IBaseTransaction } from '../../../logic/transactions';
import { ITransactionsModule } from '../modules';

/**
 * Methods signature for TransactionPool
 */
export interface ITransactionPoolLogic {
  readonly unconfirmed: InnerTXQueue;
  readonly bundled: InnerTXQueue;
  readonly queued: InnerTXQueue;
  readonly multisignature: InnerTXQueue<{ receivedAt: Date, ready: boolean }>;

  /**
   * Queue a transaction or throws an error if it couldnt
   */
  queueTransaction(tx: IBaseTransaction<any>, bundled: boolean): void;

  /**
   * Fills the pools
   */
  fillPool(): Promise<Array<IBaseTransaction<any>>>;

  /**
   * Checks if txID is in pool
   */
  transactionInPool(txID: string): boolean;

  /**
   * Gets unconfirmed, multisig and queued txs based on limit and reverse opts
   */
  getMergedTransactionList(limit: number): Array<IBaseTransaction<any>>;

  /**
   * Returns a list of expired transactions
   */
  expireTransactions(): string[];

  /**
   * Picks bundled transactions, verifies them and then enqueue them
   */
  processBundled(): Promise<void>;

  /**
   * process a new incoming transaction. It may reject in case  the tx is not valid.
   */
  processNewTransaction(tx: IBaseTransaction<any>, broadcast: boolean): Promise<void>;

  /**
   * Calls processVerifyTransaction for each transaction and applies
   * unconfirmed transaction.
   */
  // tslint:disable-next-line
  applyUnconfirmedList(txs: Array<IBaseTransaction<any> | string>, txModule: ITransactionsModule): Promise<void>;

}
