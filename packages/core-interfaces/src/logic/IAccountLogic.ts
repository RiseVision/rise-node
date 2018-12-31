import { DBOp } from '@risevision/core-types';
import { WhereLogic } from 'sequelize';
import * as sequelize from 'sequelize';
import { Omit } from 'utility-types';
import { IAccountsModel } from '../models';

// tslint:disable-next-line
export type AccountFilterData<T extends IAccountsModel = IAccountsModel> = Omit<
  { [k in keyof T]?: T[k] | WhereLogic },
  'address'
> & {
  address?: string | { $in: string[] };
  publicKey?: Buffer | sequelize.WhereLogic;
  limit?: number;
  offset?: number;
  sort?: { [k in keyof T]?: -1 | 1 };
};

export type AccountDiffType<IAM = IAccountsModel> = {
  [k in keyof IAM]?: IAM[k]
} & { round?: number };

export interface IAccountLogic<T extends IAccountsModel = IAccountsModel> {
  /**
   * Updates account from mem_account with diff data belongings to an editable field
   * Inserts into mem_round "address", "amount", "delegate", "blockId", "round"
   * based on field balance or delegates.
   * @param {string} address
   * @param {MemAccountsData} diff
   * @returns {Promise<any>}
   */
  merge(address: string, diff: AccountDiffType): Array<DBOp<any>>;

  generateAddressFromPubData(pubData: Buffer): string;
}
