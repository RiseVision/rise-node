import { IKeypair } from '../../../helpers';
import { BlockType, SignedAndChainedBlockType, SignedBlockType } from '../../../logic';
import { IBaseTransaction } from '../../../logic/transactions';

export interface IBlockLogic {
  table: string;
  dbFields: string[];

  /**
   * Use static method instead
   * @deprecated
   */
  getId(block: BlockType): string;

  create(data: {
    keypair: IKeypair, timestamp: number,
    transactions: Array<IBaseTransaction<any>>,
    previousBlock?: SignedAndChainedBlockType
  }): SignedBlockType;

  /**
   * Sign the block
   * @param {BlockType} block
   * @param {IKeypair} key
   * @returns {string}
   */
  sign(block: BlockType, key: IKeypair): string;

  /**
   * Verifies block hash, generator block public key and block signature
   * @param {BlockType} block
   */
  verifySignature(block: SignedBlockType): boolean;

  /**
   * Creates db object transaction to `blocks` table.
   * @param {BlockType} block
   */
  dbSave(block: SignedBlockType): any;

  /**
   * Normalize block object and eventually throw if something is not valid
   * Does NOT perform signature validation but just content validation.
   * @param {BlockType} block
   * @returns {BlockType}
   */
  objectNormalize<T extends BlockType>(block: T): T;

  dbRead(rawBlock: any): SignedBlockType;
}
