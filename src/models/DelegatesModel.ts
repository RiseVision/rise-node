import { BelongsTo, Column, ForeignKey, Model, PrimaryKey, Sequelize, Table } from 'sequelize-typescript';
import { TransactionsModel } from './TransactionsModel';
import { DelegatesModule } from '../modules';

@Table({tableName: 'delegates'})
export class DelegatesModel extends Model<DelegatesModel> {
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
