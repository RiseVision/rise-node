export interface ISlots {
  readonly delegates: number;

  /**
   * Calculates time since epoch.
   */
  getTime(time: number): number;

  /**
   * Calculates slot number from epoch time
   */
  getSlotNumber(epochTime?: number): number;

  /**
   * Calculates time from a slot number
   */
  getSlotTime(slot: number): number;

  /**
   * Basically adds the given slot number with the number of forging delegates
   */
  getLastSlot(nextSlot: number): any;
}
