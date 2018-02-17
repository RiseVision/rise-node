import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export default class ZSchemaStub extends BaseStubClass {
  @stubMethod(true)
  public validate() {
    return true;
  }

  @stubMethod()
  public getLastErrors() {
  }
}
