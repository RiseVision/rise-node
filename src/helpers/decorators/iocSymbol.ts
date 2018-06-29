import 'reflect-metadata';
import { Symbols } from '../../ioc/symbols';

/**
 * Decorator for to define class Symbol metadata
 */
export function IoCSymbol(symbol: symbol): ClassDecorator {
  // tslint:disable-next-line ban-types
  return function iocDecorator<T extends Function>(t: T) {
    Reflect.defineMetadata(Symbols.__others.metadata.classSymbol, symbol, t);
    return t;
  };
}
