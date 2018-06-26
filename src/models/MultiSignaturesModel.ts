import {
  BelongsTo,
  Column,
  ForeignKey,
  IBuildOptions,
  PrimaryKey,
  Table
} from 'sequelize-typescript';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';
import { publicKey } from '../types/sanityTypes';
import { BaseModel } from './BaseModel';
import { TransactionsModel } from './TransactionsModel';

@Table({tableName: 'multisignatures'})
export class MultiSignaturesModel extends BaseModel<MultiSignaturesModel> {
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
