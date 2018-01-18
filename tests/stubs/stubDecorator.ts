import 'reflect-metadata';
import { BaseStubClass, stubMetadataSymbol } from './BaseStubClass';
// tslint:disable no-console max-line-length

export function stubMethod(target: BaseStubClass,
                           method: string,
                           descriptor: TypedPropertyDescriptor<(...args: any[]) => any>) {
  const curData = Reflect.getMetadata(stubMetadataSymbol, target) || [];
  curData.push(method);
  Reflect.defineMetadata(stubMetadataSymbol, curData, target);
}
