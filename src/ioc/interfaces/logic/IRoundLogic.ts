export interface IRoundLogic {
  /**
   * Adds or remove the blocks to the generator account.
   * @returns {Promise<void>}
   */
  mergeBlockGenerator(): Promise<void>;

  /**
   * Updates accounts and add a missing block to whoever skipped one
   * @returns {Promise<void>}
   */
  updateMissedBlocks(): Promise<void>;

  /**
   * Calls sql getVotes and returns the votes by each delegate
   */
  getVotes(): Promise<Array<{ delegate: string, amount: number }>>;

  /**
   * Update votes for thie round
   */
  updateVotes(): Promise<void>;

  /**
   * In case of backwards calls updateBlockId with '0';
   */
  markBlockId(): Promise<void>;

  /**
   * Calls sql flush, deletes round from mem_round
   */
  flushRound(): Promise<void>;

  /**
   * REmove blocks higher than this block height
   */
  truncateBlocks(): Promise<null>;

  /**
   * Performed when rollbacking last block of a round.
   * It restores the round snapshot from sql
   */
  restoreRoundSnapshot(): Promise<null>;

  /**
   * Performed when rollbacking last block of a round.
   * It restores the round snapshot from sql
   */
  restoreVotesSnapshot(): Promise<null>;

  /**
   * For each delegate in round calls mergeAccountAndGet with new Balance
   */
  applyRound(): Promise<void>;

  /**
   * Performs operations to go to the next round.
   */
  land(): Promise<void>;

  /**
   * Land back from a future round
   */
  backwardLand(): Promise<void>;
}
