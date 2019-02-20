import {
  IBaseTransaction,
  IInnerTXQueue,
  ListingOptions,
  QueueEntry,
} from '@risevision/core-types';

export class InnerTXQueue<T extends { receivedAt: Date } = { receivedAt: Date }>
  implements IInnerTXQueue<T> {
  private transactions: Array<IBaseTransaction<any, bigint>> = [];
  private index: { [k: string]: number } = {};
  private payload: { [k: string]: T } = {};

  constructor(public identifier: string) {}

  public has(id: string) {
    return id in this.index;
  }

  public get count() {
    return Object.keys(this.index).length;
  }

  public remove(id: string) {
    if (this.has(id)) {
      const index = this.index[id];
      delete this.index[id];
      this.transactions[index] = undefined;
      delete this.payload[id];
      return true;
    }
    return false;
  }

  public getPayload(tx: IBaseTransaction<any>): T {
    if (!this.has(tx.id)) {
      return undefined;
    }
    return this.payload[tx.id];
  }

  public add(tx: IBaseTransaction<any, bigint>, payload: T) {
    if (!this.has(tx.id)) {
      this.transactions.push(tx);
      this.index[tx.id] = this.transactions.indexOf(tx);
      this.payload[tx.id] = payload;
    }
  }

  public get(txID: string): QueueEntry<T> {
    if (!this.has(txID)) {
      throw new Error(`Transaction not found in this queue ${txID}`);
    }
    return {
      payload: this.payload[txID],
      tx: this.transactions[this.index[txID]],
    };
  }

  public reindex() {
    this.transactions = this.transactions.filter(
      (tx) => typeof tx !== 'undefined'
    );

    this.index = {};
    this.transactions.forEach((tx, idx) => (this.index[tx.id] = idx));
  }

  // tslint:disable-next-line
  public list(opts: ListingOptions<T> = {}): Array<QueueEntry<T>> {
    const { filterFn, reverse, limit, sortFn } = opts;
    if (limit === 0) {
      return [];
    }
    let res: Array<QueueEntry<T>> = this.transactions
      .filter((tx) => typeof tx !== 'undefined')
      .map((tx) => ({ tx, payload: this.payload[tx.id] }));

    if (typeof filterFn === 'function') {
      res = res.filter(filterFn);
    }

    if (sortFn) {
      res.sort(sortFn);
    }

    if (reverse) {
      res.reverse();
    }
    if (limit) {
      res.splice(limit);
    }
    return res;
  }

  public txList(
    opts: ListingOptions<T> = {}
  ): Array<IBaseTransaction<any, bigint>> {
    return this.list(opts).map((t) => t.tx);
  }
}
