import { Container } from 'inversify';
import { Model } from 'sequelize-typescript';

export class IBaseModel<T extends Model<T>> extends Model<T> {
  public static container: Container;
  public static options: any;
}
