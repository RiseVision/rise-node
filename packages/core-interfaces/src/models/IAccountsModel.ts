import { publicKey } from '@risevision/core-types';
import { IBaseModel } from './IBaseModel';

export class IAccountsModel extends IBaseModel<IAccountsModel> {
  public username: string;
  public isDelegate: 0 | 1;
  public secondSignature: 0 | 1;
  public address: string;
  public publicKey: Buffer;
  public secondPublicKey: Buffer;
  public balance: number;
  public vote: number;
  public rate: number;
  public multimin: number;
  public multilifetime: number;
  public blockId: string;
  public producedblocks: number;
  public missedblocks: number;
  public fees: number;
  public rewards: number;
  public virgin: 0 | 1;

  // Unconfirmed stuff
  public u_isDelegate: 0 | 1;
  public u_secondSignature: 0 | 1;
  public u_username: string;
  public u_balance: number;
  public u_multilifetime: number;
  public u_multimin: number;
  public multisignatures?: publicKey[];
  public u_multisignatures?: publicKey[];
  public delegates?: publicKey[];
  public u_delegates?: publicKey[];

  readonly hexPublicKey: publicKey;

  public isMultisignature(): boolean {
    return null;
  };

  public toPOJO(): { [k: string]: string | number } {
    return null;
  }

  public applyDiffArray(toWhat: 'delegates' | 'u_delegates' | 'multisignatures' | 'u_multisignatures', diff: any) {
    return null;
  }

  public applyValues(items: Partial<this>) {
    return null;
  }
}