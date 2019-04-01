import { BaseModel, ModelSymbols } from '@risevision/core-models';
import { ITransactionsModel, Symbols } from '@risevision/core-types';
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { As } from 'type-tagger';

@Table({ tableName: 'trsassets_delegates' })
export class DelegatesModel extends BaseModel<DelegatesModel> {
  @PrimaryKey
  @Column
  public username: string;

  @PrimaryKey
  @ForeignKey(() =>
    DelegatesModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    )
  )
  @Column
  public transactionId: string;

  @Column(DataType.BLOB)
  public forgingPK: Buffer & As<'publicKey'>;

  @BelongsTo(() =>
    DelegatesModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    )
  )
  public tx: ITransactionsModel;
}
