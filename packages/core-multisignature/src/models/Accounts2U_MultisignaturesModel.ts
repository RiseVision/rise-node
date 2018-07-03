import { IAccounts2U_MultisignaturesModel } from '@risevision/core-interfaces';
import { AccountsModel } from '@risevision/core-models';
import { Column, ForeignKey, Model, PrimaryKey, Table, } from 'sequelize-typescript';

@Table({ tableName: 'mem_accounts2u_multisignatures' })
// tslint:disable-next-line class-name
export class Accounts2U_MultisignaturesModel extends Model<Accounts2U_MultisignaturesModel> implements IAccounts2U_MultisignaturesModel {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}