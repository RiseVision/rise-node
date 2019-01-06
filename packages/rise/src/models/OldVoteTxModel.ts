import { BaseModel } from '@risevision/core-models';
import { publicKey } from '@risevision/core-types';
import { Column, IBuildOptions, PrimaryKey, Table } from 'sequelize-typescript';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

@Table({ tableName: 'trsassets_votes_old' })
export class OldVoteTxModel extends BaseModel<OldVoteTxModel> {
  @PrimaryKey
  @Column
  public votes: string;

  @PrimaryKey
  @Column
  public transactionId: string;

  public added: publicKey[] = [];
  public removed: publicKey[] = [];

  constructor(
    values?: FilteredModelAttributes<OldVoteTxModel>,
    options?: IBuildOptions
  ) {
    super(values, options);

    if (this.votes !== null) {
      this.votes.split(',').forEach((vote) => {
        if (vote.startsWith('+')) {
          this.added.push(vote.substr(1));
        } else if (vote.startsWith('-')) {
          this.removed.push(vote.substr(1));
        }
      });
    }
  }
}
