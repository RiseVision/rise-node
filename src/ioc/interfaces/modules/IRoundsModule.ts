import { SignedAndChainedBlockType, SignedBlockType } from '../../../logic';
import { BlocksModel } from '../../../models/BlocksModel';
import { IModule } from './IModule';
import { Transaction } from 'sequelize';

export interface IRoundsModule extends IModule {
  /**
   * Deletes specific round from mem_rounds table
   */
  flush(round: number): Promise<void>;

  /**
   * Performs a backward tick on the round
   * @param {SignedBlockType} block
   * @param {SignedBlockType} previousBlock
   * @param {Transaction} dbTX eventual tx where to perform such db queries.
   */
  backwardTick(block: BlocksModel, previousBlock: BlocksModel, dbTX?: Transaction): Promise<void>;

  tick(block: BlocksModel|SignedAndChainedBlockType, dbTX?: Transaction): Promise<void>;
}
