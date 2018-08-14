import { IAccountsModel } from '@risevision/core-interfaces';
import { Column, DataType, DefaultScope, IBuildOptions } from 'sequelize-typescript';
import { FilteredModelAttributes } from '../../../node_modules/sequelize-typescript/lib/models/Model';

@DefaultScope({
  attributes: [
    'secondSignature',
    'secondPublicKey',
    'u_secondSignature',
  ],
})
export class AccountsModelWith2ndSign extends IAccountsModel {
  @Column
  public secondSignature: 0 | 1;
  @Column(DataType.BLOB)
  public secondPublicKey: Buffer;
  @Column
  public u_secondSignature: 0 | 1;

  constructor(values?: FilteredModelAttributes<AccountsModelWith2ndSign>, options?: IBuildOptions) {
    super(values, options);
  }

}
