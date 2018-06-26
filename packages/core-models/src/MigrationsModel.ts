import { Column, PrimaryKey, Table } from 'sequelize-typescript';
import { IBaseModel } from './BaseModel';

@Table({ tableName: 'migrations' })
export class MigrationsModel extends IBaseModel<MigrationsModel> {
  @PrimaryKey
  @Column
  public id: string;

  @PrimaryKey
  @Column
  public name: string;
}
