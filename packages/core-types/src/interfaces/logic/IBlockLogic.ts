import { Overwrite } from 'utility-types';

import {
  BlockType,
  DBOp,
  IBaseTransaction,
  IKeypair,
  SignedAndChainedBlockType,
  SignedBlockType,
} from '../../types';
import { IBlocksModel } from '../models';

export interface IBlockLogic {
  table: string;
  dbFields: string[];

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
  objectNormalize<T extends BlockType<string | Buffer, string | bigint>>(
    block: T
  ): Overwrite<
    T,
    {
      totalAmount: bigint;
      reward: bigint;
      payloadHash: Buffer;
      blockSignature: Buffer;
      generatorPublicKey: Buffer;
    }
  >;
}
