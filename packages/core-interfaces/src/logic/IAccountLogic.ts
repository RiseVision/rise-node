import { DBOp, FieldsInModel, publicKey } from '@risevision/core-types';
import { IAccountsModel } from '../models';

// tslint:disable-next-line
export type AccountFilterData = {
  isDelegate?: 1 | 0;
  username?: string;
  address?: string | { $in: string[] };
  publicKey?: Buffer;
  limit?: number;
  offset?: number;
  sort?: string | { [k: string]: -1 | 1 };
};

export type AccountDiffType = {
  [k in keyof IAccountsModel]?: IAccountsModel[k]
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

  generateAddressByPublicKey(pk: Buffer): string;
}
