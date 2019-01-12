import { IBlockReward, Symbols } from '@risevision/core-interfaces';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable, postConstruct } from 'inversify';
import { BlocksConstantsType } from '../blocksConstants';
import { BlocksSymbols } from '../blocksSymbols';

@injectable()
export class BlockRewardLogic implements IBlockReward {
  @inject(BlocksSymbols.constants)
  private blocksConstants: BlocksConstantsType;

  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;

  private rewards: Array<{ fromHeight: number; reward: bigint }>;

  @postConstruct()
  public initRewards() {
    this.rewards = this.blocksConstants.rewards.map((r) => ({
      ...r,
      reward: BigInt(r.reward),
    }));
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
    let supply = this.genesisBlock.totalAmount;
    let amountAccounted = 0n;

    for (let i = 0; i < milestone; i++) {
      const amount = BigInt(
        this.rewards[i + 1].fromHeight - this.rewards[i].fromHeight
      );
      // remove this milestone
      amountAccounted += amount;
      supply += amount * this.rewards[i].reward;
    }

    // add current milestone
    supply +=
      (BigInt(height) - amountAccounted) * this.rewards[milestone].reward;

    return supply;
  }

  private parseHeight(height: number) {
    if (isNaN(height)) {
      throw new Error('Invalid block height');
    }
    return Math.abs(height);
  }
}
