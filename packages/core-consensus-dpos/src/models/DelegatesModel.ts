import { ITransactionsModel, Symbols } from '@risevision/core-interfaces';
import { BaseModel, ModelSymbols } from '@risevision/core-models';
import { BelongsTo, Column, ForeignKey, PrimaryKey, Table } from 'sequelize-typescript';

@Table({tableName: 'delegates'})
export class DelegatesModel extends BaseModel<DelegatesModel> {
  @PrimaryKey
  @Column
  public username: string;

  @PrimaryKey
  @ForeignKey(() => DelegatesModel.container.getNamed(ModelSymbols.model, Symbols.models.transactions))
  @Column
  public transactionId: string;

  @BelongsTo(() =>  DelegatesModel.container.getNamed(ModelSymbols.model, Symbols.models.transactions))
  public transaction: ITransactionsModel = null;

}
