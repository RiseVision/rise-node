// tslint:disable
import {
  Table,
  Column,
  Model,
  ForeignKey, PrimaryKey,
} from 'sequelize-typescript';
import 'reflect-metadata';
import { AccountsModel } from '../AccountsModel';

@Table({tableName: 'mem_accounts2u_delegates'})
export class Accounts2U_DelegatesModel extends Model<Accounts2U_DelegatesModel> {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
