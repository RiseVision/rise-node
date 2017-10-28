/**
 * Applies methods from parameters.
 */
export function callMethod<T extends string>(obj: { [k: string]: (...args: any[]) => void },
                                             method: string,
                                             args: any,
                                             cb: (err: Error | string) => void) {
  if (typeof obj[method] !== 'function') {
    return cb('Function not found in module: ' + method);
  }
  obj[method].apply(null, [args, cb]);
}
