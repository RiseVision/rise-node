import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import { ISlots } from '../../../src/ioc/interfaces/helpers';

// tslint:disable no-empty

@injectable()
export class SlotsStub extends BaseStubClass implements ISlots {

  @stubMethod()
  public numDelegates(height?: number) {
    return 1;
  }

  @stubMethod()
  public getDelegatesPoolSize(height?: number) {
    return 1;
  }

  @stubMethod(true)
  public getSlotNumber() {
    return 1;
  }

  @stubMethod()
  public getLastSlot(nextSlot: number): any {
  }

  @stubMethod()
  public getSlotTime(slot: number): number {
    return 0;
  }

  @stubMethod()
  public getTime(time: number): number {
    return 0;
  }

}
