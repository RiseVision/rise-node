import { Symbols } from '@risevision/core-interfaces';
import { ConstantsType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { DposConstantsType } from './constants';
import { dPoSSymbols } from './symbols';

@injectable()
export class Slots {
  @inject(dPoSSymbols.dposConstants)
  private dposConstants: DposConstantsType;
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;

  /**
   * Active delegates
   */
  public get delegates() {
    return this.dposConstants.activeDelegates;
  }

  /**
   * Slot interval in seconds
   */
  private get interval() {
    return this.constants.blockTime;
  }

  /**
   * Calculates time since epoch.
   */
  public getTime(time: number = Date.now()) {
    const t = this.constants.epochTime.getTime();
    return Math.floor((time - t) / 1000);
  }

  public getSlotNumber(epochTime: number = this.getTime()) {
    return Math.floor(epochTime / this.interval);
  }

  public getSlotTime(slot: number) {
    return slot * this.interval;
  }

  /**
   * Basically adds the given slot number with the number of forging delegates
   */
  public getLastSlot(nextSlot: number) {
    return nextSlot + this.delegates;
  }

}
