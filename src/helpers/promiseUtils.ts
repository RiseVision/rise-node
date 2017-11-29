import {ILogger} from './logger';

export type cback<T = void> = (err: Error, data?: T) => void;

export const emptyCB: cback<any> = () => void 0;

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

/**
 * Promisify a fn that returns a callback
 */
export function cbToPromise<T>(fn: (cb: cback<T>) => void, multi: true): Promise<T[]>;
export function cbToPromise<T>(fn: (cb: cback<T>) => void, multi?: false): Promise<T>;
export function cbToPromise<T>(fn: (cb: cback<T>) => void, multi = false): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((...args) => {
      if (args[0]) {
        return reject(args[0]);
      }
      args.splice(0, 1);
      if (multi) {
        return resolve(args as any);
      } else {
        return resolve(args[0]);
      }
    });
  });
}

export function cbToVoidPromise(fn: (cb: cback<any>) => void): Promise<void> {
  return cbToPromise(fn);
}

export function logCatchRewrite(logger: ILogger, errString: string): (err: Error) => Promise<any> {
  return (err: Error) => {
    logger.error(err.stack);
    return Promise.reject(new Error(errString));
  };
}

export function wait(msToWait: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, msToWait));
}
