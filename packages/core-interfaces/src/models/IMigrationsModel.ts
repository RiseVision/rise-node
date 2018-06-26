import { IBaseModel } from './IBaseModel';

export class IMigrationsModel extends IBaseModel<IMigrationsModel> {
  public id: string;
  public name: string;
}
