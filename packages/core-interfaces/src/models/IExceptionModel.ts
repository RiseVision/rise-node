import { IBaseModel } from './IBaseModel';

export class IExceptionModel extends IBaseModel<IExceptionModel> {
  key: string;

  type: string;

  remainingCount: number;
}
