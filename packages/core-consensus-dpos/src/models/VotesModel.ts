import { BaseModel, ModelSymbols } from '@risevision/core-models';
import { ITransactionsModel, publicKey, Symbols } from '@risevision/core-types';
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

@Table({ tableName: 'trsassets_votes' })
export class VotesModel extends BaseModel<VotesModel> {
  @PrimaryKey
  @Column({ type: DataType.ARRAY(DataType.TEXT) })
  public added: string[];
  @PrimaryKey
  @Column({ type: DataType.ARRAY(DataType.TEXT) })
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
