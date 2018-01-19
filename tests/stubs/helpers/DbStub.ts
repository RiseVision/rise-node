import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class DbStub extends BaseStubClass /*implements IDatabase<any>*/ {

  @stubMethod
  public query() {}

  @stubMethod
  public none() {}

  // TODO Add more methods when needed
}
