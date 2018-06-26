import * as pgp from 'pg-promise';
import * as sequelize from 'sequelize';
import { Op } from 'sequelize';
import { Column, DataType, PrimaryKey, Scopes, Table } from 'sequelize-typescript';
import { publicKey } from '../types/sanityTypes';
import { BaseModel } from './BaseModel';

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
    ],
  },
  fullConfirmed: {
    attributes: [
      ...fields,
      buildArrayArgAttribute('delegates'),
      buildArrayArgAttribute('multisignatures'),
    ],
  },
})
@Table({ tableName: 'mem_accounts' })
export class AccountsModel extends BaseModel<AccountsModel> {
  @Column
  public username: string;
  @Column
  public isDelegate: 0 | 1;

  @Column
  public secondSignature: 0 | 1;

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
  public virgin: 0 | 1;

  // Unconfirmed stuff

  @Column
  public u_isDelegate: 0 | 1;
  @Column
  public u_secondSignature: 0 | 1;
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
      toRet[pk] = toRet[pk] !== null && typeof(toRet[pk]) !== 'undefined' ? toRet[pk].toString('hex') : null;
    });
    return toRet;
  }

  public applyDiffArray(toWhat: 'delegates' | 'u_delegates' | 'multisignatures' | 'u_multisignatures', diff: any) {
    this[toWhat] = this[toWhat] || [];
    diff.filter((v) => v.startsWith('-'))
      .forEach((v) => this[toWhat].splice(this[toWhat].indexOf(v.substr(1)), 1));
    diff.filter((v) => v.startsWith('+'))
      .forEach((v) => this[toWhat].push(v.substr(1)));
  }

  public applyValues(items: Partial<this>) {
    Object.keys(items).forEach((k) => this[k] = items[k]);
  }


  public static searchDelegate(q: string, limit: number, orderBy: string, orderHow: 'ASC' | 'DESC' = 'ASC') {
    if (['ASC', 'DESC'].indexOf(orderHow.toLocaleUpperCase()) === -1) {
      throw new Error('Invalid ordering mechanism')
    }

    return pgp.as.format(`
    WITH
      supply AS (SELECT calcSupply((SELECT height FROM blocks ORDER BY height DESC LIMIT 1))::numeric),
      delegates AS (SELECT row_number() OVER (ORDER BY vote DESC, m."publicKey" ASC)::int AS rank,
        m.username,
        m.address,
        ENCODE(m."publicKey", 'hex') AS "publicKey",
        m.vote,
        m.producedblocks,
        m.missedblocks,
        ROUND(vote / (SELECT * FROM supply) * 100, 2)::float AS approval,
        (CASE WHEN producedblocks + missedblocks = 0 THEN 0.00 ELSE
        ROUND(100 - (missedblocks::numeric / (producedblocks + missedblocks) * 100), 2)
        END)::float AS productivity,
        COALESCE(v.voters_cnt, 0) AS voters_cnt,
        t.timestamp AS register_timestamp
        FROM delegates d
        LEFT JOIN mem_accounts m ON d.username = m.username
        LEFT JOIN trs t ON d."transactionId" = t.id
        LEFT JOIN (SELECT "dependentId", COUNT(1)::int AS voters_cnt from mem_accounts2delegates GROUP BY "dependentId") v ON v."dependentId" = ENCODE(m."publicKey", 'hex')
        WHERE m."isDelegate" = 1
        ORDER BY \${orderBy:name} \${orderHow:raw})
      SELECT * FROM delegates WHERE username LIKE \${q} LIMIT \${limit}
    `, {
      q: `%${q}%`,
      limit,
      orderBy,
      orderHow
    });

  }

  public static restoreUnconfirmedEntries() {
    return this.update({
      u_isDelegate     : sequelize.col('isDelegate'),
      u_balance        : sequelize.col('balance'),
      u_secondSignature: sequelize.col('secondSignature'),
      u_username       : sequelize.col('username'),
    }, {
      where: {
        $or: {
          u_isDelegate     : { [Op.ne]: sequelize.col('isDelegate') },
          u_balance        : { [Op.ne]: sequelize.col('balance') },
          u_secondSignature: { [Op.ne]: sequelize.col('secondSignature') },
          u_username       : { [Op.ne]: sequelize.col('username') },
        }
      }
    })
  }


  public static createBulkAccountsSQL(addresses: string[]) {
    if (!addresses) {
      return '';
    }
    addresses = addresses.filter((addr) => addr);
    if (addresses.length === 0) {
      return '';
    }
    return pgp.as.format(`
    INSERT into mem_accounts(address)
    SELECT address from (VALUES $1:raw ) i (address)
    LEFT JOIN mem_accounts m1 USING(address)
    WHERE m1.address IS NULL`,
      addresses.map((address) => pgp.as.format('($1)', address)).join(', '));
  }
}
