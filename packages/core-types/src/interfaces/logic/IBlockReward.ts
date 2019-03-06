export interface IBlockReward {
  calcMilestone(height: number): number;

  calcReward(height: number): bigint;

  calcSupply(height: number): bigint;
}
