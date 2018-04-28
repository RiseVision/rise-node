import { injectable, unmanaged } from 'inversify';
import { IDatabase } from 'pg-promise';
import { Model } from 'sequelize-typescript';
import { TransactionType } from '../../helpers/';
import { AccountsModel } from '../../models/';
import { SignedBlockType } from '../block';
import { DBOp } from '../../types/genericTypes';

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
  height: number;
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

  public get type(): TransactionType {
    return this.txType;
  }

  public abstract calculateFee(tx: IBaseTransaction<T>, sender: AccountsModel, height: number): number;

  public verify(tx: IBaseTransaction<T>, sender: AccountsModel): Promise<void> {
    return Promise.resolve();
  }

  public getBytes(tx: IBaseTransaction<T>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
    return emptyBuffer;
  }

  public apply(tx: IConfirmedTransaction<T>, block: SignedBlockType, sender: AccountsModel): Promise<void> {
    return Promise.resolve();
  }

  public applyUnconfirmed(tx: IBaseTransaction<T>, sender: AccountsModel): Promise<void> {
    return Promise.resolve();
  }

  public undo(tx: IConfirmedTransaction<T>, block: SignedBlockType, sender: AccountsModel): Promise<void> {
    return Promise.resolve();
  }

  public undoUnconfirmed(tx: IBaseTransaction<T>, sender: AccountsModel): Promise<void> {
    return Promise.resolve();
  }

  public abstract objectNormalize(tx: IBaseTransaction<T>): IBaseTransaction<T>;

  public abstract dbRead(raw: any): T;

  // tslint:disable-next-line max-line-length
  public abstract dbSave(tx: IConfirmedTransaction<T> & { senderId: string }): DBOp<M>;

  public afterSave(tx: IBaseTransaction<T>): Promise<void> {
    return Promise.resolve();
  }

  public restoreAsset(tx: IBaseTransaction<any>, db: IDatabase<any>): Promise<IBaseTransaction<T>> {
    return Promise.resolve(tx);
  }

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

}
