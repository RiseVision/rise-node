'use strict';
import constants from './constants';

export class Slots {
  /**
   * Slot interval in seconds
   */
  public static interval = 30;

  /**
   * Active delegates
   */
  public static delegates = constants.activeDelegates;

  /**
   * Calculates time since epoch.
   */
  public static getTime(time: number = Date.now()) {
    const t = constants.epochTime.getTime();
    return Math.floor((time - t) / 1000);
  }

  public static getSlotNumber(epochTime: number = this.getTime()) {
    return Math.floor(epochTime / this.interval);
  }

  public static getSlotTime(slot: number) {
    return slot * this.interval;
  }

  public static getNextSlot() {
    return this.getSlotNumber() + 1;
  }

  public static getLastSlot(nextSlot: number) {
    // TODO: hmm? wtf is going on here? this is not last slot.
    return nextSlot + this.delegates;
  }

  public static roundTime(date: Date) {
    // TODO: hmm? wtf is going on here? this is not last slot.
    return Math.floor(date.getTime() / 1000) * 1000;
  }

}
