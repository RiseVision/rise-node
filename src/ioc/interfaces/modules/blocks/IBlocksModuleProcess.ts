import { IKeypair } from '../../../../helpers';
import { BasePeerType, PeerLogic, SignedAndChainedBlockType, SignedBlockType } from '../../../../logic';
import { IModule } from '../IModule';

export interface IBlocksModuleProcess extends IModule {
  /**
   * Performs chain comparison with remote peer
   * WARNING: Can trigger chain recovery
   * @param {PeerLogic} peer
   * @param {number} height
   * @return {Promise<void>}
   */
  getCommonBlock(peer: PeerLogic, height: number): Promise<{ id: string, previousBlock: string, height: number } | void>;

  /**
   * Loads full blocks from database, used when rebuilding blockchain, snapshotting.
   * @param {number} limit
   * @param {number} offset
   * @param {boolean} verify
   * @return {Promise<void>}
   */
  loadBlocksOffset(limit: number, offset: number, verify: boolean): Promise<SignedAndChainedBlockType>;

  /**
   * Query remote peer for block, process them and return last processed (and valid) block
   * @param {PeerLogic | BasePeerType} rawPeer
   * @return {Promise<SignedBlockType>}
   */
  loadBlocksFromPeer(rawPeer: PeerLogic | BasePeerType): Promise<SignedBlockType>;

  /**
   * Generates a new block
   * @param {IKeypair} keypair
   * @param {number} timestamp
   * @return {Promise<void>}
   */
  generateBlock(keypair: IKeypair, timestamp: number): Promise<any>;

  onReceiveBlock(block: SignedBlockType): Promise<any>;

  /**
   * called by onReceiveBlock. Will update receipt on blocks module and call processBlock on verify Submodule
   * @param {SignedBlockType} block
   * @return {Promise<any>}
   */
  receiveBlock(block: SignedBlockType): Promise<any>;

  /**
   * Receive block detected as fork cause 1: Consecutive height but different previous block id
   */
  receiveForkOne(block: SignedBlockType, lastBlock: SignedBlockType): Promise<void>;

  /**
   * Receive block detected as fork cause 5: Same height and previous block id, but different block id
   */
  receiveForkFive(block: SignedBlockType, lastBlock: SignedBlockType): Promise<void>;
}