import { Transaction } from 'sequelize';
import { IModule } from './IModule';

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
