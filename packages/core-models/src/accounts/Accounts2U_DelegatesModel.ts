import { IAccounts2U_DelegatesModel } from '@risevision/core-interfaces';
import { Column, ForeignKey, Model, PrimaryKey, Table, } from 'sequelize-typescript';
import { AccountsModel } from '../AccountsModel';

@Table({ tableName: 'mem_accounts2u_delegates' })
// tslint:disable-next-line class-name
export class Accounts2U_DelegatesModel extends Model<Accounts2U_DelegatesModel> implements IAccounts2U_DelegatesModel {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
