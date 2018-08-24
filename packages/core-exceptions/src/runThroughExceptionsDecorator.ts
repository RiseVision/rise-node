export function RunThroughExceptions(which: symbol) {
  return (target: {
            excManager: {
              handlersForKey<T = any>(what: symbol): Array<{
                canHandle(obj: T, ...args: any[]): boolean;
                handle(obj: T, ...args: any[]);
              }>
            }
          },
          method: string,
          descriptor: TypedPropertyDescriptor<(...args: any[]) => any>) => {
    const oldValue   = descriptor.value;
    descriptor.value = function rteWrapper(...args: any[]) {
      const handlers = this.excManager.handlersForKey(which);
      for (const handler of handlers) {
        if (handler.canHandle(this, ...args)) {
          return handler.handle(this, ...args);
        }
      }
      return oldValue.apply(this, args);
    };
  };
}
