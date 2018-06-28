import { ITransactionsModel } from '@risevision/core-interfaces';
import { BaseModel, TransactionsModel } from '@risevision/core-models';
import { publicKey } from '@risevision/core-types';

import { BelongsTo, Column, ForeignKey, IBuildOptions, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';
import { Container } from 'inversify';

@Table({ tableName: 'votes' })
export class VotesModel extends Model<VotesModel> {
  @PrimaryKey
  @Column
  public votes: string;

  @PrimaryKey
  @ForeignKey(() => TransactionsModel)
  @Column
  public transactionId: string;

  @BelongsTo(() => TransactionsModel)
  public transaction: ITransactionsModel;

  public added: publicKey[]   = [];
  public removed: publicKey[] = [];

  constructor(values?: FilteredModelAttributes<VotesModel>, options?: IBuildOptions) {
    super(values, options);

    if (this.votes !== null) {
      this.votes.split(',')
        .forEach((vote) => {
          if (vote.startsWith('+')) {
            this.added.push(vote.substr(1));
          } else if (vote.startsWith('-')) {
            this.removed.push(vote.substr(1));
          }
        });
    }

  }
}
