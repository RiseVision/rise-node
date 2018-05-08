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

@Table({tableName: 'multisignatures'})
export class MultiSignaturesModel extends Model<MultiSignaturesModel> {
  @Column
  public min: number;

  @Column
  public lifetime: number;

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
  constructor(values?: FilteredModelAttributes<MultiSignaturesModel>, options?: IBuildOptions) {
    super(values, options);

    this.keysgroup.split(',')
      .forEach((vote) => {
        if (vote.startsWith('+')) {
          this.added.push(vote.substr(1));
        } else {
          this.removed.push(vote.substr(1));
        }
      });
  }
}
