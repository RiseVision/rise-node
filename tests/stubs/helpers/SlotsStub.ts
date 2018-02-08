import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class SlotsStub extends BaseStubClass {
  public delegates = 101;

  @stubMethod(true)
  public getSlotNumber() {
    return 1;
  }

  // TODO Add more methods when needed
}
