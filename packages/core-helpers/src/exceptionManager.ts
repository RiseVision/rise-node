import { IExceptionModel } from '@risevision/core-interfaces';
import { inject, injectable } from 'inversify';
import { Symbols } from './symbols';

export const ExceptionsList = {
  assertValidSlot    : Symbol('assertValidSlot'),
  checkBalance       : Symbol('checkBalance'),
  tx_apply           : Symbol('tx_apply'),
  tx_applyUnconfirmed: Symbol('tx_applyUnconfirmed'),
};

export interface IExceptionHandler<K> {
  canHandle(obj: K, ...args: any[]): boolean;

  handle(obj: K, ...args: any[]);
}

// tslint:disable-next-line
export type ExceptionType = {
  type: string;
  address: string;
  maxCount: number;
};

@injectable()
export class ExceptionsManager {
  private handlers: { [k in symbol]: { [h: string]: IExceptionHandler<any> } } = {};

  @inject(Symbols.models.exceptions)
  private exceptionModel: typeof IExceptionModel;

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

  public async createOrUpdateDBExceptions(exceptions: ExceptionType[]) {
    for (const exception of exceptions) {
      await this.exceptionModel.findOrCreate({
        defaults: {remainingCount: exception.maxCount},
        where   : {type: exception.type, key: exception.address},
      });
    }
  }

}
