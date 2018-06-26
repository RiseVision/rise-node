import { IBaseModel } from './IBaseModel';

export interface IInfoModel extends IBaseModel<IInfoModel> {
  key: string;
  value: string;
}
