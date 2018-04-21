import { BelongsTo, Column, DataType, ForeignKey, IBuildOptions, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { TransactionType } from '../helpers';
import { TransactionsModel } from './TransactionsModel';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';
import { publicKey } from '../types/sanityTypes';

@Table({tableName: 'votes'})
export class VotesModel extends Model<VotesModel> {
  @Column
  @PrimaryKey
  public votes: string;

  @Column
  @PrimaryKey
  @ForeignKey(() => TransactionsModel)
  public transactionId: string;

  @BelongsTo(() => TransactionsModel)
  public transaction: TransactionsModel;

  public added: publicKey[] = [];
  public removed: publicKey[] = [];
  constructor(values?: FilteredModelAttributes<VotesModel>, options?: IBuildOptions) {
    super(values, options);

    if (this.votes !== null) {
      this.votes.split(',')
        .forEach((vote) => {
          if (vote.startsWith('+')) {
            this.added.push(vote.substr(1));
          } else {
            this.removed.push(vote.substr(1));
          }
        });
    }

  }
}
