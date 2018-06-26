import { publicKey } from '@risevision/core-types';
import { IBaseModel } from './IBaseModel';

export interface IMultisignaturesModel extends IBaseModel<IMultisignaturesModel> {
  min: number;

  lifetime: number;

  keysgroup: string;

  transactionId: string;

  readonly added: publicKey[];
  readonly removed: publicKey[];
}
