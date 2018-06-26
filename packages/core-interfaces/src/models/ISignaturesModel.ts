import { IBaseModel } from './IBaseModel';

export class ISignaturesModel extends IBaseModel<ISignaturesModel> {
  public publicKey: Buffer;

  public transactionId: string;
}
