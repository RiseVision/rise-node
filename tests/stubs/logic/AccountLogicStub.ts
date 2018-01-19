import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class AccountLogicStub extends BaseStubClass {

  @stubMethod
  public merge() {}

  // TODO Add more methods when needed
}
