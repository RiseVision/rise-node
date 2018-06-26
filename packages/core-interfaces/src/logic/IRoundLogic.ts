import { address, DBCustomOp, DBOp, SignedBlockType } from '@risevision/core-types';
import { ILogger, ISlots } from '../helpers';
import { IAccountsModel, IBlocksModel, IRoundsModel } from '../models';
import { IAccountsModule } from '../modules';

// tslint:disable-next-line
export type RoundLogicScope = {
  backwards: boolean;
  round: number;
  // List of address which missed a block in this round
  roundOutsiders: address[];
  roundDelegates: Buffer[];
  roundFees: any;
  roundRewards: number[];
  finishRound: boolean;
  library: {
    logger: ILogger
  },
  models: {
    AccountsModel: typeof IAccountsModel,
    BlocksModel: typeof IBlocksModel,
    RoundsModel: typeof IRoundsModel,
  }
  modules: {
    accounts: IAccountsModule;
  }
  block: SignedBlockType
  // must be populated with the votes in round when is needed
  votes?: Array<{ delegate: string, amount: number }>
};

export interface IRoundLogicNewable {
  new (scope: RoundLogicScope, slots: ISlots): IRoundLogic;
}

export interface IRoundLogic {

  /**
   * Adds or remove the blocks to the generator account.
   * @returns {Promise<void>}
   */
  mergeBlockGenerator(): Array<DBOp<any>>;

  /**
   * Updates accounts and add a missing block to whoever skipped one
   * @returns {Promise<void>}
   */
  updateMissedBlocks(): DBOp<any>;

  /**
   * Update votes for the round
   */
  updateVotes(): DBCustomOp<any>;

  /**
   * In case of backwards calls updateBlockId with '0';
   */
  markBlockId(): DBOp<any>;

  /**
   * Calls sql flush, deletes round from mem_round
   */
  flushRound(): DBOp<any>;

  /**
   * REmove blocks higher than this block height
   */
  truncateBlocks(): DBOp<any>;

  /**
   * Performed when rollbacking last block of a round.
   * It restores the round snapshot from sql
   */
  restoreRoundSnapshot(): DBOp<any>;

  /**
   * Performed when rollbacking last block of a round.
   * It restores the round snapshot from sql
   */
  restoreVotesSnapshot(): DBOp<any>;

  /**
   * For each delegate in round calls mergeAccountAndGet with new Balance
   */
  applyRound(): Array<DBOp<any>>;

  /**
   * Performs operations to go to the next round.
   */
  land(): Array<DBOp<any>>;

  /**
   * Land back from a future round
   */
  backwardLand(): Array<DBOp<any>>;
}
