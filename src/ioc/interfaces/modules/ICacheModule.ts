import { RedisClient } from 'redis';
import { IBaseTransaction } from '../../../logic/transactions';
import { IModule } from './IModule';

export interface ICacheModule extends IModule {
  readonly isConnected: boolean | RedisClient | boolean;

  assertConnected(): Promise<void>;

  assertConnectedAndReady(): Promise<void>;

  getObjFromKey<T>(k: string): Promise<T>;

  setObjFromKey<T>(k: string, value: any): Promise<void>;

  deleteJsonForKey(k: string | string[]): Promise<void>;

  removeByPattern(pattern: string): Promise<void>;

  flushDb(): Promise<void>;

  quit(): Promise<void>;

  /**
   * This function will be triggered on new block, it will clear all cache entires.
   * @param {Block} block
   * @param {Broadcast} broadcast
   * @param {Function} cb
   */
  onNewBlock(block, broadcast, cb): Promise<void>;

  /**
   * This function will be triggered when a round finishes, it will clear all cache entires.
   * @param {Round} round
   * @param {Function} cb
   */
  onFinishRound(round, cb): Promise<void>;

  /**
   * This function will be triggered when transactions are processed, it will clear all cache entires if there is a
   * delegate type transaction.
   * @param {Transactions[]} transactions
   * @param {Function} cb
   */
  onTransactionsSaved(transactions: Array<IBaseTransaction<any>>, cb): Promise<void>;

  /**
   * Disable any changes in cache while syncing
   */
  onSyncStarted(): void;

  /**
   * Enable changes in cache after syncing finished
   */
  onSyncFinished(): void;
}
