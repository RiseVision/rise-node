import { publicKey } from '@risevision/core-types';
import { IBaseModel } from './IBaseModel';

export class IMultisignaturesModel extends IBaseModel<IMultisignaturesModel> {
  public min: number;

  public lifetime: number;

  public keysgroup: string;

  public transactionId: string;

  public added: publicKey[];

  public removed: publicKey[];
}
