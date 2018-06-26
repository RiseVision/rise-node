import { DBOp, FieldsInModel, IBaseTransaction, publicKey } from '@risevision/core-types';
import { IModule } from './IModule';
import { AccountsModel } from '../../../core-models/src';
import { IAccountsModel } from '../models';


export interface IAccountsModule extends IModule {

  resolveAccountsForTransactions(txs: Array<IBaseTransaction<any>>): Promise<{ [address: string]: AccountsModel }>;

  getAccount(filter: AccountFilterData, fields?: FieldsInModel<IAccountsModel>): Promise<IAccountsModel>;

  getAccounts(filter: AccountFilterData, fields: FieldsInModel<IAccountsModel>): Promise<IAccountsModel[]>;

  /**
   * Sets some data to specific account
   */
  // tslint:disable-next-line max-line-length
  setAccountAndGet(data: Partial<AccountsModel>  & ({ publicKey: Buffer } | { address: string })): Promise<AccountsModel>;

  mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>>;

  /**
   * @deprecated
   */
  generateAddressByPublicKey(pk: publicKey|Buffer): string;
}
