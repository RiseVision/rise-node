import { IKeypair } from '../../../../helpers';
import { BasePeerType, SignedAndChainedBlockType, SignedBlockType } from '../../../../logic';
import { IPeerLogic } from '../../logic';
import { IModule } from '../IModule';

export interface IBlocksModuleProcess extends IModule {
  /**
   * Performs chain comparison with remote peer
   * WARNING: Can trigger chain recovery
   * @param {PeerLogic} peer
   * @param {number} height
   * @return {Promise<void>}
   */
  // tslint:disable-next-line max-line-length
  getCommonBlock(peer: IPeerLogic, height: number): Promise<{ id: string, previousBlock: string, height: number } | void>;

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
  loadBlocksFromPeer(rawPeer: IPeerLogic | BasePeerType): Promise<SignedBlockType>;

  /**
   * Generates a new block
   * @param {IKeypair} keypair
   * @param {number} timestamp
   * @return {Promise<void>}
   */
  generateBlock(keypair: IKeypair, timestamp: number): Promise<any>;

  onReceiveBlock(block: SignedBlockType): Promise<any>;

}
