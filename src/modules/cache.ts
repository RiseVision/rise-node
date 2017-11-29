import redis from 'redis';
import { cbToPromise, cbToVoidPromise, emptyCB, ILogger, TransactionType } from '../helpers/';
import { IBaseTransaction } from '../logic/transactions/';

export class Cache {
  private cacheReady: boolean;

  public constructor(library: { logger: ILogger }, public redisClient: redis.RedisClient,
                     public cacheEnabled: boolean) {

  }

  get isConnected() {
    return this.cacheEnabled && this.redisClient && this.redisClient.connected;
  }

  public assertConnected(): Promise<void> {
    if (!this.isConnected) {
      return Promise.reject('Cache unavailable');
    }
    Promise.resolve();
  }

  public async assertConnectedAndReady(): Promise<void> {
    if (!this.cacheReady) {
      return Promise.reject('Cache not ready');
    }
    return this.assertConnected();
  }

  public async getObjFromKey<T>(k: string): Promise<T> {
    await this.assertConnected();
    return cbToPromise<string>((cb) => this.redisClient.get(k, cb))
      .then((str) => JSON.parse(str));
  }

  public async setObjFromKey<T>(k: string, value: any): Promise<void> {
    await this.assertConnected();
    return cbToVoidPromise((cb) => this.redisClient.set(k, JSON.stringify(value), cb));
  }

  public async deleteJsonForKey(k: string | string[]): Promise<void> {
    await this.assertConnected();
    return cbToVoidPromise((cb) => this.redisClient.del(k, cb));
  }

  public async removeByPattern(pattern: string) {
    await this.assertConnected();
    let keys;
    let cursor = 0;
    do {
      const res = await cbToPromise<any>((cb) => this.redisClient.scan(`${cursor}`, 'MATCH', pattern, cb), true);
      cursor    = Number(res[0]);
      keys      = res[1];
      if (keys.length > 0) {
        await this.deleteJsonForKey(keys);
      }
    } while (cursor > 0);
  }

  public async flushDb() {
    await this.assertConnected();
    return cbToVoidPromise((cb) => this.redisClient.flushdb(cb));
  }

  public async cleanup() {
    if (this.isConnected) {
      return this.quit();
    }
  }

  public async quit() {
    await this.assertConnected();
    return cbToVoidPromise((cb) => this.redisClient.quit(cb));
  }

  /**
   * This function will be triggered on new block, it will clear all cache entires.
   * @param {Block} block
   * @param {Broadcast} broadcast
   * @param {Function} cb
   */
  public async onNewBlock(block, broadcast, cb) {
    cb = cb || emptyCB;

    try {
      await this.assertConnectedAndReady();
      const toRemove = ['/api/blocks*', '/api/transactions*'];
      for (const pattern of toRemove) {
        await this.removeByPattern(pattern);
      }
      cb();
    } catch (e) {
      cb(e);
    }

  }

  /**
   * This function will be triggered when a round finishes, it will clear all cache entires.
   * @param {Round} round
   * @param {Function} cb
   */
  public async onFinishRound(round, cb) {
    cb = cb || emptyCB;
    try {
      await this.assertConnectedAndReady();
      await this.removeByPattern('/api/delegates*');
      cb();
    } catch (e) {
      cb(e);
    }
  }

  /**
   * This function will be triggered when transactions are processed, it will clear all cache entires if there is a
   * delegate type transaction.
   * @param {Transactions[]} transactions
   * @param {Function} cb
   */
  public async onTransactionsSaved(transactions: Array<IBaseTransaction<any>>, cb) {
    cb = cb || emptyCB;
    try {
      await this.assertConnectedAndReady();
      if (!!transactions.find((tx) => tx.type === TransactionType.DELEGATE)) {
        await this.removeByPattern('/api/delegates*');
      }
      cb();
    } catch (e) {
      cb(e);
    }
  }

  /**
   * Disable any changes in cache while syncing
   */
  public onSyncStarted() {
    this.cacheReady = false;
  }

  /**
   * Enable changes in cache after syncing finished
   */
  public onSyncFinished() {
    this.cacheReady = true;
  }
}
