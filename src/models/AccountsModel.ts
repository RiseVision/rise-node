// tslint:disable
import { Column, DataType, Model, PrimaryKey, Scopes, Sequelize, Table } from 'sequelize-typescript';
import 'reflect-metadata';
import { publicKey } from '../types/sanityTypes';
import * as sequelize from 'sequelize';
import { BlocksModel, DelegatesModel, TransactionsModel } from './index';

var pg = require('pg')

pg.types.setTypeParser(20, 'text', parseInt)

const fields            = ['username', 'isDelegate', 'secondSignature', 'address', 'publicKey', 'secondPublicKey', 'balance', 'vote', 'rate', 'multimin', 'multilifetime', 'blockId', 'producedblocks', 'missedblocks', 'fees', 'rewards', 'virgin'];
const unconfirmedFields = ['u_isDelegate', 'u_secondSignature', 'u_username', 'u_balance', 'u_multimin', 'u_multilifetime'];

const allFields = fields.concat(unconfirmedFields);

const buildArrayArgAttribute = function (table: string): any {
  return [sequelize.literal(`(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2${table} WHERE "accountId" = "AccountsModel"."address")`), table];
}

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



  public multisignatures?: publicKey[];
  public u_multisignatures?: publicKey[];
  public delegates?: publicKey[];
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


const s = new Sequelize({
  username: 'andrea',
  password: 'password',
  database: 'rise_db',
  dialect: 'postgres'

});

s.addModels([AccountsModel, BlocksModel, DelegatesModel, TransactionsModel]);


//
// AccountsModel.upsert({address: '5637366780247854848R', secondSignature: 0})
// .then((res) => {
//   console.log(res);
// })
//
// AccountsModel.count({where: {blockId: [sequelize.col('blockId'), sequelize.literal('(SELECT "id" from blocks ORDER BY "height" DESC LIMIT 1)')]}}as any)
//   .then((result) => {
//     console.log(result);
//   });

// DelegatesModel.sequelize.query(
//   'WITH duplicates AS (SELECT COUNT(1) FROM delegates GROUP BY "transactionId" HAVING COUNT(1) > 1) SELECT count(1) FROM duplicates',
//   { type: sequelize.QueryTypes.SELECT })
// .then(([res]) => {
//   console.log(res);
//   console.log(res.count);
// })
//
// console.log(AccountsModel.attributes)
// console.log(sequelize.col('u_balance'))
// AccountsModel.restoreUnconfirmedEntries()
// .then((r) => {
//   console.log(r);
// })

// AccountsModel.count({where: {isDelegate: 1}})
// .then((r) => console.log(r))

// BlocksModel.findAll({
//   raw: true,
//   order: ['height', 'rowId'],
//   where: { height: { $gt: 10, $lt: 11} },
// }).then((res) => console.log(res))
