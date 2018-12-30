import {
  DBOp,
  IBaseTransaction,
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

  fullBytes(tx: IBaseTransaction<T>): Buffer;

  signableBytes(tx: IBaseTransaction<T>): Buffer;

  assetBytes(tx: IBaseTransaction<T>): Buffer;

  readAssetFromBytes(bytes: Buffer): T;

  fromBytes(buff: Buffer): IBaseTransaction<T, bigint>;

  apply(
    tx: IBaseTransaction<T>,
    block: SignedBlockType,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>>;

  applyUnconfirmed(
    tx: IBaseTransaction<T>,
    sender: IAccountsModel
  ): Promise<Array<DBOp<any>>>;

  undo(
    tx: IBaseTransaction<T>,
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

  attachAssets(txs: Array<IBaseTransaction<T>>): Promise<void>;
}
