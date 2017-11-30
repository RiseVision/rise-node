import { SignedBlockType } from '../../../logic';
import { IModule } from './IModule';

export interface IRoundsModule extends IModule {
  isLoaded(): void;

  isTicking(): boolean;

  /**
   * Sets the snapshot rounds
   */
  setSnapshotRounds(rounds: number): void;

  /**
   * Return round calculated given the blockheight
   * @return {number}
   */
  calcRound(height: number): number;

  /**
   * Gets inclusive range of round from given height
   */
  heightFromRound(round: number): { first: number, last: number };

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
};
