import { PeerType } from '@risevision/core-types';

export interface ILoaderModule {
  readonly isSyncing: boolean;
  readonly loaded: boolean;

  getNetwork(): Promise<{ height: number; peers: PeerType[] }>;

  getRandomPeer(): Promise<PeerType>;

  cleanup(): Promise<void>;

  /**
   * Checks mem tables:
   * - count blocks from `blocks` table
   * - get genesis block from `blocks` table
   * - count accounts from `mem_accounts` table by block id
   * - get rounds from `mem_round`
   * Matchs genesis block with database.
   * Verifies Snapshot mode.
   * Recreates memory tables when neccesary:
   *  - Calls logic.account to removeTables and createTables
   *  - Calls block to load block. When blockchain ready emits a bus message.
   * Detects orphaned blocks in `mem_accounts` and gets delegates.
   * Loads last block and emits a bus message blockchain is ready.
   */
  loadBlockChain(): Promise<void>;

  load(count: number, limitPerIteration: number, message?: string): Promise<void>;
}
