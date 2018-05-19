import 'reflect-metadata';
import { BaseStubClass, spyMetadataSymbol, stubMetadataSymbol } from './BaseStubClass';

// tslint:disable no-console max-line-length

export function stubMethod(withDefaultAllowed: boolean = false) {
  return (target: BaseStubClass,
          method: string,
          descriptor: TypedPropertyDescriptor<(...args: any[]) => any>) => {
    const curData = Reflect.getMetadata(stubMetadataSymbol, target) || [];
    curData.push({method, withDefaultAllowed});
    Reflect.defineMetadata(stubMetadataSymbol, curData, target);
  };
}

export function stubStaticMethod(withDefaultAllowed: boolean = false) {
  return (target: typeof BaseStubClass,
          method: string,
          descriptor: TypedPropertyDescriptor<(...args: any[]) => any>) => {
    target.stubConfigs = target.stubConfigs || [];
    target.stubConfigs.push({method, withDefaultAllowed});
  };
}

export function spyMethod(target: BaseStubClass,
                          method: string,
                          descriptor: TypedPropertyDescriptor<(...args: any[]) => any>) {
  const curData = Reflect.getMetadata(spyMetadataSymbol, target) || [];
  curData.push(method);
  Reflect.defineMetadata(spyMetadataSymbol, curData, target);
}
