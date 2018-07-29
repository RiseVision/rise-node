import { Symbols } from '@risevision/core-interfaces';
import { BaseModel, ModelSymbols } from '@risevision/core-models';
import { publicKey } from '@risevision/core-types';
import {
  Column,
  ForeignKey,
  IBuildOptions,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

@Table({ tableName: 'multisignatures' })
export class MultiSignaturesModel extends BaseModel<MultiSignaturesModel> {
  @Column
  public min: number;

  @Column
  public lifetime: number;

  @Column
  public keysgroup: string;

  @PrimaryKey
  @ForeignKey(() => MultiSignaturesModel.container.getNamed(ModelSymbols.model, Symbols.models.transactions))
  @Column
  public transactionId: string;

  public added: publicKey[]   = [];
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
