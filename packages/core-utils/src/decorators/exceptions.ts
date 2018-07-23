interface ExceptionsManager {
  handlersForKey(what: string): { canHandle: () => boolean, handle: () => any}
}
export function RunThroughExceptions(which: symbol) {
  return (target: { excManager: ExceptionsManager },
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
