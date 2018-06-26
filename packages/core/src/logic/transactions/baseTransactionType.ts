import { injectable, unmanaged } from 'inversify';
import { IDatabase } from 'pg-promise';
import { Model } from 'sequelize-typescript';
import { TransactionType } from '../../helpers/';
import { AccountsModel } from '../../models/';
import { SignedBlockType } from '../block';
import { DBOp } from '../../types/genericTypes';



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

  public apply(tx: IConfirmedTransaction<T>, block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  public applyUnconfirmed(tx: IBaseTransaction<T>, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  public undo(tx: IConfirmedTransaction<T>, block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  public undoUnconfirmed(tx: IBaseTransaction<T>, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    return Promise.resolve([]);
  }

  public abstract objectNormalize(tx: IBaseTransaction<T>): IBaseTransaction<T>;

  public abstract dbRead(raw: any): T;

  // tslint:disable-next-line max-line-length
  public abstract dbSave(tx: IBaseTransaction<T> & { senderId: string }, blockId?: string, height?: number): DBOp<M>;

  public afterSave(tx: IBaseTransaction<T>): Promise<void> {
    return Promise.resolve();
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

  /**
   * Fetchs Assets From Datastore and returns the same txs with the asset field properly populated.
   * @param {Array<IBaseTransaction<T>>} txs
   * @return {Promise<Array<IBaseTransaction<T>>>}
   */
  public attachAssets(txs: Array<IConfirmedTransaction<T>>): Promise<void> {
    return Promise.resolve();
  }

}
