import { IKeypair } from '../../../helpers';
import {
  BlockType,
  SignedAndChainedBlockType,
  SignedAndChainedTransportBlockType,
  SignedBlockType
} from '../../../logic';
import { IBaseTransaction } from '../../../logic/transactions';
import { BlocksModel } from '../../../models';
import { DBOp } from '../../../types/genericTypes';
import { RawFullBlockListType } from '../../../types/rawDBTypes';

export interface IBlockLogic {
  table: string;
  dbFields: string[];

  /**
   * Calculates block id.
   */
  getId(block: BlockType): string;

  /**
   * Calculates bytes from a given block
   */
  getBytes(block: BlockType | SignedBlockType, includeSignature?: boolean): Buffer;

  /**
   * Calculates hash from a given block
   */
  getHash(block: BlockType, includeSignature?: boolean): Buffer;

  /**
   * Creates a new block
   */
  create(data: {
    keypair: IKeypair, timestamp: number,
    transactions: Array<IBaseTransaction<any>>,
    previousBlock?: SignedAndChainedBlockType
  }): SignedAndChainedBlockType;

  /**
   * Sign the block
   * @param {BlockType} block
   * @param {IKeypair} key
   * @returns {string}
   */
  sign(block: BlockType, key: IKeypair): Buffer;

  /**
   * Verifies block hash, generator block public key and block signature
   * @param {BlockType} block
   */
  verifySignature(block: SignedBlockType): boolean;

  /**
   * Creates db object transaction to `blocks` table.
   * @param {BlockType} block
   */
  dbSave(block: SignedBlockType): DBOp<BlocksModel>;

  /**
   * Normalize block object and eventually throw if something is not valid
   * Does NOT perform signature validation but just content validation.
   * @param {BlockType} block
   * @returns {BlockType}
   */
  objectNormalize(block: SignedAndChainedTransportBlockType): SignedAndChainedBlockType;
  objectNormalize<T extends BlockType<Buffer | string>>(block: T): T;

  /**
   * Converts a raw block to a block object
   */
  dbRead(rawBlock: RawFullBlockListType): SignedBlockType & { totalForged: string, readonly generatorId: string };
}
