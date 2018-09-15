export interface ISlots {
  numDelegates(height?: number): number;

  getDelegatesPoolSize(height?: number): number;

  /**
   * Calculates time since epoch.
   */
  getTime(time: number): number;

  getSlotNumber(epochTime?: number): number;

  getSlotTime(slot: number): number;

  /**
   * Basically adds the given slot number with the number of forging delegates
   */
  getLastSlot(nextSlot: number, height: number): any;
}
