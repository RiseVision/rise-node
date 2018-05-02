import BigNumber from 'bignumber.js';
import { Transaction } from 'sequelize';
import { Model } from 'sequelize-typescript';
import { IKeypair } from '../../../helpers';
import { SignedBlockType } from '../../../logic';
import {
  BaseTransactionType,
  IBaseTransaction,
  IConfirmedTransaction,
  ITransportTransaction
} from '../../../logic/transactions';
import { AccountsModel } from '../../../models/';
import { DBOp } from '../../../types/genericTypes';

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
   * Counts transaction by id
   * @returns {Promise<number>}
   */
  countById(tx: IBaseTransaction<any>): Promise<number>;

  /**
   * Checks the tx is not confirmed or rejects otherwise
   */
  assertNonConfirmed(tx: IBaseTransaction<any>): Promise<void>;

  /**
   * Checks if balanceKey is less than amount for sender
   */
  checkBalance(amount: number | BigNumber, balanceKey: 'balance' | 'u_balance',
               tx: IConfirmedTransaction<any> | IBaseTransaction<any>,
               sender: any): { error: string; exceeded: boolean };

  /**
   * Performs some validation on the transaction and calls process
   * to the respective tx type.
   */
  // tslint:disable max-line-length
  process<T = any>(tx: IBaseTransaction<T>, sender: AccountsModel, requester: AccountsModel): Promise<IBaseTransaction<T>>;

  verify(tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: AccountsModel,
         requester: AccountsModel, height: number): Promise<void>;

  /**
   * Verifies the given signature (both first and second)
   * @param {IBaseTransaction<any>} tx
   * @param {Buffer} publicKey
   * @param {string} signature
   * @param {boolean} isSecondSignature if true, then this will check agains secondsignature
   * @returns {boolean} true
   */
  verifySignature(tx: IBaseTransaction<any>, publicKey: Buffer, signature: Buffer,
                  isSecondSignature?: boolean): boolean;

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

  dbSave(tx: IConfirmedTransaction<any> & { senderId: string }): Array<DBOp<any>>;

  afterSave(tx: IBaseTransaction<any>): Promise<void>;

  /**
   * Epurates the tx object by removing null and undefined fields
   * Pass it through schema validation and then calls subtype objectNormalize.
   */
  objectNormalize(tx: IConfirmedTransaction<any>): IConfirmedTransaction<any>;
  objectNormalize(tx: ITransportTransaction<any> | IBaseTransaction<any>): IBaseTransaction<any>;

  dbRead(raw: any): IConfirmedTransaction<any>;

  /**
   * Restores the tx asset field as it was originally broadcastes/crafted
   */
  restoreAsset<T = any>(tx: IConfirmedTransaction<void>): Promise<IConfirmedTransaction<T>>;
  restoreAsset<T = any>(tx: IBaseTransaction<void>): Promise<IBaseTransaction<T>>;

}
