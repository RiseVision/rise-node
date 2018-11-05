import { IAccountsModel } from '@risevision/core-interfaces';
import { publicKey } from '@risevision/core-types';
import 'reflect-metadata';
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
// tslint:disable variable-name
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
