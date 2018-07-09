import { IBaseTransaction } from '@risevision/core-types';
import { ITransactionsModule } from '../modules';

export interface IInnerTXQueue<T = { receivedAt: Date }> {

  readonly count: number;

  has(id: string): boolean;

  remove(id: string): boolean;

  getPayload(tx: IBaseTransaction<any>): T;

  add(tx: IBaseTransaction<any>, payload?: T): void;

  get(txID: string): IBaseTransaction<any>;

  reindex(): void;

  list(reverse: boolean, limit?: number,
       filterFn?: (tx: IBaseTransaction<any>, payload: T) => boolean): Array<IBaseTransaction<any>>;

  // tslint:disable-next-line
  listWithPayload(reverse: boolean, limit?: number, filterFn?: (tx: IBaseTransaction<any>, payload: T) => boolean): Array<{ tx: IBaseTransaction<any>, payload: T }>

}

export interface ITransactionPoolLogic {
  readonly unconfirmed: IInnerTXQueue;
  readonly bundled: IInnerTXQueue;
  readonly queued: IInnerTXQueue;
  readonly pending: IInnerTXQueue<{ receivedAt: Date, ready: boolean }>;

  fillPool(): Promise<Array<IBaseTransaction<any>>>;

  transactionInPool(txID: string): boolean;

  /**
   * Gets unconfirmed, multisig and queued txs based on limit and reverse opts
   */
  getMergedTransactionList(limit: number): Array<IBaseTransaction<any>>;

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
