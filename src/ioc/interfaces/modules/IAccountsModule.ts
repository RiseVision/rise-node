import { AccountFilterData, MemAccountsData, OptionalsMemAccounts } from '../../../logic';
import { AccountsModel } from '../../../models/';
import { publicKey } from '../../../types/sanityTypes';
import { FieldsInModel } from '../../../types/utils';
import { IModule } from './IModule';
import { AccountDiffType } from '../logic/';
import { DBOp } from '../../../types/genericTypes';
import { IBaseTransaction } from '../../../logic/transactions';

/**
 * Methods signature for AccountsModule
 */
export interface IAccountsModule extends IModule {

  /**
   * Returns senders from the given transactions
   */
  resolveAccountsForTransactions(txs: Array<IBaseTransaction<any>>): Promise<{ [address: string]: AccountsModel }>;

  /**
   * Find an account from the given filters
   */
  getAccount(filter: AccountFilterData, fields?: FieldsInModel<AccountsModel>): Promise<AccountsModel>;

  /**
   * Find accounts from the given filters
   */
  getAccounts(filter: AccountFilterData, fields: FieldsInModel<AccountsModel>): Promise<AccountsModel[]>;

  /**
   * Sets some data to specific account
   */
  // tslint:disable-next-line max-line-length
  setAccountAndGet(data: Partial<AccountsModel>  & ({ publicKey: Buffer } | { address: string })): Promise<AccountsModel>;

  /**
   * Update an account with the values received from the given diff
   */
  mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>>;

  /**
   * @deprecated
   */
  generateAddressByPublicKey(pk: publicKey|Buffer): string;
}
