import { cback } from '../../../helpers';
import { AccountFilterData, MemAccountsData } from '../../../logic';
import { publicKey } from '../../../types/sanityTypes';

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
   * Convert data to sql ready stuff such as binary conversion
   */
  toDB(raw: any): any;

  /**
   * Get account information for specific fields and filtering criteria
   */
  get(filter: AccountFilterData, cb?: cback<MemAccountsData>): Promise<MemAccountsData>;

  get(filter: AccountFilterData, fields: Array<(keyof MemAccountsData)>,
      cb?: cback<MemAccountsData>): Promise<MemAccountsData>;

  /**
   * Get accountS information for specific fields and filtering criteria.
   */
  getAll(filter: AccountFilterData,
         cb: cback<any>): Promise<any[]>;

  getAll(filter: AccountFilterData,
         fields: Array<(keyof MemAccountsData)>, cb?: cback<any>): Promise<any[]>;

  /**
   * Sets fields for specific address in mem_accounts table
   * @param {string} address
   * @param fields
   * @param {cback<any>} cb
   */
  set(address: string, fields: { [k: string]: any }, cb?: cback<any>);

  /**
   * Updates account from mem_account with diff data belongings to an editable field
   * Inserts into mem_round "address", "amount", "delegate", "blockId", "round"
   * based on field balance or delegates.
   * @param {string} address
   * @param {MemAccountsData} diff
   * @param {cback<any>} cb
   * @returns {Promise<any>}
   */
  merge(address: string, diff: any): string;

  merge(address: string, diff: any, cb: cback<any>): Promise<any>;

  /**
   * Removes an account from mem_account table based on address.
   * @param {string} address
   * @param {cback<string>} cb
   * @returns {Promise<string>}
   */
  remove(address: string, cb: cback<string>): Promise<string>;

  generateAddressByPublicKey(pk: publicKey): string;
}
