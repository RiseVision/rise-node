export class RoundChanges {
  private roundFees: Array<bigint>;
  private roundRewards: Array<bigint>;

  constructor(scope: {
    roundFees?: Array<bigint>;
    roundRewards: Array<bigint>;
  }) {
    this.roundFees = scope.roundFees || [];
    this.roundRewards = scope.roundRewards || [];
  }

  /**
   * Calculates rewards at round position.
   * Fees and feesRemaining based on slots
   */
  public at(index: number): { balance: bigint; fees: bigint; rewards: bigint } {
    const rewards = this.roundRewards[index] || 0n;
    const fees = this.roundFees[index] || 0n;

    return {
      balance: fees + rewards,
      fees,
      rewards,
    };
  }
}
