import {
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript';
import { BaseModel, ModelSymbols } from '@risevision/core-models';
import { Symbols } from '@risevision/core-interfaces';

@Table({ tableName: 'mem_accounts2multisignatures' })
// tslint:disable-next-line class-name
export class Accounts2MultisignaturesModel extends BaseModel<
  Accounts2MultisignaturesModel
> {
  @PrimaryKey
  @Column
  public dependentId: string;
  @PrimaryKey
  @ForeignKey(() =>
    Accounts2MultisignaturesModel.container.getNamed(
      ModelSymbols.model,
      Symbols.models.accounts
    )
  )
  @Column
  public accountId: string;
}
