import { inject, injectable } from 'inversify';
import { Symbols } from '../ioc/symbols';
import constantsType from './constants';

@injectable()
export class Slots {
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;

  /**
   * Active delegates
   */
  public get delegates() {
    return this.constants.activeDelegates;
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

  public getNextSlot() {
    return this.getSlotNumber() + 1;
  }

  public getLastSlot(nextSlot: number) {
    // TODO: hmm? wtf is going on here? this is not last slot.
    return nextSlot + this.delegates;
  }

  public roundTime(date: Date) {
    // TODO: hmm? wtf is going on here? this is not last slot.
    return Math.floor(date.getTime() / 1000) * 1000;
  }

}
