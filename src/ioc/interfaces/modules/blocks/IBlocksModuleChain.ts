import { Transaction } from 'sequelize';
import { SignedAndChainedBlockType, SignedBlockType } from '../../../../logic';
import { IModule } from '../IModule';
import { AccountsModel } from '../../../../models';

export interface IBlocksModuleChain extends IModule {

  /**
   * Delete last block and return the new last
   */
  deleteLastBlock(): Promise<SignedAndChainedBlockType>;

  /**
   * Deletes blocks after a certain block height (included).
   * @param {number} height
   * @returns {Promise<void>}
   */
  deleteAfterBlock(height: number): Promise<void>;

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

  applyBlock(block: SignedAndChainedBlockType, broadcast: boolean, saveBlock: boolean, accountsMap: {[address: string]: AccountsModel}): Promise<void>;

  /**
   * Save block with transactions to database
   * @param {SignedBlockType} b
   * @param {Transaction} dbTX Database Transaction where to run this against
   * @returns {Promise<void>}
   */
  saveBlock(b: SignedBlockType, dbTX: Transaction): Promise<void>;
}
