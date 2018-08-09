import { DBOp, FieldsInModel, IBaseTransaction, publicKey } from '@risevision/core-types';
import { AccountDiffType, AccountFilterData } from '../logic';
import { IAccountsModel } from '../models';
import { IModule } from './IModule';

export interface IAccountsModule<T extends IAccountsModel = IAccountsModel> extends IModule {

  resolveAccountsForTransactions(txs: Array<IBaseTransaction<any>>): Promise<{ [address: string]: T }>;

  getAccount(filter: AccountFilterData): Promise<T>;

  getAccounts(filter: AccountFilterData): Promise<T[]>;

  /**
   * Sets some data to specific account
   */
  // tslint:disable-next-line max-line-length
  setAccountAndGet(data: Partial<T>  & ({ publicKey: Buffer } | { address: string })): Promise<T>;

  mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>>;

  generateAddressByPublicKey(pk: Buffer): string;
}
