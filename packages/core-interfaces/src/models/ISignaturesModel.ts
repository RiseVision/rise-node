import { IBaseModel } from './IBaseModel';

export interface ISignaturesModel extends IBaseModel<ISignaturesModel> {
  publicKey: Buffer;

  transactionId: string;
}
