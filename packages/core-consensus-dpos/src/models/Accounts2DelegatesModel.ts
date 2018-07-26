import { Symbols } from '@risevision/core-interfaces';
import { BaseModel, ModelSymbols } from '@risevision/core-models';
import { Column, ForeignKey, PrimaryKey, Table, } from 'sequelize-typescript';

@Table({ tableName: 'mem_accounts2delegates' })
// tslint:disable-next-line class-name
export class Accounts2DelegatesModel extends BaseModel<Accounts2DelegatesModel> {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() => Accounts2DelegatesModel.container.getNamed(ModelSymbols.model, Symbols.models.accounts))
  @Column
  public accountId: string;
}
