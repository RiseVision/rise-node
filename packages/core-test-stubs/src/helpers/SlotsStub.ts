import { ISlots } from '@risevision/core-interfaces';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export class SlotsStub extends BaseStubClass implements ISlots {

  public readonly delegates: number = 101;

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
