import { SignedAndChainedBlockType, SignedBlockType } from '../../../logic';
import { BlocksModel } from '../../../models/BlocksModel';
import { IModule } from './IModule';
import { Transaction } from 'sequelize';

export interface IRoundsModule extends IModule {

  /**
   * Performs a backward tick on the round
   * @param {SignedBlockType} block
   * @param {SignedBlockType} previousBlock
   * @param {Transaction} transaction
   */
  backwardTick(block: BlocksModel, previousBlock: BlocksModel, transaction: Transaction): Promise<void>;

  tick(block: BlocksModel|SignedAndChainedBlockType, transaction: Transaction): Promise<void>;
}
