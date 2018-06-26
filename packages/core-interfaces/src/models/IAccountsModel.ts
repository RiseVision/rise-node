import { publicKey } from '@risevision/core-types';
import { IBaseModel } from './IBaseModel';
import { Model } from 'sequelize-typescript';


export class IAccountsModel extends IBaseModel<IAccountsModel> {
  username: string;
  isDelegate: 0 | 1;

  secondSignature: 0 | 1;

  address: string;

  publicKey: Buffer;

  secondPublicKey: Buffer;

  balance: number;

  vote: number;

  rate: number;

  multimin: number;

  multilifetime: number;

  blockId: string;

  producedblocks: number;

  missedblocks: number;

  fees: number;
  rewards: number;
  virgin: 0 | 1;

  // Unconfirmed stuff
  u_isDelegate: 0 | 1;
  u_secondSignature: 0 | 1;
  u_username: string;
  u_balance: number;
  u_multilifetime: number;
  u_multimin: number;

  multisignatures?: publicKey[];
  u_multisignatures?: publicKey[];
  delegates?: publicKey[];
  u_delegates?: publicKey[];

  readonly hexPublicKey: publicKey;

  isMultisignature(): boolean;

  toPOJO(): { [k: string]: string | number }
}
