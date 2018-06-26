import { BelongsTo, Column, DataType, ForeignKey, PrimaryKey, Table } from 'sequelize-typescript';
import { IBaseModel } from './BaseModel';
import { TransactionsModel } from './TransactionsModel';

@Table({tableName: 'signatures'})
export class SignaturesModel extends IBaseModel<SignaturesModel> {
  @Column(DataType.BLOB)
  public publicKey: Buffer;

  @PrimaryKey
  @ForeignKey(() => TransactionsModel)
  @Column
  public transactionId: string;

  @BelongsTo(() => TransactionsModel)
  public transaction: TransactionsModel;

}
