import { inject, injectable, postConstruct } from 'inversify';
import { constants } from '../helpers/';
import { IBlockReward } from '../ioc/interfaces/logic/';
import { Symbols } from '../ioc/symbols';

@injectable()
export class BlockRewardLogic implements IBlockReward {
  @inject(Symbols.helpers.constants)
  private constants: typeof constants;

  private rewards: Array<{ height: number, reward: number }>;

  @postConstruct()
  public initRewards() {
    this.rewards = constants.rewards;
  }

  public calcMilestone(height: number) {
    height = this.parseHeight(height);
    for (let i = this.rewards.length - 1; i >= 0; i--) {
      if (height >= this.rewards[i].height) {
        return i;
      }
    }
    return 0;
  }

  public calcReward(height: number): number {
    return this.rewards[this.calcMilestone(height)].reward;
  }

  public calcSupply(height: number): number {
    height = this.parseHeight(height);

    const milestone     = this.calcMilestone(height);
    let supply          = constants.totalAmount;
    let amountAccounted = 0;

    for (let i = 0; i < milestone; i++) {
      const amount = this.rewards[i + 1].height - this.rewards[i].height;
      // remove this milestone
      amountAccounted += amount;
      supply += amount * this.rewards[i].reward;
    }

    // add current milestone
    supply += (height - amountAccounted) * this.rewards[milestone].reward;

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
