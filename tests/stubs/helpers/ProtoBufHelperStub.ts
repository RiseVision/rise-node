import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

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

}
