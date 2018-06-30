import { ISignaturesModel } from '@risevision/core-interfaces';
import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { TransactionsModel } from '@risevision/core-transactions';

@Table({ tableName: 'signatures' })
export class SignaturesModel extends Model<SignaturesModel> implements ISignaturesModel {
  @Column(DataType.BLOB)
  public publicKey: Buffer;

  @PrimaryKey
  @ForeignKey(() => TransactionsModel)
  @Column
  public transactionId: string;

  @BelongsTo(() => TransactionsModel)
  public transaction: TransactionsModel;

}
