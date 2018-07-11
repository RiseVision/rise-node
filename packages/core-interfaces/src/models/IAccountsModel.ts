import { address, publicKey } from '@risevision/core-types';
import { IBaseModel } from './IBaseModel';

export class IAccountsModel extends IBaseModel<IAccountsModel> {
  public address: string;
  public publicKey: Buffer;
  public balance: number;
  public blockId: string;
  public producedblocks: number;
  public missedblocks: number;
  public fees: number;
  public rewards: number;
  public virgin: 0 | 1;
  public u_balance: number;

  readonly hexPublicKey: publicKey;

  // public isMultisignature(): boolean {
  //   return null;
  // };

  public toPOJO(): { [k: string]: string | number } {
    return null;
  }

  public applyDiffArray(toWhat: 'delegates' | 'u_delegates' | 'multisignatures' | 'u_multisignatures', diff: any) {
    return null;
  }

  public applyValues(items: Partial<this>) {
    return null;
  }

  // public static searchDelegate(q: string, limit: number, orderBy: string, orderHow: 'ASC' | 'DESC' = 'ASC'): string {
  //   throw new Error('NotImplementedException');
  // }

  public static createBulkAccountsSQL(addresses: address[]): string {
    throw new Error('NotImplementedException');
  }

  public static restoreUnconfirmedEntries(): Promise<void> {
    throw new Error('NotImplementedException');
  }
}
