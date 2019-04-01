import { As } from 'type-tagger';

import { DBOp, IBaseTransaction } from '../../types';
import { AccountDiffType, AccountFilterData } from '../logic';
import { IAccountsModel } from '../models';

export interface IAccountsModule<T extends IAccountsModel = IAccountsModel> {
  unfoldSenders(
    txs: Array<IBaseTransaction<any>>
  ): Array<string & As<'address'>>;

  txAccounts(
    txs: Array<IBaseTransaction<any>>
  ): Promise<{ [address: string]: T }>;

  checkTXsAccountsMap(
    txs: Array<IBaseTransaction<any>>,
    accMap: { [address: string]: T }
  ): Promise<void>;

  getAccount(filter: AccountFilterData<T>): Promise<T>;

  getAccounts(filter: AccountFilterData<T>): Promise<T[]>;

  generateAddressByPubData(pd: Buffer): string & As<'address'>;
}
