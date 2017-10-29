const emptyCB = () => void 0;

/**
 * Wraps a Promise to also propagate result to cback for backward compatibility
 * @param promise the promise
 * @param cb the callback
 */
export function promiseToCB<T>(promise: Promise<T>, cb: (err: Error, data?: T) => void = emptyCB): Promise<T> {
  return promise
    .then((res) => {
      setImmediate(cb, null, res);
      return Promise.resolve(res);
    })
    .catch((err) => {
      setImmediate(cb, err);
      return Promise.reject(err);
    });
}
