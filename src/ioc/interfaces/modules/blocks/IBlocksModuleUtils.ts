import { BlockProgressLogger } from '../../../../helpers';
import { SignedAndChainedBlockType } from '../../../../logic';
import { BlocksModel } from '../../../../models';
import { RawFullBlockListType } from '../../../../types/rawDBTypes';
import { publicKey } from '../../../../types/sanityTypes';

/**
 * Methods signature for BlocksModuleUtils
 */
export interface IBlocksModuleUtils {

  /**
   * Returns normalized blocks from raw blocks
   */
  readDbRows(rows: RawFullBlockListType[]): SignedAndChainedBlockType[];

  /**
   * Loads full blocks from database and normalize them
   *
   */
  loadBlocksPart(filter: { limit?: number, id?: string, lastId?: string }): Promise<BlocksModel[]>;

  /**
   * Loads the last block from db and normalizes it.
   * @return {Promise<SignedBlockType>}
   */
  loadLastBlock(): Promise<BlocksModel>;

  /**
   * Gets block IDs sequence - last block id, ids of first blocks of last 5 rounds and genesis block id.
   * @param {number} height
   */
  getIdSequence(height: number): Promise<{ firstHeight: number, ids: string[] }>;

  /**
   * Gets blocks from database from the given filters
   */
  loadBlocksData(filter: { limit?: number, id?: string, lastId?: string }): Promise<BlocksModel[]>;

  getBlockProgressLogger(txCount: number, logsFrequency: number, msg: string): BlockProgressLogger;

  /**
   * Gets block rewards for a delegate for time period
   */
  // tslint:disable-next-line max-line-length
  aggregateBlockReward(filter: { generatorPublicKey: publicKey, start?: number, end?: number }): Promise<{ fees: number, rewards: number, count: number }>;
}
