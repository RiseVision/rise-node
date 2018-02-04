import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { spyMethod, stubMethod } from '../stubDecorator';

@injectable()
export class ExceptionsManagerStub extends BaseStubClass {
  @spyMethod
  public registerExceptionHandler() {}

  @stubMethod(true)
  public handlersForKey() {
    return [];
  }
}
