import { BlockProgressLogger } from '../../../../helpers';
import { SignedAndChainedBlockType } from '../../../../logic';
import { RawFullBlockListType } from '../../../../types/rawDBTypes';
import { publicKey } from '../../../../types/sanityTypes';

export interface IBlocksModuleUtils {
  readDbRows(rows: RawFullBlockListType[]): SignedAndChainedBlockType[];

  /**
   * Loads full blocks from database and normalize them
   *
   */
  loadBlocksPart(filter: { limit?: number, id?: string, lastId?: string }): Promise<SignedAndChainedBlockType[]>;

  /**
   * Loads the last block from db and normalizes it.
   * @return {Promise<SignedBlockType>}
   */
  loadLastBlock(): Promise<SignedAndChainedBlockType>;

  /**
   * Gets block IDs sequence - last block id, ids of first blocks of last 5 rounds and genesis block id.
   * @param {number} height
   */
  getIdSequence(height: number): Promise<{ firstHeight: number, ids: string[] }>;

  loadBlocksData(filter: { limit?: number, id?: string, lastId?: string }): Promise<RawFullBlockListType[]>;

  getBlockProgressLogger(txCount: number, logsFrequency: number, msg: string): BlockProgressLogger;

  /**
   * Gets block rewards for a delegate for time period
   */
  // tslint:disable-next-line max-line-length
  aggregateBlockReward(filter: { generatorPublicKey: publicKey, start?: number, end?: number }): Promise<{ fees: number, rewards: number, count: number }>;
}
