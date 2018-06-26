import {
  Column,
  ForeignKey, PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { AccountsModel } from '../AccountsModel';
import { IBaseModel } from '../BaseModel';

@Table({tableName: 'mem_accounts2u_multisignatures'})
// tslint:disable-next-line class-name
export class Accounts2U_MultisignaturesModel extends IBaseModel<Accounts2U_MultisignaturesModel> {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
