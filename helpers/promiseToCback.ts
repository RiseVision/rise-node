import {ILogger} from '../logger';

export const emptyCB = () => void 0;

export type cback<T = void> = (err: Error, data?: T) => void;

export function catchToLoggerAndRemapError<T>(rejectString: string, logger: ILogger): (err: Error) => Promise<T> {
  return (err: Error) => {
    logger.error(err.stack);
    return Promise.reject(rejectString);
  };
}

/**
 * Wraps a Promise to also propagate result to cback for backward compatibility
 * @param promise the promise
 * @param cb the callback
 */
export function promiseToCB<T>(promise: Promise<T>, cb: cback<T> = emptyCB): Promise<T> {
  return promise
    .then((res) => {
      cb(null, res);
      return Promise.resolve(res);
    })
    .catch((err) => {
      cb(err);
      return Promise.reject(err);
    });
}
