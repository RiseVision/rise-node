// tslint:disable
import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';
import 'reflect-metadata';
import { ForkType } from '../helpers';


@Table({ tableName: 'migrations' })
export class MigrationsModel extends Model<MigrationsModel> {
  @PrimaryKey
  public id: string;

  @PrimaryKey
  @Column
  public name: string;
}
