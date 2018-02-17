import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class BusStub extends BaseStubClass {
  @stubMethod()
  public message(event: string, ...rest: any[]) {

  }
}
