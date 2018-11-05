import { ExceptionsManager } from './exceptionManager';
// tslint:disable ban-types
export type FNProps<T> = ({
  [P in keyof T]: T[P] extends Function ? P : never
})[keyof T];

function createExceptionWrapper(
  excManager: ExceptionsManager,
  exception: symbol,
  oldFN: Function
) {
  return function rteWrapper(...args: any[]) {
    const handlers = excManager.handlersForKey(exception);
    for (const handler of handlers) {
      if (handler.canHandle(this, ...args)) {
        return handler.handle(this, ...args);
      }
    }
    return oldFN.apply(this, args);
  } as any;
}

export function setupExceptionOnType<T>(
  excManager: ExceptionsManager,
  obj: new () => T,
  method: FNProps<T>,
  exception: symbol
) {
  obj.prototype[method] = createExceptionWrapper(
    excManager,
    exception,
    obj.prototype[method]
  );
}

export function setupExceptionOnInstance<T>(
  excManager: ExceptionsManager,
  obj: T,
  method: FNProps<T>,
  exception: symbol
) {
  obj[method] = createExceptionWrapper(excManager, exception, obj[
    method
  ] as any);
}
