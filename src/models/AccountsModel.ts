// tslint:disable
import { Column, DataType, Model, PrimaryKey, Scopes, Table } from 'sequelize-typescript';
import 'reflect-metadata';
import { publicKey } from '../types/sanityTypes';
import * as sequelize from 'sequelize';
const fields            = ['username', 'isDelegate', 'secondSignature', 'address', 'publicKey', 'secondPublicKey', 'balance', 'vote', 'rate', 'multimin', 'multilifetime', 'blockId', 'producedblocks', 'missedblocks', 'fees', 'rewards', 'virgin'];
const unconfirmedFields = ['u_isDelegate', 'u_secondSignature', 'u_username', 'u_balance', 'u_multimin', 'u_multilifetime'];

const allFields = fields.concat(unconfirmedFields);

const buildArrayArgAttribute = function (table: string): any {
  return [sequelize.literal(`(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2${table} WHERE "accountId" = "AccountsModel"."address")`), table];
};

@Scopes({
  full         : {
    attributes: [
      ...allFields,
      buildArrayArgAttribute('delegates'),
      buildArrayArgAttribute('multisignatures'),
      buildArrayArgAttribute('u_delegates'),
      buildArrayArgAttribute('u_multisignatures'),
    ]
  },
  fullConfirmed: {
    attributes: [
      ...fields,
      buildArrayArgAttribute('delegates'),
      buildArrayArgAttribute('multisignatures'),
    ]
  }
})
@Table({ tableName: 'mem_accounts' })
export class AccountsModel extends Model<AccountsModel> {
  @Column
  public username: string;
  @Column
  public isDelegate: 0|1;

  @Column
  public secondSignature: 0|1;

  @PrimaryKey
  @Column
  public address: string;

  @Column(DataType.BLOB)
  public publicKey: Buffer;

  @Column(DataType.BLOB)
  public secondPublicKey: Buffer;

  @Column
  public balance: number;

  @Column
  public vote: number;

  @Column
  public rate: number;

  @Column
  public multimin: number;

  @Column
  public multilifetime: number;

  @Column
  public blockId: string;

  @Column
  public producedblocks: number;

  @Column
  public missedblocks: number;

  @Column
  public fees: number;
  @Column
  public rewards: number;
  @Column
  public virgin: 0|1;


  // Unconfirmed stuff

  @Column
  public u_isDelegate: 0|1;
  @Column
  public u_secondSignature: 0|1;
  @Column
  public u_username: string;
  @Column
  public u_balance: number;
  @Column
  public u_multilifetime: number;
  @Column
  public u_multimin: number;



  @Column(DataType.TEXT)
  public multisignatures?: publicKey[];
  @Column(DataType.TEXT)
  public u_multisignatures?: publicKey[];
  @Column(DataType.TEXT)
  public delegates?: publicKey[];
  @Column(DataType.TEXT)
  public u_delegates?: publicKey[];


  public isMultisignature(): boolean {
    return this.multilifetime > 0;
  }

  private _hexPublicKey: publicKey;
  public get hexPublicKey(): publicKey {
    if (typeof(this._hexPublicKey) === 'undefined') {
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
    ['publicKey', 'secondPublicKey'].forEach((pk) => {
      toRet[pk] = toRet[pk] !== null ? toRet[pk].toString('hex'): null;
    });
    return toRet;
  }

  public static restoreUnconfirmedEntries() {
    return this.update({
      u_isDelegate: sequelize.col('isDelegate'),
      u_balance: sequelize.col('balance'),
      u_secondSignature: sequelize.col('secondSignature'),
      u_username: sequelize.col('username'),
    }, {
      where: {
        $or: {
          u_isDelegate: {$ne: sequelize.col('isDelegate')},
          u_balance: {$ne: sequelize.col('balance')},
          u_secondSignature: {$ne: sequelize.col('secondSignature')},
          u_username: {$ne: sequelize.col('username')},
        }
      }
    })
  }
}