import { WhereOptions } from 'sequelize';
import { As } from 'type-tagger';
import { Omit } from 'utility-types';

import { Address, DBOp } from '../../types';
import { IAccountsModel } from '../models';

// tslint:disable-next-line
export type AccountFilterData<T extends IAccountsModel = IAccountsModel> = Omit<
  { [k in keyof T]?: T[k] | WhereOptions },
  'address'
> & {
  address?: string | { $in: string[] };
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
   * @param {object} diff
   * @returns {Promise<any>}
   */
  mergeBalanceDiff(
    address: Address,
    diff: { balance?: bigint; u_balance?: bigint }
  ): Array<DBOp<any>>;

  generateAddressFromPubData(pubData: Buffer): string & As<'address'>;
}
