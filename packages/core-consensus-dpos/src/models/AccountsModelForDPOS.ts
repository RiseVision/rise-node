import { IAccountsModel } from '@risevision/core-interfaces';
import { publicKey } from '@risevision/core-types';
import * as sequelize from 'sequelize';
import { Column, DataType, DefaultScope } from 'sequelize-typescript';
import { IBuildOptions } from 'sequelize-typescript/lib/interfaces/IBuildOptions';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

const buildArrayArgAttribute = (table: string): any => {
  return [
    sequelize.literal(
      `(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2${table} WHERE "accountId" = "AccountsModel"."address")`
    ),
    table,
  ];
};

@DefaultScope({
  attributes: [
    'username',
    'isDelegate',
    'u_username',
    'u_isDelegate',
    'vote',
    buildArrayArgAttribute('delegates'),
    buildArrayArgAttribute('u_delegates'),
  ],
})
export class AccountsModelForDPOS extends IAccountsModel {
  @Column
  public username: string;
  @Column
  public isDelegate: 0 | 1;
  @Column(DataType.TEXT)
  public delegates?: publicKey[];
  @Column
  public vote: bigint;
  @Column
  public cmb: number;
  @Column
  public votesWeight: bigint;
  @Column
  // tslint:disable-next-line
  public u_username: string;
  @Column
  // tslint:disable-next-line
  public u_isDelegate: 0 | 1;
  @Column(DataType.TEXT)
  // tslint:disable-next-line
  public u_delegates?: publicKey[];

  public constructor(
    values?: FilteredModelAttributes<AccountsModelForDPOS>,
    options?: IBuildOptions
  ) {
    super(values, options);
  }
}
