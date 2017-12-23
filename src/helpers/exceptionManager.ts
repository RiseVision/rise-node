import { injectable } from 'inversify';

export const ExceptionsList = {
  assertValidSlot: Symbol('assertValidSlot'),
  checkBalance: Symbol('checkBalance'),
  voteTx_checkConfirmedDelegate: Symbol('voteTx_checkConfirmedDelegate'),
  voteTx_checkUnConfirmedDelegate: Symbol('voteTx_checkUnConfirmedDelegate'),
};

export interface IExceptionHandler<K> {
  canHandle(obj: K, ...args: any[]): boolean;

  handle(obj: K, ...args: any[]);
}

@injectable()
export class ExceptionsManager {
  private handlers: { [k: string]: { [h: string]: IExceptionHandler<any> } } = {};

  public registerExceptionHandler<T= any>(what: symbol, handlerKey: string, handler: IExceptionHandler<T>) {
    this.handlers[what]             = this.handlers[what] || {};
    this.handlers[what][handlerKey] = handler;
  }

  public handlersForKey<T = any>(what: symbol): Array<IExceptionHandler<T>> {
    if (typeof(this.handlers[what]) === 'undefined') {
      return [];
    } else {
      return Object.keys(this.handlers[what])
        .map((k) => this.handlers[what][k]);
    }
  }
}
