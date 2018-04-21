import { BelongsTo, Column, DataType, ForeignKey, IBuildOptions, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { TransactionType } from '../helpers';
import { TransactionsModel } from './TransactionsModel';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';
import { publicKey } from '../types/sanityTypes';

@Table({tableName: 'signatures'})
export class SignaturesModel extends Model<SignaturesModel> {
  @Column(DataType.BLOB)
  public publicKey: Buffer;

  @Column
  @PrimaryKey
  @ForeignKey(() => TransactionsModel)
  public transactionId: string;

  @BelongsTo(() => TransactionsModel)
  public transaction: TransactionsModel;

}
