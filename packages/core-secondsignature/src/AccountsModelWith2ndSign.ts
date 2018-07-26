import { IAccountsModel } from '@risevision/core-interfaces';
import { Column, DataType, DefaultScope } from 'sequelize-typescript';

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
}
