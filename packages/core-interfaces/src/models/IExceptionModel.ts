import { IBaseModel } from './IBaseModel';

export interface IExceptionModel extends IBaseModel<IExceptionModel> {
  key: string;

  type: string;

  remainingCount: number;
}
