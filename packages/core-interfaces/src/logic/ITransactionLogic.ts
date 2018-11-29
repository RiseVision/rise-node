import {
  DBOp,
  IBaseTransaction,
  ITransportTransaction,
  SignedBlockType,
} from '@risevision/core-types';
import { Model } from 'sequelize-typescript';
import { IAccountsModel } from '../models';
import { IBaseTransactionType } from './IBaseTransactionType';

/**
 * VerificationType When checking against signature.
 */
export enum VerificationType {
  /**
   * Check signature is valid for both signature and secondsignature
   */
  ALL,
  /**
   * Check if signature is a valid signature
   */
  SIGNATURE,
  /**
   * Check if signature is a valid secondsign
   */
  SECOND_SIGNATURE,
}
export interface ITransactionLogic {
  attachAssetType<K, M extends Model<any>>(
    instance: IBaseTransactionType<K, M>
  ): IBaseTransactionType<K, M>;
  /**
   * Calculate tx id
   * @returns {string} the id.
   */
  getId(tx: IBaseTransaction<any>): string;

  /**
   * Hash for the transaction
   */
  getHash(
    tx: IBaseTransaction<any>,
    skipSign: boolean,
    skipSecondSign: boolean
  ): Buffer;

  /**
   * Return the transaction bytes.
   * @returns {Buffer}
   */

  getBytes(
    tx: IBaseTransaction<any>,
    skipSignature?: boolean,
    skipSecondSignature?: boolean
  ): Buffer;

  ready(tx: IBaseTransaction<any>, sender: IAccountsModel): Promise<boolean>;

  assertKnownTransactionType(type: number): void;

  /**
   * Checks if balanceKey is less than amount for sender
   */
  checkBalance(
    amount: bigint,
    balanceKey: 'balance' | 'u_balance',
    tx: IBaseTransaction<any>,
    sender: any
  ): { error: string; exceeded: boolean };

  verify(
    tx: IBaseTransaction<any>,
    sender: IAccountsModel,
    requester: IAccountsModel,
    height: number
  ): Promise<void>;

  /**
   * Verifies the given signature (both first and second)
   * @param {IBaseTransaction<any>} tx
   * @param {Buffer} publicKey
   * @param {string} signature
   * @param {VerificationType} verificationType
   * @returns {boolean} true
   */
  verifySignature(
    tx: IBaseTransaction<any>,
    publicKey: Buffer,
    signature: Buffer,
    verificationType: VerificationType
  ): boolean;

  apply(
    tx: IBaseTransaction<any>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>>;

  /**
   * Merges account into sender address and calls undo to txtype
   * @returns {Promise<void>}
   */
  undo(
    tx: IBaseTransaction<any, bigint>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>>;

  applyUnconfirmed(
    tx: IBaseTransaction<any, bigint>,
    sender: IAccountsModel,
    requester?: IAccountsModel
  ): Promise<Array<DBOp<any>>>;

  /**
   * Merges account into sender address with unconfirmed balance tx amount
   * Then calls undoUnconfirmed to the txType.
   */
  undoUnconfirmed(
    tx: IBaseTransaction<any, bigint>,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>>;

  dbSave(
    txs: Array<IBaseTransaction<any>>,
    blockId: string,
    height: number
  ): Array<DBOp<any>>;

  afterSave(tx: IBaseTransaction<any>): Promise<void>;

  /**
   * Epurates the tx object by removing null and undefined fields
   * Pass it through schema validation and then calls subtype objectNormalize.
   */
  objectNormalize(
    tx:
      | IBaseTransaction<any, string | number | bigint>
      | ITransportTransaction<any>
  ): IBaseTransaction<any, bigint>;

  fromProtoBuffer(buff: Buffer): IBaseTransaction<any, bigint>;

  toProtoBuffer(tx: IBaseTransaction<any>): Buffer;
  /**
   * Attach Asset object to each transaction passed
   * @param {Array<IBaseTransaction<any>>} txs
   * @return {Promise<void>}
   */
  attachAssets(txs: Array<IBaseTransaction<any>>): Promise<void>;

  /**
   * Gets maximum size in bytes for a transaction. Used in Protocol Buffer response space allocation calculations.
   * @returns {number} maximum bytes size
   */
  getMaxBytesSize(): number;

  /**
   * Gets minimum size in bytes for a transaction. Used in Protocol Buffer response space allocation calculations.
   * @returns {number} minimum bytes size
   */
  getMinBytesSize(): number;

  /**
   * Gets maximum size in bytes for a specific transaction type. Used in Protocol Buffer response space allocation.
   * @param {number} txType numeric identifier of the transaction type
   * @returns {number} maximum bytes size for this type
   */
  getByteSizeByTxType(txType: number): number;
}
