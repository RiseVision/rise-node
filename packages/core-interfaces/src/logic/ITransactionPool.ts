import { IBaseTransaction } from '@risevision/core-types';
export type QueueType = 'queued' | 'pending' | 'ready' | 'unconfirmed';

export type QueueEntry<T extends { receivedAt: Date }> = {
  tx: IBaseTransaction<any>;
  payload: T
};
export type ListingOptions<T extends { receivedAt: Date }> = {
  reverse?: boolean,
  limit?: number,
  filterFn?: (entry: QueueEntry<T>) => boolean,
  sortFn?: (a: QueueEntry<T>, b: QueueEntry<T>) => number
};

export interface IInnerTXQueue<T extends { receivedAt: Date } = { receivedAt: Date }> {
  readonly identifier: string;

  getCount(): number;

  has(id: string): boolean;

  remove(id: string): boolean;

  getPayload(tx: IBaseTransaction<any>): T;

  add(tx: IBaseTransaction<any>, payload?: T): void;

  get(txID: string): QueueEntry<T>;

  reindex(): void;

  list(opts?: ListingOptions<T>): Array<QueueEntry<T>>;

  txList(opts?: ListingOptions<T>): Array<IBaseTransaction<any>>

}

export interface ITransactionPool {
  readonly queued: IInnerTXQueue;
  readonly ready: IInnerTXQueue;
  readonly pending: IInnerTXQueue<{ receivedAt: Date, ready: boolean }>;
  readonly unconfirmed: IInnerTXQueue;
  readonly allQueues: IInnerTXQueue[];

  transactionInPool(txID: string): boolean;

  removeFromPool(id: string): void;

  moveTx(txId: string, from: QueueType, to: QueueType): void;

  whatQueue(txID: string): IInnerTXQueue | null;
}
