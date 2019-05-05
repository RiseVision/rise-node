import {
  FilteredModelAttributes,
  IAccountsModel,
} from '@risevision/core-types';
import 'reflect-metadata';
import { BuildOptions } from 'sequelize';
import { Column, DataType, DefaultScope } from 'sequelize-typescript';

@DefaultScope({
  attributes: ['secondSignature', 'secondPublicKey', 'u_secondSignature'],
})
export class AccountsModelWith2ndSign extends IAccountsModel {
  @Column
  public secondSignature: 0 | 1;
  @Column(DataType.BLOB)
  public secondPublicKey: Buffer;
  @Column
  // tslint:disable-next-line variable-name
  public u_secondSignature: 0 | 1;

  constructor(
    values?: FilteredModelAttributes<AccountsModelWith2ndSign>,
    options?: BuildOptions
  ) {
    super(values, options);
  }
}
