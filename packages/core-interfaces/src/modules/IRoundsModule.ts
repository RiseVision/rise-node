import { SignedAndChainedBlockType } from '@risevision/core-types';
import { Transaction } from 'sequelize';
import { IBlocksModel } from '../models';
import { IModule } from './IModule';

export interface IRoundsModule extends IModule {

  /**
   * Performs a backward tick on the round
   * @param {SignedBlockType} block
   * @param {SignedBlockType} previousBlock
   * @param {Transaction} transaction
   */
  backwardTick(block: IBlocksModel, previousBlock: IBlocksModel, transaction: Transaction): Promise<void>;

  tick(block: IBlocksModel|SignedAndChainedBlockType, transaction: Transaction): Promise<void>;
}
