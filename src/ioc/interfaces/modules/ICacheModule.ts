import { RedisClient } from 'redis';
import { IModule } from './IModule';

/**
 * Methods signature for Cache
 */
export interface ICacheModule extends IModule {
  readonly isConnected: boolean | RedisClient | boolean;

  /**
   * Resolves if is connected, otherwise rejects
   */
  assertConnected(): Promise<void>;

  /**
   * Resolves if cache is ready and connected, otherwise rejects
   */
  assertConnectedAndReady(): Promise<void>;

  /**
   * Gets a value from a given key
   */
  getObjFromKey<T>(k: string): Promise<T>;

  /**
   * Stores a key/value pair
   */
  setObjFromKey<T>(k: string, value: any): Promise<void>;

  /**
   * Removes values from given keys
   */
  deleteJsonForKey(k: string | string[]): Promise<void>;

  /**
   * Removes values using a regular expression
   */
  removeByPattern(pattern: string): Promise<void>;

  /**
   * Delete all the keys
   */
  flushDb(): Promise<void>;

  /**
   * Close connection
   */
  quit(): Promise<void>;

}
