import { BaseModel } from '@risevision/core-models';
import { Column, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'mem_accounts2delegates' })
// tslint:disable-next-line class-name
export class Accounts2DelegatesModel extends BaseModel<
  Accounts2DelegatesModel
> {
  @PrimaryKey
  @Column
  public username: string;
  @PrimaryKey
  @Column
  public address: string;
}
