import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

export class BusStub extends BaseStubClass {
  @stubMethod()
  public message(event: string, ...rest: any[]) {

  }
}
