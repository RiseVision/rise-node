export interface IBlockReward {

  /**
   * Calculates milestone from height
   */
  calcMilestone(height: number): number;

  /**
   * Calculates reward from height
   */
  calcReward(height: number): number;

  /**
   * Calculates supply from height
   */
  calcSupply(height: number): number;
}
