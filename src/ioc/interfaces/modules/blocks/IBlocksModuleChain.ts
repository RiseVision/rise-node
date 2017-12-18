import { SignedAndChainedBlockType, SignedBlockType } from '../../../../logic';
import { IModule } from '../IModule';

export interface IBlocksModuleChain extends IModule {

  /**
   * Deletes a block from the Database table
   */
  deleteBlock(blockId: string): Promise<void>;

  /**
   * Delete last block and return the new last
   */
  deleteLastBlock(): Promise<SignedAndChainedBlockType>;

  /**
   * Deletes blocks after a certain block id.
   * @param {string} blockId
   * @returns {Promise<void>}
   */
  deleteAfterBlock(blockId: string): Promise<void>;

  /**
   * Recover chain - wrapper for deleteLastBLock
   * @returns {Promise<void>}
   */
  recoverChain(): Promise<void>;

  /**
   * Checks for genesis in db and eventually calls #saveBlock
   * @returns {Promise<any>}
   */
  saveGenesisBlock(): Promise<void>;

  /**
   * Apply genesis block transaction to blockchain
   * @param {SignedBlockType} block
   * @returns {Promise<void>}
   */
  applyGenesisBlock(block: SignedAndChainedBlockType): Promise<void>;

  applyBlock(block: SignedAndChainedBlockType, broadcast: boolean, saveBlock: boolean): Promise<void>;

  /**
   * Save block with transactions to database
   * @param {SignedBlockType} b
   * @returns {Promise<void>}
   */
  saveBlock(b: SignedBlockType): Promise<void>;
}
