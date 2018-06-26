import {
  Column,
  ForeignKey, PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { AccountsModel } from '../AccountsModel';
import { IBaseModel } from '../BaseModel';

@Table({tableName: 'mem_accounts2multisignatures'})
// tslint:disable-next-line class-name
export class Accounts2MultisignaturesModel extends IBaseModel<Accounts2MultisignaturesModel> {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
