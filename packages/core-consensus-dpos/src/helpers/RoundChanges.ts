import BigNumber from 'bignumber.js';
import { Slots } from './slots';

export class RoundChanges {
  private roundFees: bigint;
  private roundRewards: Array<bigint>;

  // The fee per delegate.
  private fees: bigint;
  // The fees that are excluded by math precision
  private feesRemaining: bigint;

  constructor(
    scope: { roundFees?: bigint; roundRewards: Array<bigint> },
    private slots: Slots
  ) {
    this.roundFees = scope.roundFees || 0n;
    this.roundRewards = scope.roundRewards || [];
    this.fees = this.roundFees / BigInt(this.slots.delegates);
    this.feesRemaining = this.roundFees - this.fees * BigInt(this.slots.delegates);
  }

  /**
   * Calculates rewards at round position.
   * Fees and feesRemaining based on slots
   */
  public at(
    index: number
  ): { balance: bigint; fees: bigint; feesRemaining: bigint; rewards: bigint } {
    const rewards = this.roundRewards[index] || 0n;

    return {
      balance: this.fees + rewards,
      fees: this.fees,
      feesRemaining: this.feesRemaining,
      rewards,
    };
  }
}
