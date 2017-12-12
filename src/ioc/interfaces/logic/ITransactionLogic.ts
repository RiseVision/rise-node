import BigNumber from 'bignumber.js';
import { IKeypair, TransactionType } from '../../../helpers';
import { MemAccountsData, SignedBlockType } from '../../../logic';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from '../../../logic/transactions';

export interface ITransactionLogic {

  attachAssetType<K>(instance: BaseTransactionType<K>): BaseTransactionType<K>;

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

  ready(tx: IBaseTransaction<any>, sender: MemAccountsData): boolean;

  assertKnownTransactionType(tx: IBaseTransaction<any>): void;

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
  process<T = any>(tx: IBaseTransaction<T>, sender: any, requester: string): Promise<IBaseTransaction<T>>;

  verify(tx: IConfirmedTransaction<any> | IBaseTransaction<any>, sender: MemAccountsData,
         requester: any, height: number): Promise<void>;

  /**
   * Verifies the given signature (both first and second)
   * @param {IBaseTransaction<any>} tx
   * @param {string} publicKey
   * @param {string} signature
   * @param {boolean} isSecondSignature if true, then this will check agains secondsignature
   * @returns {boolean} true
   */
  verifySignature(tx: IBaseTransaction<any>, publicKey: string, signature: string,
                  isSecondSignature?: boolean): boolean;

  apply(tx: IConfirmedTransaction<any>, block: SignedBlockType, sender: any): Promise<void>;

  /**
   * Merges account into sender address and calls undo to txtype
   * @returns {Promise<void>}
   */
  undo(tx: IConfirmedTransaction<any>, block: SignedBlockType, sender: any): Promise<void>;

  applyUnconfirmed(tx: IBaseTransaction<any>, sender: any, requester?: any): Promise<void>;

  /**
   * Merges account into sender address with unconfirmed balance tx amount
   * Then calls undoUnconfirmed to the txType.
   */
  undoUnconfirmed(tx: IBaseTransaction<any>, sender: any): Promise<void>;

  dbSave(tx: IConfirmedTransaction<any> & { senderId: string }): Array<{
    table: string, fields: string[], values: any
  }>;

  afterSave(tx: IBaseTransaction<any>): Promise<void>;

  /**
   * Epurates the tx object by removing null and undefined fields
   * Pass it through schema validation and then calls subtype objectNormalize.
   */
  objectNormalize(tx: IBaseTransaction<any>): IBaseTransaction<any>;

  dbRead(raw: any): IConfirmedTransaction<any>;
}
