import { IPeerLogic } from '../logic';

/**
 * Methods signature for LoaderModule
 */
export interface ILoaderModule {
  readonly isSyncing: boolean;
  readonly loaded: boolean;

  /**
   * Returns info about the network state
   */
  getNetwork(): Promise<{ height: number; peers: IPeerLogic[] }>;

  /**
   * Pick a random peer
   */
  getRandomPeer(): Promise<IPeerLogic>;

  /**
   * Set loaded to false
   */
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

  /**
   * Load blocks from database
   */
  load(count: number, limitPerIteration: number, message?: string): Promise<void>;
}
