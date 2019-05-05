import { BaseModel } from '@risevision/core-models';
import { FilteredModelAttributes, publicKey } from '@risevision/core-types';
import { BuildOptions } from 'sequelize';
import { Column, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'trsassets_votes_old', timestamps: false })
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
    options?: BuildOptions
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
