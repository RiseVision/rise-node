import 'reflect-metadata';
// import { IAccountsModel } from '@risevision/core-interfaces';
import { utils as modelsUtils } from '@risevision/core-models';
import {
  Column,
  DataType,
  DefaultScope,
  Model,
  Sequelize,
} from 'sequelize-typescript';
import * as sequelize from 'sequelize';
import { publicKey } from '@risevision/core-types';
import { IAccountsModel } from '@risevision/core-interfaces';
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model';
import { IBuildOptions } from 'sequelize-typescript/lib/interfaces/IBuildOptions';
// import * as extend from 'extend';

const buildArrayArgAttribute = function(table: string): any {
  return [
    sequelize.literal(
      `(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2${table} WHERE "accountId" = "AccountsModel"."address")`
    ),
    table,
  ];
};

// tslint:disable-next-line

@DefaultScope({
  attributes: [
    'multimin',
    'multilifetime',
    'u_multimin',
    'u_multilifetime',
    buildArrayArgAttribute('multisignatures'),
    buildArrayArgAttribute('u_multisignatures'),
  ],
})
export class AccountsModelWithMultisig extends IAccountsModel {
  @Column
  public multimin: number;
  @Column
  public multilifetime: number;
  @Column(DataType.TEXT)
  public multisignatures?: publicKey[];

  @Column
  public u_multilifetime: number;
  @Column
  public u_multimin: number;
  @Column(DataType.TEXT)
  public u_multisignatures?: publicKey[];

  constructor(
    values?: FilteredModelAttributes<AccountsModelWithMultisig>,
    options?: IBuildOptions
  ) {
    super(values, options);
  }

  public isMultisignature(): boolean {
    return this.multilifetime > 0;
  }
}
