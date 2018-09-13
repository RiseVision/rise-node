import { DBOp, FieldsInModel, IBaseTransaction, publicKey } from '@risevision/core-types';
import { AccountDiffType, AccountFilterData } from '../logic';
import { IAccountsModel } from '../models';
import { IModule } from './IModule';

export interface IAccountsModule<T extends IAccountsModel = IAccountsModel> extends IModule {

  unfoldSenders(txs: Array<IBaseTransaction<any>>): Array<{address: string, publicKey: Buffer}>;

  txAccounts(txs: Array<IBaseTransaction<any>>): Promise<{ [address: string]: T }>;

  checkTXsAccountsMap(txs: Array<IBaseTransaction<any>>, accMap: { [address: string]: T }): Promise<void>;

  getAccount(filter: AccountFilterData): Promise<T>;

  getAccounts(filter: AccountFilterData): Promise<T[]>;

  /**
   * Assign public key to the account
   */
  assignPublicKeyToAccount(opts: {address?: string, publicKey: Buffer}): Promise<T>;

  mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>>;

  generateAddressByPublicKey(pk: Buffer): string;
}
