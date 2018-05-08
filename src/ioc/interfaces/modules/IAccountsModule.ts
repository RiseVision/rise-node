import { AccountFilterData, MemAccountsData, OptionalsMemAccounts } from '../../../logic';
import { AccountsModel } from '../../../models/';
import { publicKey } from '../../../types/sanityTypes';
import { FieldsInModel } from '../../../types/utils';
import { IModule } from './IModule';
import { AccountDiffType } from '../logic/';
import { DBOp } from '../../../types/genericTypes';

export interface IAccountsModule extends IModule {
  getAccount(filter: AccountFilterData, fields?: FieldsInModel<AccountsModel>): Promise<AccountsModel>;

  getAccounts(filter: AccountFilterData, fields: FieldsInModel<AccountsModel>): Promise<AccountsModel[]>;

  /**
   * Sets some data to specific account
   */
  // tslint:disable-next-line max-line-length
  setAccountAndGet(data: Partial<AccountsModel>  & ({ publicKey: Buffer } | { address: string })): Promise<AccountsModel>;

  mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>>;

  mergeAccountAndGet(diff: AccountDiffType): Promise<AccountsModel>;

  /**
   * @deprecated
   */
  generateAddressByPublicKey(pk: publicKey|Buffer): string;
}
