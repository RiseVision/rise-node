import { IBaseTransaction } from '../../types';

export type QueueType = 'queued' | 'pending' | 'ready' | 'unconfirmed';
// tslint:disable interface-name
export interface QueueEntry<T extends { receivedAt: Date }> {
  tx: IBaseTransaction<any, bigint>;
  payload: T;
}
export interface ListingOptions<T extends { receivedAt: Date }> {
  reverse?: boolean;
  limit?: number;
  filterFn?: (entry: QueueEntry<T>) => boolean;
  sortFn?: (a: QueueEntry<T>, b: QueueEntry<T>) => number;
}

export interface IInnerTXQueue<
  T extends { receivedAt: Date } = { receivedAt: Date }
> {
  readonly identifier: string;
  readonly count: number;

  has(id: string): boolean;

  remove(id: string): boolean;

  getPayload(tx: IBaseTransaction<any>): T;

  add(tx: IBaseTransaction<any>, payload?: T): void;

  get(txID: string): QueueEntry<T>;

  reindex(): void;

  list(opts?: ListingOptions<T>): Array<QueueEntry<T>>;

  txList(opts?: ListingOptions<T>): Array<QueueEntry<T>['tx']>;
}

export interface ITransactionPool {
  readonly queued: IInnerTXQueue;
  readonly ready: IInnerTXQueue;
  readonly pending: IInnerTXQueue<{ receivedAt: Date; ready: boolean }>;
  readonly unconfirmed: IInnerTXQueue;
  readonly allQueues: IInnerTXQueue[];

  transactionInPool(txID: string): boolean;

  removeFromPool(id: string): void;

  moveTx(txId: string, from: QueueType, to: QueueType): void;

  whatQueue(txID: string): IInnerTXQueue | null;
}
