import {
  BlockType,
  DBOp,
  IBaseTransaction,
  IBytesBlock,
  IKeypair,
  RawFullBlockListType,
  SignedAndChainedBlockType,
  SignedAndChainedTransportBlockType,
  SignedBlockType
} from '@risevision/core-types';
import { IBlocksModel } from '../models';

export interface IBlockLogic {
  table: string;
  dbFields: string[];

  getId(block: BlockType): string;

  getBytes(
    block: BlockType | SignedBlockType,
    includeSignature?: boolean
  ): Buffer;

  getHash(block: BlockType, includeSignature?: boolean): Buffer;

  create(data: {
    keypair: IKeypair;
    timestamp: number;
    transactions: Array<IBaseTransaction<any>>;
    previousBlock?: SignedAndChainedBlockType;
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
  dbSaveOp(block: SignedBlockType): DBOp<IBlocksModel>;

  /**
   * Normalize block object and eventually throw if something is not valid
   * Does NOT perform signature validation but just content validation.
   * @param {BlockType} block
   * @returns {BlockType}
   */
  objectNormalize(
    block: SignedAndChainedTransportBlockType
  ): SignedAndChainedBlockType;

  objectNormalize<T extends BlockType<Buffer | string>>(block: T): T;

  dbRead(
    rawBlock: RawFullBlockListType
  ): SignedBlockType & { totalForged: string; readonly generatorId: string };

  fromProtoBuffer(protoBuffer: Buffer): SignedAndChainedBlockType;
  toProtoBuffer(block: SignedAndChainedBlockType): Buffer;

  /**
   * Gets maximum size in bytes for a block. Used in Protocol Buffer response space allocation calculations.
   * @returns {number} maximum bytes size
   */
  getMaxBytesSize(): number;

  /**
   * Gets minimum size in bytes for a block. Used in Protocol Buffer response space allocation calculations.
   * @returns {number} minimum bytes size
   */
  getMinBytesSize(): number;
}
