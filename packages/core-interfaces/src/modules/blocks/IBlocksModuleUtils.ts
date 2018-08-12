import { IBlocksModel } from '../../models';

export interface IBlocksModuleUtils {

  /**
   * Loads full blocks from database and normalize them
   *
   */
  loadBlocksPart(filter: { limit?: number, id?: string, lastId?: string }): Promise<IBlocksModel[]>;

  /**
   * Loads the last block from db and normalizes it.
   * @return {Promise<SignedBlockType>}
   */
  loadLastBlock(): Promise<IBlocksModel>;

  /**
   * Gets block IDs sequence - last block id, ids of first blocks of last 5 rounds and genesis block id.
   * @param {number} height
   */
  getIdSequence(height: number): Promise<{ firstHeight: number, ids: string[] }>;

  loadBlocksData(filter: { limit?: number, id?: string, lastId?: string }): Promise<IBlocksModel[]>;

  // TODO: BlocksModuleProcess missing interface?
  getBlockProgressLogger(txCount: number, logsFrequency: number, msg: string): any;

}
