import { IBaseModel } from './IBaseModel';

export interface IMigrationsModel extends IBaseModel<IMigrationsModel> {
  id: string;
  name: string;
}
