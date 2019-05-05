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

@Table({ tableName: 'trsassets_secondsignature', timestamps: false })
export class SignaturesModel extends BaseModel<SignaturesModel> {
  @Column(DataType.BLOB)
  public publicKey: Buffer;

  @PrimaryKey
  @ForeignKey(() =>
    SignaturesModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    )
  )
  @Column
  public transactionId: string;

  @BelongsTo(() =>
    SignaturesModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    )
  )
  public transaction: ITransactionsModel;
}
