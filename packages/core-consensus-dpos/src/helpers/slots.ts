import { BlocksModule } from '@risevision/core-blocks';
import { Symbols } from '@risevision/core-interfaces';
import { ConstantsType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { DposConstantsType } from './constants';
import { DposV2Helper } from './dposV2Helper';
import { dPoSSymbols } from './symbols';

@injectable()
export class Slots {
  @inject(dPoSSymbols.constants)
  private dposConstants: DposConstantsType;
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;

  @inject(Symbols.modules.blocks)
  private blocksModule: BlocksModule;
  @inject(dPoSSymbols.helpers.dposV2)
  private dposV2Helper: DposV2Helper;

  /**
   * Maximum number of delegates between which forgers are chosen
   */
  public getDelegatesPoolSize(
    height: number = this.blocksModule.lastBlock.height
  ): number {
    return this.dposV2Helper.isV2(height)
      ? this.dposConstants.dposv2.delegatesPoolSize
      : this.dposConstants.activeDelegates;
  }

  /**
   * Active delegates
   */
  public get delegates() {
    return this.dposConstants.activeDelegates;
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
  public getLastSlot(nextSlot: number) {
    return nextSlot + this.delegates;
  }
}
