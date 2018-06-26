import { IAccounts2U_MultisignaturesModel } from '@risevision/core-interfaces';
import { Column, ForeignKey, PrimaryKey, Table, } from 'sequelize-typescript';
import { AccountsModel } from '../AccountsModel';
import { BaseModel } from '../BaseModel';

@Table({ tableName: 'mem_accounts2u_multisignatures' })
// tslint:disable-next-line class-name
export class Accounts2U_MultisignaturesModel extends BaseModel<Accounts2U_MultisignaturesModel> implements IAccounts2U_MultisignaturesModel {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
