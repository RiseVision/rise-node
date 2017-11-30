import { PeerLogic } from '../../../logic';

export interface ILoaderModule {
  readonly isSyncing: boolean;

  getNework(): Promise<{ height: number; peers: PeerLogic[] }>;

  gerRandomPeer(): Promise<PeerLogic>;

  onBind(modules: any): Promise<void>;

  onPeersReady(): Promise<void>;

  onBlockchainReady(): void;

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
