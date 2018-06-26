import { IMigrationsModel } from '@risevision/core-interfaces';
import { Column, PrimaryKey, Table } from 'sequelize-typescript';
import { BaseModel } from './BaseModel';

@Table({ tableName: 'migrations' })
export class MigrationsModel extends BaseModel<MigrationsModel> implements IMigrationsModel {
  @PrimaryKey
  @Column
  public id: string;

  @PrimaryKey
  @Column
  public name: string;
}
