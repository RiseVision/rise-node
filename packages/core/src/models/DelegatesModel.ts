import { BelongsTo, Column, ForeignKey, PrimaryKey, Table } from 'sequelize-typescript';
import { BaseModel } from './BaseModel';
import { TransactionsModel } from './TransactionsModel';

@Table({tableName: 'delegates'})
export class DelegatesModel extends BaseModel<DelegatesModel> {
  @PrimaryKey
  @Column
  public username: string;

  @PrimaryKey
  @ForeignKey(() => TransactionsModel)
  @Column
  public transactionId: string;

  @BelongsTo(() => TransactionsModel)
  public transaction: TransactionsModel = null;

}
