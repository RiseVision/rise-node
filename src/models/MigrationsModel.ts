// tslint:disable
import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';
import 'reflect-metadata';
import { ForkType } from '../helpers';


@Table({ tableName: 'migrations' })
/**
 * Migrations model
 */
export class MigrationsModel extends Model<MigrationsModel> {
  @PrimaryKey
  @Column
  public id: string;

  @PrimaryKey
  @Column
  public name: string;
}
