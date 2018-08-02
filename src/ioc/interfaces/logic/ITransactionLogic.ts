import BigNumber from 'bignumber.js';
import { Transaction } from 'sequelize';
import { Model } from 'sequelize-typescript';
import { IKeypair } from '../../../helpers';
import { SignedBlockType } from '../../../logic';
import {
  BaseTransactionType,
  IBaseTransaction,
  IBytesTransaction,
  IConfirmedTransaction,
  ITransportTransaction
} from '../../../logic/transactions';
import { AccountsModel } from '../../../models/';
import { DBOp } from '../../../types/genericTypes';

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

  attachAssetType<K, M extends Model<any>>(instance: BaseTransactionType<K, M>): BaseTransactionType<K, M>;

  /**
   * Creates and returns signature
   * @returns {string} signature
   */
  sign(keypair: IKeypair, tx: IBaseTransaction<any>): void;

  /**
   * Creates a signature based on multisignatures
   * @returns {string} signature
   */
  multiSign(keypair: IKeypair, tx: IBaseTransaction<any>): void;

  /**
   * Calculate tx id
   * @returns {string} the id.
   */
  getId(tx: IBaseTransaction<any>): string;

  /**
   * Hash for the transaction
   */
  getHash(tx: IBaseTransaction<any>, skipSign: boolean, skipSecondSign: boolean): Buffer;

  /**
   * Return the transaction bytes.
   * @returns {Buffer}
   */
  getBytes(tx: IBaseTransaction<any>,
           skipSignature?: boolean, skipSecondSignature?: boolean): Buffer;

  ready(tx: IBaseTransaction<any>, sender: AccountsModel): boolean;

  assertKnownTransactionType(type: number): void;

  /**
   * Checks if balanceKey is less than amount for sender
   */
  checkBalance(amount: number | BigNumber, balanceKey: 'balance' | 'u_balance',
               tx: IConfirmedTransaction<any> | IBaseTransaction<any>,
               sender: any): { error: string; exceeded: boolean };

  verify(tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: AccountsModel,
         requester: AccountsModel, height: number): Promise<void>;

  /**
   * Verifies the given signature (both first and second)
   * @param {IBaseTransaction<any>} tx
   * @param {Buffer} publicKey
   * @param {string} signature
   * @param {VerificationType} verificationType
   * @returns {boolean} true
   */
  verifySignature(tx: IBaseTransaction<any>, publicKey: Buffer, signature: Buffer, verificationType: VerificationType): boolean;

  apply(tx: IConfirmedTransaction<any>, block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>>;

  /**
   * Merges account into sender address and calls undo to txtype
   * @returns {Promise<void>}
   */
  undo(tx: IConfirmedTransaction<any>, block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>>;

  applyUnconfirmed(tx: IBaseTransaction<any>, sender: AccountsModel, requester?: AccountsModel): Promise<Array<DBOp<any>>>;

  /**
   * Merges account into sender address with unconfirmed balance tx amount
   * Then calls undoUnconfirmed to the txType.
   */
  undoUnconfirmed(tx: IBaseTransaction<any>, sender: AccountsModel): Promise<Array<DBOp<any>>>;

  dbSave(txs: Array<IBaseTransaction<any> & {senderId: string}>, blockId: string, height: number): Array<DBOp<any>>;

  afterSave(tx: IBaseTransaction<any>): Promise<void>;

  /**
   * Epurates the tx object by removing null and undefined fields
   * Pass it through schema validation and then calls subtype objectNormalize.
   */
  objectNormalize(tx: IConfirmedTransaction<any>): IConfirmedTransaction<any>;
  objectNormalize(tx: ITransportTransaction<any> | IBaseTransaction<any>): IBaseTransaction<any>;

  dbRead(raw: any): IConfirmedTransaction<any>;

  fromBytes(tx: IBytesTransaction): IBaseTransaction<any>;
  /**
   * Attach Asset object to each transaction passed
   * @param {Array<IConfirmedTransaction<any>>} txs
   * @return {Promise<void>}
   */
  attachAssets(txs: Array<IConfirmedTransaction<any>>): Promise<void>;
}
