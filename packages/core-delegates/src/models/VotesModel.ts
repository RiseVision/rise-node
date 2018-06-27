import { ITransactionsModel } from '@risevision/core-interfaces';
import { BaseModel } from '@risevision/core-models';
import { publicKey } from '@risevision/core-types';

import { BelongsTo, Column, ForeignKey, IBuildOptions, PrimaryKey, Table } from 'sequelize-typescript';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

@Table({ tableName: 'votes' })
export class VotesModel extends BaseModel<VotesModel> {
  @PrimaryKey
  @Column
  public votes: string;

  @PrimaryKey
  @ForeignKey(() => ITransactionsModel)
  @Column
  public transactionId: string;

  @BelongsTo(() => ITransactionsModel)
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
