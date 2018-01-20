import { BaseStubClass } from '../BaseStubClass';
import { spyMethod, stubMethod } from '../stubDecorator';

export class ExceptionsManagerStub extends BaseStubClass {
  @spyMethod
  public registerExceptionHandler() {}

  @stubMethod(true)
  public handlersForKey() {
    return [];
  }
}
