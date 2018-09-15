import { inject, injectable } from 'inversify';
import { ISlots } from '../ioc/interfaces/helpers/ISlots';
import { Symbols } from '../ioc/symbols';
import constantsType from './constants';
import { IBlocksModule } from '../ioc/interfaces/modules';

@injectable()
export class Slots implements ISlots {
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  /**
   * Active delegates
   */
  public numDelegates(height?: number) {
    height = height || this.blocksModule.lastBlock.height;
    return height < this.constants.fairVoteSystem.firstBlock ? this.constants.activeDelegates
      : this.constants.activeDelegates + this.constants.fairVoteSystem.activeOutsiders;
  }

  /**
   * Maxim number of delegates between which forgers are chosen
   */
  public getDelegatesPoolSize(height?: number): number {
    height = height || this.blocksModule.lastBlock.height;
    return height < this.constants.fairVoteSystem.firstBlock ? this.constants.activeDelegates
      : this.constants.activeDelegates + this.constants.fairVoteSystem.outsidersPoolSize;
  }

  /**
   * Slot interval in seconds
   */
  private get interval() {
    return this.constants.blockTime;
  }

  /**
   * Calculates time since epoch.
   */
  public getTime(time: number = Date.now()) {
    const t = this.constants.epochTime.getTime();
    return Math.floor((time - t) / 1000);
  }

  public getSlotNumber(epochTime: number = this.getTime()) {
    return Math.floor(epochTime / this.interval);
  }

  public getSlotTime(slot: number) {
    return slot * this.interval;
  }

  /**
   * Basically adds the given slot number with the number of forging delegates
   */
  public getLastSlot(nextSlot: number, height: number) {
    return nextSlot + this.numDelegates(height);
  }

}
