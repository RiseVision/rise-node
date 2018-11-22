import { BlocksModule, BlocksSymbols } from '@risevision/core-blocks';
import { inject, injectable } from 'inversify';
import { DposConstantsType } from './constants';
import { dPoSSymbols } from './symbols';

@injectable()
export class DposV2Helper {
  @inject(dPoSSymbols.constants)
  private constants: DposConstantsType;

  @inject(BlocksSymbols.modules.blocks)
  private blocksModule: BlocksModule;

  /**
   * Checks if the current consensus is v2.
   */
  public isV2(height: number = this.blocksModule.lastBlock.height) {
    return (
      this.constants.dposv2.firstBlock > 0 &&
      height > this.constants.dposv2.firstBlock
    );
  }

  public isV1(height: number = this.blocksModule.lastBlock.height) {
    return !this.isV1(height);
  }
}
