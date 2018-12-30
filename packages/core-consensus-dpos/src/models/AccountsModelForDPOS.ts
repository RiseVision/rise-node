import { IAccountsModel } from '@risevision/core-interfaces';
import { publicKey } from '@risevision/core-types';
import * as sequelize from 'sequelize';
import { Column, DataType, DefaultScope } from 'sequelize-typescript';
import { IBuildOptions } from 'sequelize-typescript/lib/interfaces/IBuildOptions';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';

const buildArrayArgAttribute = (table: string): any => {
  return [
    sequelize.literal(
      `(SELECT ARRAY_AGG("delegatePublicKey") FROM mem_accounts2${table} WHERE "address" = "AccountsModel"."address")`
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
    'producedblocks',
    'missedblocks',
    'fees',
    'rewards',
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
  public delegates?: Buffer[];
  @Column(DataType.BIGINT)
  public vote: bigint;
  @Column
  public cmb: number;
  @Column(DataType.BIGINT)
  public votesWeight: bigint;
  @Column
  // tslint:disable-next-line
  public u_username: string;
  @Column
  // tslint:disable-next-line
  public u_isDelegate: 0 | 1;
  @Column(DataType.TEXT)
  // tslint:disable-next-line
  public u_delegates?: Buffer[];

  @Column
  public producedblocks: number;

  @Column
  public missedblocks: number;

  @Column(DataType.BIGINT)
  public fees: bigint;
  @Column(DataType.BIGINT)
  public rewards: bigint;

  @Column(DataType.BLOB)
  public forgingPK: Buffer;

  public constructor(
    values?: FilteredModelAttributes<AccountsModelForDPOS>,
    options?: IBuildOptions
  ) {
    super(values, options);
  }
}
