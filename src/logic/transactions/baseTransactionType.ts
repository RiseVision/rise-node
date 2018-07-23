import { injectable, unmanaged } from 'inversify';
import { IDatabase } from 'pg-promise';
import { Model } from 'sequelize-typescript';
import { TransactionType } from '../../helpers/';
import { AccountsModel } from '../../models/';
import { SignedBlockType } from '../block';
import { DBOp } from '../../types/genericTypes';

export interface ITransportTransaction<T> {
  type: TransactionType;
  amount: number;
  senderId?: string;
  senderPublicKey: string;
  requesterPublicKey?: string;
  timestamp: number;
  asset?: T;
  recipientId: string;
  signature: string;
  id: string;
  fee: number;
  signatures?: string[];
  signSignature?: string;
}

export interface IBaseTransaction<T> {
  type: TransactionType;
  amount: number;
  senderId?: string;
  senderPublicKey: Buffer;
  requesterPublicKey?: Buffer;
  timestamp: number;
  asset?: T;
  recipientId: string;
  signature: Buffer;
  id: string;
  fee: number;
  signatures?: string[];
  signSignature?: Buffer;
}

export interface IConfirmedTransaction<T> extends IBaseTransaction<T> {
  blockId: string;
  height?: number;
  senderId: string;
  recipientPublicKey?: string;
  confirmations?: number;
}

const emptyBuffer = new Buffer(0);

/**
 * Describes a Base Transaction Object
 */
@injectable()
export abstract class BaseTransactionType<T, M extends Model<any>> {

  constructor(@unmanaged() private txType: TransactionType) {
  }

  /**
   * Returns the transaction type
   */
  public get type(): TransactionType {
    return this.txType;
  }

  /**
   * Returns fees from a given height
   */
  public abstract calculateFee(tx: IBaseTransaction<T>, sender: AccountsModel, height: number): number;

  /**
   * Verify a transaction
   */
  public verify(tx: IBaseTransaction<T>, sender: AccountsModel): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Calculates bytes of assets
   */
  public getBytes(tx: IBaseTransaction<T>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
    return emptyBuffer;
  }

  /**
   * Prepares an update on AccountsModel from transaction data
   */
  public apply(tx: IConfirmedTransaction<T>, block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  /**
   * Prepares an update of unconfirmed fields on AccountsModel from transaction data
   */
  public applyUnconfirmed(tx: IBaseTransaction<T>, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  /**
   * Undo the update on AccountsModel
   */
  public undo(tx: IConfirmedTransaction<T>, block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  /**
   * Undo the update of unconfirmed fields on AccountsModel
   */
  public undoUnconfirmed(tx: IBaseTransaction<T>, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  /**
   * Validate assets using their schemas
   */
  public abstract objectNormalize(tx: IBaseTransaction<T>): IBaseTransaction<T>;

  /**
   * Returns data from a raw object
   */
  public abstract dbRead(raw: any): T;

  /**
   * create a new record on database
   */
  // tslint:disable-next-line max-line-length
  public abstract dbSave(tx: IBaseTransaction<T> & { senderId: string }, blockId?: string, height?: number): DBOp<M>;

  /**
   * After save actions
   */
  public afterSave(tx: IBaseTransaction<T>): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Returns true if the transaction is ready
   */
  public ready(tx: IBaseTransaction<T>, sender: AccountsModel): boolean {
    if (Array.isArray(sender.multisignatures) && sender.multisignatures.length) {
      if (!Array.isArray(tx.signatures)) {
        return false;
      }
      return tx.signatures.length >= sender.multimin;
    } else {
      return true;
    }
  }

  /**
   * Fetchs Assets From Datastore and returns the same txs with the asset field properly populated.
   * @param {Array<IBaseTransaction<T>>} txs
   * @return {Promise<Array<IBaseTransaction<T>>>}
   */
  public attachAssets(txs: Array<IConfirmedTransaction<T>>): Promise<void> {
    return Promise.resolve();
  }

}
