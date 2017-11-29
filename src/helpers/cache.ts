import redis from 'redis';
import { ILogger } from './logger';

/**
 * Connects with redis server using the config provided via parameters
 * @param {Boolean} cacheEnabled
 * @param {Object} config - Redis configuration
 * @param {Object} logger
 * @param {Function} cb
 */
export const connect = (cacheEnabled: boolean, config: redis.ClientOpts, logger: ILogger): Promise<{ client: redis.RedisClient, cacheEnabled: boolean }> => {
  return new Promise((resolve) => {
    let isRedisLoaded = false;

    if (!cacheEnabled) {
      return resolve({cacheEnabled, client: null});
    }

    // delete password key if it's value is null
    if (config.password === null) {
      delete config.password;
    }
    const client = redis.createClient(config);

    client.on('ready', () => {
      logger.info('App connected with redis server');

      if (!isRedisLoaded) {
        isRedisLoaded = true;
        return resolve({cacheEnabled, client});
      }
    });

    client.on('error', (err) => {
      logger.error('Redis:', err);
      // Only throw an error if cache was enabled in config but were unable to load it properly
      if (!isRedisLoaded) {
        isRedisLoaded = true;
        return resolve({cacheEnabled, client: null});
      }
    });
  });

};
