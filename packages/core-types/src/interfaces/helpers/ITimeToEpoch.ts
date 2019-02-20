export interface ITimeToEpoch {
  /**
   * Converts from unix epoch to coin epoch
   * @param {number} time unix epoch elapsed secs
   * @return {number}
   */
  getTime(time?: number): number;

  fromTimeStamp(timestamp: number): number;
}
