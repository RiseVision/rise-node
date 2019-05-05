import {
  FilteredModelAttributes,
  IAccountsModel,
} from '@risevision/core-types';
import * as sequelize from 'sequelize';
import { BuildOptions } from 'sequelize';
import { Column, DataType, DefaultScope } from 'sequelize-typescript';
import { As } from 'type-tagger';

const buildArrayArgAttribute = (table: string): any => {
  return [
    sequelize.literal(
      // tslint:disable-next-line max-line-length
      `(SELECT COALESCE(ARRAY_AGG("username"), ARRAY[]::TEXT[]) FROM mem_accounts2${table} WHERE "address" = "AccountsModel"."address")`
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
    'cmb',
    'votesWeight',
    'producedblocks',
    'missedblocks',
    'fees',
    'rewards',
    'forgingPK',
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
  public delegates?: string[];
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
  public u_delegates?: string[];

  @Column
  public producedblocks: number;

  @Column
  public missedblocks: number;

  @Column(DataType.BIGINT)
  public fees: bigint;
  @Column(DataType.BIGINT)
  public rewards: bigint;

  @Column(DataType.BLOB)
  public forgingPK: Buffer & As<'publicKey'>;

  public constructor(
    values?: FilteredModelAttributes<AccountsModelForDPOS>,
    options?: BuildOptions
  ) {
    super(values, options);
  }
}
