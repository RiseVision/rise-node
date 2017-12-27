export interface IBlockReward {
  calcMilestone(height: number): number;

  calcReward(height: number): number;

  calcSupply(height: number): number;
}
