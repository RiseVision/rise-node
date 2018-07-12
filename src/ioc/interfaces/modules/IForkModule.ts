import { ForkType } from '../../../helpers';
import { SignedBlockType } from '../../../logic';

/**
 * Methods signature for ForkModule
 */
export interface IForkModule {
  /**
   * Inserts a fork into fork_stats table and emits a socket signal with the fork data
   * @param {SignedBlockType} block
   * @param {ForkType} cause
   * @return {Promise<void>}
   */
  fork(block: SignedBlockType, cause: ForkType): Promise<void>;
}
