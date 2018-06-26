import { IAccounts2U_DelegatesModel } from '@risevision/core-interfaces';
import { Column, ForeignKey, PrimaryKey, Table, } from 'sequelize-typescript';
import { AccountsModel } from '../AccountsModel';
import { BaseModel } from '../BaseModel';

@Table({ tableName: 'mem_accounts2u_delegates' })
// tslint:disable-next-line class-name
export class Accounts2U_DelegatesModel extends BaseModel<Accounts2U_DelegatesModel> implements IAccounts2U_DelegatesModel {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
