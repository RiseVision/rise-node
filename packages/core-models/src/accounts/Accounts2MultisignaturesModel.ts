import { IAccounts2MultisignaturesModel } from '@risevision/core-interfaces';
import { Column, ForeignKey, PrimaryKey, Table, } from 'sequelize-typescript';
import { AccountsModel } from '../AccountsModel';
import { BaseModel } from '../BaseModel';

@Table({ tableName: 'mem_accounts2multisignatures' })
// tslint:disable-next-line class-name
export class Accounts2MultisignaturesModel extends BaseModel<Accounts2MultisignaturesModel> implements IAccounts2MultisignaturesModel {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
