import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import { MyConvOptions } from '../../../src/helpers/protobuf';

@injectable()
export class ProtoBufHelperStub extends BaseStubClass {
  @stubMethod()
  public validate(payload: object, namespace: string, messageType?: string): boolean {
    return undefined;
  }

  @stubMethod()
  public encode(payload: object, namespace: string, messageType?: string): (Uint8Array|Buffer) {
    return undefined;
  }

  @stubMethod()
  public decode(data: Buffer, namespace: string, messageType?: string): any {
    return undefined;
  }

  @stubMethod()
  public decodeToObj<T = any>(data: Buffer, namespace: string, messType?: string, converters?: MyConvOptions<T>): T {
    return undefined;
  }
}
