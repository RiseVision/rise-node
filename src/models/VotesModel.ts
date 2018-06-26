import { BelongsTo, Column, ForeignKey, IBuildOptions, PrimaryKey, Table } from 'sequelize-typescript';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';
import { publicKey } from '../types/sanityTypes';
import { BaseModel } from './BaseModel';
import { TransactionsModel } from './TransactionsModel';

@Table({tableName: 'votes'})
export class VotesModel extends BaseModel<VotesModel> {
  @PrimaryKey
  @Column
  public votes: string;

  @PrimaryKey
  @ForeignKey(() => TransactionsModel)
  @Column
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
          } else if (vote.startsWith('-')){
            this.removed.push(vote.substr(1));
          }
        });
    }

  }
}
