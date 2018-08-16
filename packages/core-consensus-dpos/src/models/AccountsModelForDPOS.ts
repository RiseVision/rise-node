import { IAccountsModel } from '@risevision/core-interfaces';
import { Column, DataType, DefaultScope } from 'sequelize-typescript';
import * as sequelize from 'sequelize';
import { publicKey } from '@risevision/core-types';

const buildArrayArgAttribute = function (table: string): any {
  return [sequelize.literal(`(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2${table} WHERE "accountId" = "AccountsModel"."address")`), table];
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
  ]
})
export class AccountsModelForDPOS extends IAccountsModel {
  @Column
  public username: string;
  @Column
  public isDelegate: 0 | 1;
  @Column(DataType.TEXT)
  public delegates?: publicKey[];
  @Column
  public vote: number;
  @Column
  public u_username: string;
  @Column
  public u_isDelegate: 0 | 1;
  @Column(DataType.TEXT)
  public u_delegates?: publicKey[];
}
