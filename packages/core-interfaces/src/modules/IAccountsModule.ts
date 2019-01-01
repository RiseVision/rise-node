import {
  DBOp,
  FieldsInModel,
  IBaseTransaction,
  publicKey,
} from '@risevision/core-types';
import { Omit } from 'utility-types';
import { AccountDiffType, AccountFilterData } from '../logic';
import { IAccountsModel } from '../models';
import { IModule } from './IModule';

export interface IAccountsModule<T extends IAccountsModel = IAccountsModel> {
  unfoldSenders(
    txs: Array<IBaseTransaction<any>>
  ): Array<{ address: string; pubData: Buffer }>;

  txAccounts(
    txs: Array<IBaseTransaction<any>>
  ): Promise<{ [address: string]: T }>;

  checkTXsAccountsMap(
    txs: Array<IBaseTransaction<any>>,
    accMap: { [address: string]: T }
  ): Promise<void>;

  getAccount(filter: AccountFilterData<T>): Promise<T>;

  getAccounts(filter: AccountFilterData<T>): Promise<T[]>;

  mergeAccountAndGetOPs(diff: AccountDiffType<T>): Array<DBOp<any>>;

  generateAddressByPubData(pd: Buffer): string;
}
