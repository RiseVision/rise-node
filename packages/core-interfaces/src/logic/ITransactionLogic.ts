import {
  DBOp,
  IBaseTransaction,
  ITransportTransaction,
  SignedBlockType,
} from '@risevision/core-types';
import { Model } from 'sequelize-typescript';
import { IAccountsModel } from '../models';
import { IBaseTransactionType } from './IBaseTransactionType';

export interface ITransactionLogic {
  attachAssetType<K, M extends Model<any>>(
    instance: IBaseTransactionType<K, M>
  ): IBaseTransactionType<K, M>;

  /**
   * Hash for the transaction
   */
  getHash(tx: IBaseTransaction<any>): Buffer;

  ready(tx: IBaseTransaction<any>, sender: IAccountsModel): Promise<boolean>;

  assertKnownTransactionType(type: number): void;

  /**
   * Checks if balanceKey is less than amount for sender
   */
  assertEnoughBalance(
    amount: bigint,
    balanceKey: 'balance' | 'u_balance',
    tx: IBaseTransaction<any>,
    sender: IAccountsModel
  ): void;

  verify(
    tx: IBaseTransaction<any>,
    sender: IAccountsModel,
    height: number
  ): Promise<void>;

  /**
   * Verifies the given signature (both first and second)
   * @param {IBaseTransaction<any>} tx
   * @param {Buffer} publicKey
   * @param {string} signature
   * @returns {boolean} true
   */
  verifySignature(
    tx: IBaseTransaction<any>,
    publicKey: Buffer,
    signature: Buffer
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
    sender: IAccountsModel
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

  /**
   * Attach Asset object to each transaction passed
   * @param {Array<IBaseTransaction<any>>} txs
   * @return {Promise<void>}
   */
  attachAssets(txs: Array<IBaseTransaction<any>>): Promise<void>;

  findConflicts(
    txs: Array<IBaseTransaction<any>>
  ): Promise<Array<IBaseTransaction<any>>>;

  /**
   * Gets maximum size in bytes for a transaction. Used in Protocol Buffer response space allocation calculations.
   * @returns {number} maximum bytes size
   */
  getMaxBytesSize(): number;
}
