import { SignedBlockType } from '../../../logic';
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
  backwardTick(block: SignedBlockType, previousBlock: SignedBlockType): Promise<void>;

  tick(block: SignedBlockType): Promise<void>;
}
