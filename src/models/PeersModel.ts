import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  IBuildOptions,
  Model,
  PrimaryKey,
  Sequelize,
  Table
} from 'sequelize-typescript';
import { TransactionType } from '../helpers';
import { TransactionsModel } from './TransactionsModel';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';
import { publicKey } from '../types/sanityTypes';
import { DelegatesModel } from './DelegatesModel';

@Table({tableName: 'peers'})
export class PeersModel extends Model<PeersModel> {
  @Column(DataType.BLOB)
  public ip: Buffer;

  @Column
  public keysgroup: string;

  @PrimaryKey
  @ForeignKey(() => TransactionsModel)
  @Column
  public transactionId: string;

  @BelongsTo(() => TransactionsModel)
  public transaction: TransactionsModel;

  public added: publicKey[] = [];
  public removed: publicKey[] = [];

}
