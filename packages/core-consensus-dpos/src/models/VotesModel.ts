import { ITransactionsModel, Symbols } from '@risevision/core-interfaces';
import { BaseModel, ModelSymbols } from '@risevision/core-models';
import { publicKey } from '@risevision/core-types';
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  IBuildOptions,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

@Table({ tableName: 'votes' })
export class VotesModel extends BaseModel<VotesModel> {
  @PrimaryKey
  @Column(DataType.ARRAY(DataType.TEXT))
  public added: string[];
  @PrimaryKey
  @Column(DataType.ARRAY(DataType.TEXT))
  public removed: string[];

  @PrimaryKey
  @ForeignKey(() =>
    VotesModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    )
  )
  @Column
  public transactionId: string;

  @BelongsTo(() =>
    VotesModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    )
  )
  public transaction: ITransactionsModel;
}
