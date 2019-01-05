import { ITransactionsModel, Symbols } from '@risevision/core-interfaces';
import { BaseModel, ModelSymbols } from '@risevision/core-models';
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

@Table({ tableName: 'trsassets_send' })
export class SendTxAssetModel extends BaseModel<SendTxAssetModel> {
  @PrimaryKey
  @Column(DataType.BLOB)
  public data: Buffer;

  @PrimaryKey
  @ForeignKey(() =>
    SendTxAssetModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    )
  )
  @Column
  public transactionId: string;

  @BelongsTo(() =>
    SendTxAssetModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    )
  )
  public transaction: ITransactionsModel;
}
