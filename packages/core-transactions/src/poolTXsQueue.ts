import { IBaseTransaction } from '@risevision/core-types';

export class InnerTXQueue<T = { receivedAt: Date }> {
  private transactions: Array<IBaseTransaction<any>> = [];
  private index: { [k: string]: number }             = {};
  private payload: { [k: string]: T }                = {};

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

  public add(tx: IBaseTransaction<any>, payload?: T) {
    if (!this.has(tx.id)) {
      this.transactions.push(tx);
      this.index[tx.id]   = this.transactions.indexOf(tx);
      this.payload[tx.id] = payload;
    }
  }

  public get(txID: string): IBaseTransaction<any> {
    if (!this.has(txID)) {
      throw new Error(`Transaction not found in this queue ${txID}`);
    }
    return this.transactions[this.index[txID]];
  }

  public reindex() {
    this.transactions = this.transactions
      .filter((tx) => typeof(tx) !== 'undefined');

    this.index = {};
    this.transactions.forEach((tx, idx) => this.index[tx.id] = idx);
  }

  public list(reverse: boolean, limit?: number,
              filterFn?: (tx: IBaseTransaction<any>, payload: T) => boolean): Array<IBaseTransaction<any>> {
    let res = this.transactions
      .filter((tx) => typeof(tx) !== 'undefined');

    if (typeof(filterFn) === 'function') {
      res = res.filter((tx) => filterFn(tx, this.payload[tx.id]));
    }

    if (reverse) {
      res.reverse();
    }
    if (limit) {
      res.splice(limit);
    }
    return res;
  }

  // tslint:disable-next-line
  public listWithPayload(reverse: boolean, limit?: number, filterFn?: (tx: IBaseTransaction<any>, payload: T) => boolean): Array<{ tx: IBaseTransaction<any>, payload: T }> {
    const txs   = this.list(reverse, limit, filterFn);
    const toRet = [];
    for (const tx of txs) {
      toRet.push({ tx, payload: this.payload[tx.id] });
    }
    return toRet;
  }

}
