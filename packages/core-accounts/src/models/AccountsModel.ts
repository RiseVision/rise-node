// tslint:disable
import { publicKey } from '@risevision/core-types';
import { IAccountsModel } from '@risevision/core-interfaces';
import * as pgp from 'pg-promise';
import * as sequelize from 'sequelize';
import { Op } from 'sequelize';
import {
  Column,
  DataType,
  DefaultScope,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Container } from 'inversify';
import { BaseModel } from '@risevision/core-models';

@DefaultScope({
  attributes: [
    'address',
    'publicKey',
    'balance',
    'blockId',
    'virgin',
    'u_balance',
  ].sort(),
})
@Table({ tableName: 'mem_accounts' })
export class AccountsModel extends BaseModel<AccountsModel>
  implements IAccountsModel {
  @PrimaryKey
  @Column
  public address: string;

  @Column(DataType.BLOB)
  public publicKey: Buffer;

  @Column(DataType.BIGINT)
  public balance: bigint;

  @Column
  public blockId: string;

  @Column
  public virgin: 0 | 1;

  @Column(DataType.BIGINT)
  public u_balance: bigint;

  private _hexPublicKey: publicKey;
  public get hexPublicKey(): publicKey {
    if (typeof this._hexPublicKey === 'undefined') {
      if (this.publicKey === null) {
        this._hexPublicKey = null;
      } else {
        this._hexPublicKey = this.publicKey.toString('hex');
      }
    }
    return this._hexPublicKey;
  }

  public toPOJO() {
    const toRet = this.toJSON();
    Object.keys(toRet).forEach((k) => {
      if (Buffer.isBuffer(toRet[k])) {
        toRet[k] = toRet[k].toString('hex');
      }
    });
    return toRet;
  }

  public applyDiffArray(
    toWhat:
      | 'delegates'
      | 'u_delegates'
      | 'multisignatures'
      | 'u_multisignatures',
    diff: any
  ) {
    this[toWhat] = this[toWhat] || [];
    diff
      .filter((v) => v.startsWith('-'))
      .forEach((v) =>
        this[toWhat].splice(this[toWhat].indexOf(v.substr(1)), 1)
      );
    diff
      .filter((v) => v.startsWith('+'))
      .forEach((v) => this[toWhat].push(v.substr(1)));
  }

  public applyValues(items: Partial<this>) {
    Object.keys(items).forEach((k) => (this[k] = items[k]));
  }

  public static createBulkAccountsSQL(addresses: string[]) {
    if (!addresses) {
      return '';
    }
    addresses = addresses.filter((addr) => addr);
    if (addresses.length === 0) {
      return '';
    }
    return pgp.as.format(
      `
    INSERT into mem_accounts(address)
    SELECT address from (VALUES $1:raw ) i (address)
    LEFT JOIN mem_accounts m1 USING(address)
    WHERE m1.address IS NULL`,
      addresses.map((address) => pgp.as.format('($1)', address)).join(', ')
    );
  }
}
