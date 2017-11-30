import { publicKey } from '../../../types/sanityTypes';
import { AccountFilterData, MemAccountsData } from '../../../logic';
import { IModule } from './IModule';

export interface IAccountsModule extends IModule {
  getAccount(filter: AccountFilterData, fields?: Array<(keyof MemAccountsData)>): Promise<MemAccountsData>;

  getAccounts(filter: AccountFilterData, fields: Array<(keyof MemAccountsData)>): Promise<MemAccountsData[]>;

  /**
   * Sets some data to specific account
   */
  setAccountAndGet(data: ({ publicKey: string } | { address: string }) & { [k: string]: any }): Promise<MemAccountsData>;

  mergeAccountAndGetSQL(diff: any): string;

  mergeAccountAndGet(diff: any): Promise<MemAccountsData>;

  generateAddressByPublicKey(pk: publicKey): string;
}