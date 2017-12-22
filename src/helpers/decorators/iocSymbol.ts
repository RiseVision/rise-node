import 'reflect-metadata';
import { Symbols } from '../../ioc/symbols';
export function IoCSymbol(symbol: symbol): ClassDecorator {
  // ts-lint:disable-next-line ban-types
  return function iocDecorator<T extends Function>(t: T) {
    Reflect.defineMetadata(Symbols.__others.metadata.classSymbol, symbol, t);
    return t;
  };
}
