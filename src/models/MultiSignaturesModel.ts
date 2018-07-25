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
/**
 * MultiSignatures model
 */
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

    if (typeof(this.keysgroup) === 'string') {
      this.keysgroup.split(',')
        .forEach((key) => {
          if (key.startsWith('+')) {
            this.added.push(key.substr(1));
          } else if (key.startsWith('-')) {
            this.removed.push(key.substr(1));
          }
        });
    }
  }
}
