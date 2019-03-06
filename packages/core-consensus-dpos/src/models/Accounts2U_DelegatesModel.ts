import { BaseModel, ModelSymbols } from '@risevision/core-models';
import { Symbols } from '@risevision/core-types';
import { Column, ForeignKey, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'mem_accounts2u_delegates' })
// tslint:disable-next-line class-name
export class Accounts2U_DelegatesModel extends BaseModel<
  Accounts2U_DelegatesModel
> {
  @PrimaryKey
  @Column
  public username: string;
  @PrimaryKey
  @Column
  public address: string;
}
