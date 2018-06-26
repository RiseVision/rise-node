import {
  Column,
  ForeignKey, PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { AccountsModel } from '../AccountsModel';
import { IBaseModel } from '../BaseModel';

@Table({tableName: 'mem_accounts2u_delegates'})
// tslint:disable-next-line class-name
export class Accounts2U_DelegatesModel extends IBaseModel<Accounts2U_DelegatesModel> {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
