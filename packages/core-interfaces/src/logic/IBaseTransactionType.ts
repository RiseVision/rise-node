import {
  DBOp,
  IBaseTransaction,
  IConfirmedTransaction,
  SignedBlockType,
  TransactionType,
} from '@risevision/core-types';
import { Model } from 'sequelize-typescript';
import { IAccountsModel } from '../models';

export interface IBaseTransactionType<T, M extends Model<any>> {
  readonly type: TransactionType;

  calculateFee(
    tx: IBaseTransaction<T>,
    sender: IAccountsModel,
    height: number
  ): bigint;

  verify(tx: IBaseTransaction<T>, sender: IAccountsModel): Promise<void>;

  getBytes(
    tx: IBaseTransaction<T>,
    skipSignature: boolean,
    skipSecondSignature: boolean
  ): Buffer;

  apply(
    tx: IConfirmedTransaction<T>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>>;

  applyUnconfirmed(
    tx: IBaseTransaction<T>,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>>;

  undo(
    tx: IConfirmedTransaction<T>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>>;

  undoUnconfirmed(
    tx: IBaseTransaction<T>,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>>;

  objectNormalize(tx: IBaseTransaction<T>): IBaseTransaction<T>;

  // tslint:disable-next-line max-line-length
  dbSave(
    tx: IBaseTransaction<T> & { senderId: string },
    blockId?: string,
    height?: number
  ): DBOp<M>;

  afterSave(tx: IBaseTransaction<T>): Promise<void>;

  ready(tx: IBaseTransaction<T>, sender: IAccountsModel): Promise<boolean>;

  attachAssets(txs: Array<IConfirmedTransaction<T>>): Promise<void>;
}
