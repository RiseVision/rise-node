// tslint:disable
import {
  Table,
  Column,
  Model,
  ForeignKey, PrimaryKey,
} from 'sequelize-typescript';
import 'reflect-metadata';
import { AccountsModel } from '../AccountsModel';

@Table({tableName: 'mem_accounts2u_multisignatures'})
export class Accounts2U_MultisignaturesModel extends Model<Accounts2U_MultisignaturesModel> {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
