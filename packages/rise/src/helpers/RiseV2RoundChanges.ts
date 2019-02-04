import { RoundChanges } from '@risevision/core-consensus-dpos';

export class RiseV2RoundChanges {
  private roundFees: Array<bigint>;
  private roundRewards: Array<bigint>;

  // The fee per delegate.
  private fees: bigint;
  // The fees that are excluded by math precision
  private feesRemaining: bigint;

  constructor(
    scope: { roundFees?: Array<bigint>; roundRewards: Array<bigint> }
  ) {
    const totalRoundFees = scope.roundFees.reduceRight((a, b) => a + b, 0n);
    this.roundFees = scope.roundFees;
    this.roundRewards = scope.roundRewards || [];
    this.fees = totalRoundFees / 101n;
    this.feesRemaining =
      totalRoundFees - this.fees * 101n;
  }

  /**
   * Calculates rewards at round position.
   * Fees and feesRemaining based on slots
   */
  public at(
    index: number
  ): { balance: bigint; fees: bigint; rewards: bigint } {
    const rewards = this.roundRewards[index] || 0n;
    const feesRemaining = index === 100 ? this.feesRemaining : 0n;

    return {
      balance: this.fees + rewards + feesRemaining,
      fees: this.fees,
      rewards,
    };
  }

}
