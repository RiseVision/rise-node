import {
  Column,
  ForeignKey, PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { AccountsModel } from '../AccountsModel';
import { IBaseModel } from '../BaseModel';

@Table({tableName: 'mem_accounts2delegates'})
// tslint:disable-next-line class-name
export class Accounts2DelegatesModel extends IBaseModel<Accounts2DelegatesModel> {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => AccountsModel)
  @Column
  public accountId: string;
}
