import { IAccounts2MultisignaturesModel } from '@risevision/core-interfaces';
import { Column, ForeignKey, Model, PrimaryKey, Table, } from 'sequelize-typescript';
import { AccountsModel } from '../AccountsModel';

@Table({ tableName: 'mem_accounts2multisignatures' })
// tslint:disable-next-line class-name
export class Accounts2MultisignaturesModel extends Model<Accounts2MultisignaturesModel> implements IAccounts2MultisignaturesModel {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
