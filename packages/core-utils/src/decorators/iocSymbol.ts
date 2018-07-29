import 'reflect-metadata';
import { UtilsSymbols } from '../utilsSymbols';
export function IoCSymbol(symbol: symbol): ClassDecorator {
  // tslint:disable-next-line ban-types
  return function iocDecorator<T extends Function>(t: T) {
    Reflect.defineMetadata(UtilsSymbols.classSymbol, symbol, t);
    return t;
  };
}
