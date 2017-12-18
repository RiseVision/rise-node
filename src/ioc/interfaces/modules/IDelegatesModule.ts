import { ForkType, IKeypair } from '../../../helpers';
import { MemAccountsData, SignedBlockType } from '../../../logic';
import { publicKey } from '../../../types/sanityTypes';
import { IModule } from './IModule';

export interface IDelegatesModule extends IModule {

  /**
   * Checks that the account on pk has vote integrity for the unconfirmed state
   */
  checkConfirmedDelegates(pk: publicKey, votes: string[]): Promise<void>;

  /**
   * Checks that the account on pk has vote integrity for the confirmed state
   */
  checkUnconfirmedDelegates(pk: publicKey, votes: string[]): Promise<void>;

  /**
   * Generate a randomized list for the round of which the given height is into.
   * @param {number} height blockheight.
   * @return {Promise<publicKey[]>}
   */
  generateDelegateList(height: number): Promise<publicKey[]>;

  /**
   * Gets delegates and for each calculate rank approval and productivity.
   */
  getDelegates(query: { limit?: number, offset?: number, orderBy: string }): Promise<{
    delegates: Array<MemAccountsData & { rank: number, approval: number, productivity: number }>,
    count: number,
    offset: number,
    limit: number,
    sortField: string,
    sortMethod: 'ASC' | 'DESC'
  }>;

  /**
   * Asserts that the block was signed by the correct delegate.
   */
  assertValidBlockSlot(block: SignedBlockType): Promise<void>;

  isLoaded(): boolean;
}
