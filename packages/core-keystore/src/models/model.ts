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

@Table({ tableName: 'trsassets_keystore', timestamps: false })
export class KeystoreModel extends BaseModel<KeystoreModel> {
  @PrimaryKey
  @Column(DataType.STRING)
  public key: string;

  @PrimaryKey
  @Column(DataType.BLOB)
  public value: Buffer;

  @PrimaryKey
  @ForeignKey(() =>
    KeystoreModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    )
  )
  @Column
  public transactionId: string;

  @BelongsTo(() =>
    KeystoreModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    )
  )
  public transaction: ITransactionsModel;
}
