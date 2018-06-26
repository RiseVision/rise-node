import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class EdStub extends BaseStubClass  {

  @stubMethod()
  public sign() {}

  @stubMethod()
  public verify() {}

  @stubMethod()
  public makeKeypair() {}

  // TODO Add more methods when needed
}
