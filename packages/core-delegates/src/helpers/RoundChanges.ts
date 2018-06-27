import BigNumber from 'bignumber.js';
import { Slots } from './slots';

export class RoundChanges {
  private roundFees: number;
  private roundRewards: number[];

  // The fee per delegate.
  private fees: BigNumber;
  // The fees that are excluded by math precision
  private feesRemaining: BigNumber;

  constructor(scope: { roundFees?: number, roundRewards: number[] }, private slots: Slots) {
    this.roundFees     = Math.floor(scope.roundFees) || 0;
    this.roundRewards  = scope.roundRewards || [];
    this.fees          = new BigNumber(this.roundFees.toPrecision(15)).dividedBy(this.slots.delegates)
      .integerValue(BigNumber.ROUND_FLOOR);
    this.feesRemaining = new BigNumber(this.roundFees.toPrecision(15)).minus(this.fees.times(this.slots.delegates));
  }

  /**
   * Calculates rewards at round position.
   * Fees and feesRemaining based on slots
   */
  public at(index: number): { balance: number, fees: number, feesRemaining: number, rewards: number } {
    const rewards = this.roundRewards[index] ? new BigNumber(this.roundRewards[index].toPrecision(15))
      .integerValue(BigNumber.ROUND_FLOOR) : 0;

    return {
      balance      : Number(this.fees.plus(rewards).toFixed()),
      fees         : Number(this.fees.toFixed()),
      feesRemaining: Number(this.feesRemaining.toFixed()),
      rewards      : Number(rewards.toFixed()),
    };
  }
}
