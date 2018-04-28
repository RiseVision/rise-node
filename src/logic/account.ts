import * as crypto from 'crypto';
import * as fs from 'fs';
import { inject, injectable } from 'inversify';
import * as jsonSqlCreator from 'json-sql';
import * as path from 'path';
import * as sequelize from 'sequelize';
import * as z_schema from 'z-schema';
import { BigNum, catchToLoggerAndRemapError, ILogger } from '../helpers/';
import { IAccountLogic } from '../ioc/interfaces/';
import { Symbols } from '../ioc/symbols';
import {
  Accounts2DelegatesModel,
  Accounts2MultisignaturesModel,
  Accounts2U_DelegatesModel,
  Accounts2U_MultisignaturesModel,
  AccountsModel,
  MemRoundsModel,
  RoundsModel
} from '../models/';
import { DBOp } from '../types/genericTypes';
import { FieldsInModel, ModelAttributes } from '../types/utils';
import { accountsModelCreator } from './models/account';
import { IModelField, IModelFilter } from './models/modelField';

import { AccountDiffType } from '../ioc/interfaces/logic';

const jsonSql = jsonSqlCreator();

jsonSql.setDialect('postgresql');

// tslint:disable-next-line
export type OptionalsMemAccounts = {
  username?: string;
  isDelegate?: number;
  u_isDelegate?: number;
  secondSignature?: number;
  u_secondSignature?: number;
  u_username?: string;
  address?: string;
  publicKey?: Buffer;
  secondPublicKey?: string;
  balance?: number;
  u_balance?: number;
  vote?: number;
  rate?: number;
  delegates?: string;
  u_delegates?: string;
  multisignatures?: string[];
  u_multisignatures?: string[];
  multimin?: number;
  u_multimin?: number;
  multilifetime?: number;
  u_multilifetime?: number;
  blockId?: string;
  nameexist?: number;
  u_nameexist?: number;
  producedblocks?: number;
  missedblocks?: number;
  fees?: number;
  rewards?: number;
  virgin?: number;
};
// tslint:disable-next-line
export type MemAccountsData = OptionalsMemAccounts & {
  username: string;
  isDelegate: number;
  u_isDelegate: number;
  secondSignature: number;
  u_secondSignature: number;
  u_username: string;
  address: string;
  publicKey: string;
  secondPublicKey: string;
  balance: number;
  u_balance: number;
  vote: string;
  rate: number;
  delegates: string[];
  u_delegates: string[];
  multisignatures: string[];
  u_multisignatures: string[];
  multimin: number;
  u_multimin: number;
  multilifetime: number;
  u_multilifetime: number;
  blockId: string;
  nameexist: number;
  u_nameexist: number;
  producedblocks: number;
  missedblocks: number;
  fees: number;
  rewards: number;
  virgin: number;
};

// tslint:disable-next-line
export type AccountFilterData = {
  isDelegate?: 1 | 0;
  username?: string;
  address?: string | { $in: string[] };
  publicKey?: Buffer;
  limit?: number;
  offset?: number;
  sort?: string | { [k: string]: -1 | 1 }
};

@injectable()
export class AccountLogic implements IAccountLogic {
  private table = 'mem_accounts';

  /**
   * All fields
   */
  private fields: Array<{ alias: string, field?: string, expression?: string }> = [];

  /**
   * Filters by field
   */
  private filter: { [fieldName: string]: IModelFilter } = {};

  /**
   * Conversions by fieldName
   */
  private conv: { [fieldName: string]: any } = {};

  private model: IModelField[];

  /**
   * List of editable fields.
   */
  private editable: string[];

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  constructor() {
    this.model = accountsModelCreator(this.table);

    this.fields = this.model.map((field) => {
      const tmp: any = {};
      if (field.expression) {
        tmp.expression = field.expression;
      } else {
        if (field.mod) {
          tmp.expression = field.mod;
        }
        tmp.field = field.name;
      }
      if (tmp.expression || field.alias) {
        tmp.alias = field.alias || field.name;
      }
      return tmp;
    });

    // filters
    this.model.forEach((field) => this.filter[field.name] = field.filter);

    // conversions
    this.model.forEach((field) => this.conv[field.name] = field.conv);

    // build editable fields
    this.editable = this.model
      .filter((field) => !field.immutable)
      .map((field) => field.name);

  }

  /**
   * Creates memory tables related to accounts!
   */
  public createTables(): Promise<void> {
    return Promise.resolve(
      AccountsModel.sequelize.query(
        fs.readFileSync(path.join(process.cwd(), 'sql', 'memoryTables.sql'), { encoding: 'utf8' })
      )
    );
  }

  /**
   * Deletes the content of memory tables
   * - mem_round
   * - mem_accounts2delegates
   * - mem_accounts2u_delegates
   * - mem_accounts2multisignatures
   * - mem_accounts2u_multisignatures
   * @returns {Promise<void>}
   */
  public removeTables(): Promise<void> {
    return Promise.all([
      AccountsModel.drop(),
      MemRoundsModel.drop(),
      Accounts2DelegatesModel.drop(),
      Accounts2MultisignaturesModel.drop(),
      Accounts2U_DelegatesModel.drop(),
      Accounts2U_MultisignaturesModel.drop(),
    ])
      .then(() => void 0)
      .catch(catchToLoggerAndRemapError('Account#removeTables error', this.logger));
  }

  /**
   * Runs the account through schema validation and eventually throw if not valid
   * @param {any} account
   * TODO: Describe account
   */
  public objectNormalize(account: any) {
    const report: boolean = this.schema.validate(account, {
      id        : 'Account',
      object    : true,
      properties: this.filter,
    });

    if (!report) {
      throw new Error(`Failed to validate account schema: ${this.schema.getLastErrors()
        .map((err) => err.message).join(', ')}`);
    }
    return account;
  }

  /**
   * Verifies validity of public Key
   * @param {string} publicKey
   * @param {boolean} allowUndefined
   */
  public assertPublicKey(publicKey: string | Buffer, allowUndefined: boolean = true) {
    if (typeof(publicKey) !== 'undefined') {
      if (Buffer.isBuffer(publicKey)) {
        if (publicKey.length !== 32) {
          throw new Error('Invalid public key. If buffer it must be 32 bytes long');
        }
      } else {
        if (typeof(publicKey) !== 'string') {
          throw new Error('Invalid public key, must be a string');
        }
        if (publicKey.length !== 64) {
          throw new Error('Invalid public key, must be 64 characters long');
        }

        if (!this.schema.validate(publicKey, { format: 'hex' })) {
          throw new Error('Invalid public key, must be a hex string');
        }
      }
    } else if (!allowUndefined) {
      throw new Error('Public Key is undefined');
    }
  }

  /**
   * Get account information for specific fields and filtering criteria
   */
  // tslint:disable-next-line max-line-length
  public get(filter: AccountFilterData, fields: FieldsInModel<AccountsModel> = this.fields.map((field) => field.alias || field.field) as any): Promise<AccountsModel> {
    return this.getAll(filter, fields)
      .then((res) => res[0]);
  }

  /**
   * Get accountS information for specific fields and filtering criteria.
   */
  public getAll(filter: AccountFilterData, fields?: FieldsInModel<AccountsModel>): Promise<AccountsModel[]> {
    if (!Array.isArray(fields)) {
      fields = this.fields.map((field) => field.alias || field.field) as any;
    }

    const theFields = fields;

    const realFields = this.fields
      .filter((field) => theFields.indexOf(field.alias || field.field as any) !== -1)
      .map((f) => f.alias || f.field);

    const realConv = {};
    Object.keys(this.conv)
      .filter((key) => theFields.indexOf(key as any) !== -1)
      .forEach((key) => realConv[key] = this.conv[key]);

    const limit: number  = filter.limit > 0 ? filter.limit : undefined;
    const offset: number = filter.offset > 0 ? filter.offset : undefined;
    const sort: any      = filter.sort ? filter.sort : undefined;

    const condition: any = { ...filter, ...{ limit: undefined, offset: undefined, sort: undefined } };
    if (typeof(filter.address) === 'string') {
      condition.address = {
        $upper: ['address', filter.address],
      };
    }
    // Remove fields = undefined (such as limit, offset and sort)
    Object.keys(condition).forEach((k) => {
      if (typeof(condition[k]) === 'undefined') {
        delete condition[k];
      }
    });

    let scope = null;
    if (realFields.indexOf('delegates') !== -1 || realFields.indexOf('multisignatures') !== -1) {
      if (realFields.indexOf('u_delegates') !== -1 || realFields.indexOf('u_multisignatures') !== -1) {
        scope = 'full';
      } else {
        scope = 'fullConfirmed';
      }
    }

    return Promise.resolve(
      AccountsModel.scope(scope).findAll({
        // attributes: realFields,
        limit,
        offset,
        order: typeof(sort) === 'string' ?
          [[sort, 'ASC']] :
          Object.keys(sort).map((col) => [col, sort[col] === -1 ? 'DESC' : 'ASC']),
        where: condition,
      })
    );

  }

  /**
   * Sets fields for specific address in mem_accounts table
   * @param {string} address
   * @param fields
   */
  public async set(address: string, fields: ModelAttributes<AccountsModel>) {
    this.assertPublicKey(fields.publicKey);
    address        = String(address).toUpperCase();
    fields.address = address;

    await AccountsModel.upsert(fields);
  }

  /**
   * @param {string} address
   * @param diff
   * @returns {any}
   */
  public merge(address: string, diff: AccountDiffType): Array<DBOp<any>> {
    const update: any             = {};
    const remove: any             = {};
    const insert: any             = {};
    address                       = address.toUpperCase();
    const dbOps: Array<DBOp<any>> = [];

    this.assertPublicKey(diff.publicKey);
    for (const fieldName of this.editable) {
      if (typeof(diff[fieldName]) === 'undefined') {
        continue;
      }
      const trueValue = diff[fieldName];
      switch (this.conv[fieldName]) {
        case String:
          update[fieldName] = trueValue;
          break;
        case Number:
          if (isNaN(trueValue) || trueValue === Infinity) {
            throw new Error(`Encountered insane number: ${trueValue}`);
          }
          if (Math.abs(trueValue) === trueValue && trueValue !== 0) {
            update[fieldName] = sequelize.literal(`${fieldName} + ${Math.floor(trueValue)}`);
            if (fieldName === 'balance') {
              dbOps.push({
                model: RoundsModel,
                query: RoundsModel.insertMemRoundBalanceSQL({
                  address,
                  amount : trueValue,
                  blockId: diff.blockId,
                  round  : diff.round,
                }),
                type : 'custom',
              });
            }
          } else if (trueValue < 0) {
            update[fieldName] = sequelize.literal(`${fieldName} - ${Math.floor(Math.abs(trueValue))}`);
            // If decrementing u_balance on account
            if (update.u_balance) {
              // Remove virginity and ensure marked columns become immutable
              update.virgin = 0;
            }
            if (fieldName === 'balance') {
              dbOps.push({
                model: RoundsModel,
                query: RoundsModel.insertMemRoundBalanceSQL({
                  address,
                  amount : trueValue,
                  blockId: diff.blockId,
                  round  : diff.round,
                }),
                type : 'custom',
              });
            }
          }
          break;
        case Array:

          for (const val of (trueValue as string[])) {
            const sign: string = val[0];
            if (sign !== '-') {
              const theVal      = sign === '+' ? val.slice(1) : val;
              insert[fieldName] = insert[fieldName] || [];
              insert[fieldName].push(theVal);
              if (fieldName === 'delegates') {
                dbOps.push({
                  model: RoundsModel,
                  query: RoundsModel.insertMemRoundDelegatesSQL({
                    add     : true,
                    address,
                    blockId : diff.blockId,
                    delegate: theVal,
                    round   : diff.round,
                  }),
                  type : 'custom',
                });
              }
            } else {
              const theVal      = val.slice(1);
              remove[fieldName] = remove[fieldName] || [];
              remove[fieldName].push(theVal);
              if (fieldName === 'delegates') {
                dbOps.push({
                  model: RoundsModel,
                  query: RoundsModel.insertMemRoundDelegatesSQL({
                    add     : false,
                    address,
                    blockId : diff.blockId,
                    delegate: theVal,
                    round   : diff.round,
                  }),
                  type : 'custom',
                });
              }
            }
          }
          break;
      }

    }

    function elToModel(el: string) {
      switch (el) {
        case 'delegates':
          return Accounts2DelegatesModel;
        case 'u_delegates':
          return Accounts2U_DelegatesModel;
        case 'multisignatures':
          return Accounts2MultisignaturesModel;
        case 'u_multisignatures':
          return Accounts2U_MultisignaturesModel;
        default:
          throw new Error(`Unknown el ${el}`);
      }
    }

    // Create insert ops.
    Object.keys(insert)
      .forEach((el) => {
        const model = elToModel(el);
        insert[el].forEach((dependentId) => {
          dbOps.push({
            model,
            type  : 'create',
            values: {
              accountId: address,
              dependentId,
            },
          });
        });
      });

    // Create remove ops
    Object.keys(remove)
      .forEach((el) => {
        const model = elToModel(el);
        dbOps.push({
          model,
          options: {
            where: {
              accountId  : address,
              dependentId: { $in: remove[el] },
            },
          },
          type   : 'remove',
        });

      });

    dbOps.push({
      model  : AccountsModel,
      options: {
        limit: 1,
        where: { address },
      },
      type   : 'update',
      values : update,
    });

    return dbOps;
  }

  /**
   * Removes an account from mem_account table based on address.
   * @param {string} address
   * @returns {Promise<number>}
   */
  public async remove(address: string): Promise<number> {
    return await AccountsModel.destroy({ where: { address } });
  }

  public generateAddressByPublicKey(publicKey: string): string {
    this.assertPublicKey(publicKey, false);

    const hash = crypto.createHash('sha256')
      .update(new Buffer(publicKey, 'hex'))
      .digest();

    const tmp = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) {
      tmp[i] = hash[7 - i];
    }
    return `${BigNum.fromBuffer(tmp).toString()}R`;
  }
}
