import { IBaseModel } from './IBaseModel';

export class IInfoModel extends IBaseModel<IInfoModel> {
  public key: string;
  public value: string;
}
