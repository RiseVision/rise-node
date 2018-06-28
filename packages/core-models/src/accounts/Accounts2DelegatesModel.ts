import { IAccounts2DelegatesModel } from '@risevision/core-interfaces';
import { Column, ForeignKey, Model, PrimaryKey, Table, } from 'sequelize-typescript';
import { AccountsModel } from '../AccountsModel';

@Table({ tableName: 'mem_accounts2delegates' })
// tslint:disable-next-line class-name
export class Accounts2DelegatesModel extends Model<Accounts2DelegatesModel> implements IAccounts2DelegatesModel {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
