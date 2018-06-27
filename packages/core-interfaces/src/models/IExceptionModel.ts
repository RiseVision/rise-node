import { IBaseModel } from './IBaseModel';

export class IExceptionModel extends IBaseModel<IExceptionModel> {
  public key: string;

  public type: string;

  public remainingCount: number;
}
