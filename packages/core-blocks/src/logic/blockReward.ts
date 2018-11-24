import { IBlockReward, Symbols } from '@risevision/core-interfaces';
import { inject, injectable, postConstruct } from 'inversify';
import { BlocksConstantsType } from '../blocksConstants';
import { ConstantsType } from '@risevision/core-types';

@injectable()
export class BlockRewardLogic implements IBlockReward {
  @inject(Symbols.generic.constants)
  private blocksConstants: BlocksConstantsType & ConstantsType;

  private rewards: Array<{ fromHeight: number; reward: bigint }>;

  @postConstruct()
  public initRewards() {
    this.rewards = this.blocksConstants.blocks.rewards
      .map((r) => ({...r, reward: BigInt(r.reward)}));
  }

  public calcMilestone(height: number) {
    height = this.parseHeight(height);
    for (let i = this.rewards.length - 1; i >= 0; i--) {
      if (height >= this.rewards[i].fromHeight) {
        return i;
      }
    }
    return 0;
  }

  public calcReward(height: number): bigint {
    return BigInt(this.rewards[this.calcMilestone(height)].reward);
  }

  public calcSupply(height: number): bigint {
    height = this.parseHeight(height);

    const milestone = this.calcMilestone(height);
    let supply = BigInt(this.blocksConstants.totalAmount);
    let amountAccounted = 0n;

    for (let i = 0; i < milestone; i++) {
      const amount = BigInt(this.rewards[i + 1].fromHeight - this.rewards[i].fromHeight);
      // remove this milestone
      amountAccounted += amount;
      supply += amount * this.rewards[i].reward;
    }

    // add current milestone
    supply += (BigInt(height) - amountAccounted) * this.rewards[milestone].reward;

    // const tha = new (require('./_blockReward.js'))().calcSupply(height);
    // if (supply !== tha) {
    //  console.log(supply, tha);
    //  // process.exit(1);
    // }
    return supply;
  }

  private parseHeight(height: number) {
    if (isNaN(height)) {
      throw new Error('Invalid block height');
    }
    return Math.abs(height);
  }
}
