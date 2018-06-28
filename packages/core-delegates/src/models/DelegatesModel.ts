import { BaseModel, TransactionsModel } from '@risevision/core-models';
import { BelongsTo, Column, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({tableName: 'delegates'})
export class DelegatesModel extends Model<DelegatesModel> implements BaseModel<DelegatesModel> {
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


