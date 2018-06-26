import { DBOp, FieldsInModel, IBaseTransaction, publicKey } from '@risevision/core-types';
import { AccountDiffType, AccountFilterData } from '../logic';
import { IAccountsModel } from '../models';
import { IModule } from './IModule';

export interface IAccountsModule extends IModule {

  resolveAccountsForTransactions(txs: Array<IBaseTransaction<any>>): Promise<{ [address: string]: IAccountsModel }>;

  getAccount(filter: AccountFilterData, fields?: FieldsInModel<IAccountsModel>): Promise<IAccountsModel>;

  getAccounts(filter: AccountFilterData, fields: FieldsInModel<IAccountsModel>): Promise<IAccountsModel[]>;

  /**
   * Sets some data to specific account
   */
  // tslint:disable-next-line max-line-length
  setAccountAndGet(data: Partial<IAccountsModel>  & ({ publicKey: Buffer } | { address: string })): Promise<IAccountsModel>;

  mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>>;

  /**
   * @deprecated
   */
  generateAddressByPublicKey(pk: publicKey|Buffer): string;
}
