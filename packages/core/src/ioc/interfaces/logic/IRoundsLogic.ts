export interface IRoundsLogic {
  /**
   * Return round calculated given the blockheight
   * @return {number}
   */
  calcRound(height: number): number;

  /**
   * Gets inclusive range of round from given height
   */
  heightFromRound(round: number): { first: number, last: number };

  /**
   * Computes and returns first block in round
   */
  firstInRound(round: number): number;

  /**
   * Last block in round
   */
  lastInRound(round: number): number;
}
