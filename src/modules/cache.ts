import { inject, injectable } from 'inversify';
import { RedisClient } from 'redis';
import { cbToPromise, cbToVoidPromise, ILogger, TransactionType } from '../helpers/';
import { ICacheModule } from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import { IBaseTransaction } from '../logic/transactions/';
import { AppConfig } from '../types/genericTypes';

@injectable()
export class Cache implements ICacheModule {
  private cacheReady: boolean;
  @inject(Symbols.generic.appConfig)
  private config: AppConfig;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.generic.redisClient)
  private redisClient: RedisClient;

  get isConnected() {
    return this.redisClient && this.redisClient.connected;
  }

  public assertConnected(): Promise<void> {
    if (!this.isConnected) {
      return Promise.reject('Cache unavailable');
    }
    return Promise.resolve();
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
      const res = await cbToPromise<any>((cb) => this.redisClient.scan(`${cursor}`, 'MATCH', pattern, cb));
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
   */
  public async onNewBlock() {
    await this.assertConnectedAndReady();
    const toRemove = ['/api/blocks*', '/api/transactions*'];
    for (const pattern of toRemove) {
      await this.removeByPattern(pattern);
    }
  }

  /**
   * This function will be triggered when a round finishes, it will clear all cache entires.
   */
  public async onFinishRound() {
    await this.assertConnectedAndReady();
    await this.removeByPattern('/api/delegates*');
  }

  /**
   * This function will be triggered when transactions are processed, it will clear all cache entires if there is a
   * delegate type transaction.
   * @param {Array} transactions
   */
  public async onTransactionsSaved(transactions: Array<IBaseTransaction<any>>) {
    await this.assertConnectedAndReady();
    if (!!transactions.find((tx) => tx.type === TransactionType.DELEGATE)) {
      await this.removeByPattern('/api/delegates*');
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

// tslint:disable-next-line
@injectable()
export class DummyCache implements ICacheModule {

  get isConnected(): any {
    throw new Error('Cache not enabled');
  }

  public assertConnected(): Promise<void> {
    return Promise.reject('Cache not enabled');
  }

  public assertConnectedAndReady(): Promise<void> {
    return Promise.reject('Cache not enabled');
  }

  public cleanup(): Promise<void> {
    return Promise.reject('Cache not enabled');
  }

  public deleteJsonForKey(k: string | string[]): Promise<void> {
    return Promise.reject('Cache not enabled');
  }

  public flushDb(): Promise<void> {
    return Promise.reject('Cache not enabled');
  }

  public getObjFromKey<T>(k: string): Promise<T> {
    return Promise.reject('Cache not enabled');
  }

  public quit(): Promise<void> {
    return Promise.reject('Cache not enabled');
  }

  public removeByPattern(pattern: string): Promise<void> {
    return Promise.reject('Cache not enabled');
  }

  public setObjFromKey<T>(k: string, value: any): Promise<void> {
    return Promise.reject('Cache not enabled');
  }

}
