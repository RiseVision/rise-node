import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class SlotsStub extends BaseStubClass {

  @stubMethod
  public getSlotNumber() {}

  // TODO Add more methods when needed
}
