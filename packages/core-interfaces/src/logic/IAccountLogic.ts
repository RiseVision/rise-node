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
  sort?: string | { [k: string]: -1 | 1 }
};

export type AccountDiffType = {[k in keyof IAccountsModel]?: IAccountsModel[k]} & {round?: number};
export interface IAccountLogic {
  objectNormalize(account: any);

  /**
   * Creates memory tables related to accounts
   */
  createTables(): Promise<void>;

  /**
   * Removes content of memory tables
   */
  removeTables(): Promise<void>;

  /**
   * Verifies the validity of a publickey.
   * @param {publicKey} pk
   * @param {boolean} allowUndefined if true undefined does not throw error.
   */
  assertPublicKey(pk: publicKey, allowUndefined?: boolean);

  /**
   * Get account information for specific fields and filtering criteria
   */
  get(filter: AccountFilterData, fields?: FieldsInModel<IAccountsModel>): Promise<IAccountsModel>;

  /**
   * Get accountS information for specific fields and filtering criteria.
   */
  getAll(filter: AccountFilterData,
         fields?: FieldsInModel<IAccountsModel>): Promise<IAccountsModel[]>;

  /**
   * Sets fields for specific address in mem_accounts table
   * @param {string} address
   * @param fields
   */
  set(address: string, fields: { [k: string]: any });

  /**
   * Updates account from mem_account with diff data belongings to an editable field
   * Inserts into mem_round "address", "amount", "delegate", "blockId", "round"
   * based on field balance or delegates.
   * @param {string} address
   * @param {MemAccountsData} diff
   * @returns {Promise<any>}
   */
  merge(address: string, diff: AccountDiffType): Array<DBOp<any>>;

  /**
   * Removes an account from mem_account table based on address.
   * @param {string} address
   * @param {cback<string>} cb
   * @returns {Promise<number>} returns number of removed elements 0 if nothing was removed.
   */
  remove(address: string): Promise<number>;

  generateAddressByPublicKey(pk: publicKey | Buffer): string;
}
