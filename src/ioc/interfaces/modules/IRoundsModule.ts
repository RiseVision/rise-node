import { SignedBlockType } from '../../../logic';
import { BlocksModel } from '../../../models/BlocksModel';
import { IModule } from './IModule';

export interface IRoundsModule extends IModule {
  /**
   * Deletes specific round from mem_rounds table
   */
  flush(round: number): Promise<void>;

  /**
   * Performs a backward tick on the round
   * @param {SignedBlockType} block
   * @param {SignedBlockType} previousBlock
   */
  backwardTick(block: BlocksModel, previousBlock: BlocksModel): Promise<void>;

  tick(block: BlocksModel): Promise<void>;
}
