import { ForkType, SignedBlockType } from '@risevision/core-types';

export interface IForkModule {
  /**
   * Inserts a fork into fork_stats table and emits a socket signal with the fork data
   * @param {SignedBlockType} block
   * @param {ForkType} cause
   * @return {Promise<void>}
   */
  fork(block: SignedBlockType, cause: ForkType): Promise<void>;
}
