import { ISignaturesModel } from '@risevision/core-interfaces';
import { BelongsTo, Column, DataType, ForeignKey, PrimaryKey, Table } from 'sequelize-typescript';
import { BaseModel } from './BaseModel';
import { TransactionsModel } from './TransactionsModel';

@Table({ tableName: 'signatures' })
export class SignaturesModel extends BaseModel<SignaturesModel> implements ISignaturesModel {
  @Column(DataType.BLOB)
  public publicKey: Buffer;

  @PrimaryKey
  @ForeignKey(() => TransactionsModel)
  @Column
  public transactionId: string;

  @BelongsTo(() => TransactionsModel)
  public transaction: TransactionsModel;

}
