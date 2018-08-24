import * as crypto from 'crypto';
import * as filterObject from 'filter-object';
import * as fs from 'fs';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as sequelize from 'sequelize';
import { Op } from 'sequelize';
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
  RoundsModel
} from '../models/';
import { DBOp } from '../types/genericTypes';
import { FieldsInModel, ModelAttributes } from '../types/utils';
import { accountsModelCreator } from './models/account';
import { IModelField, IModelFilter } from './models/modelField';

import { AccountDiffType } from '../ioc/interfaces/logic';

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

  @inject(Symbols.models.accounts2Delegates)
  private Accounts2DelegatesModel: typeof Accounts2DelegatesModel;
  @inject(Symbols.models.accounts2Multisignatures)
  private Accounts2MultisignaturesModel: typeof Accounts2MultisignaturesModel;
  @inject(Symbols.models.accounts2U_Delegates)
  // tslint:disable-next-line
  private Accounts2U_DelegatesModel: typeof Accounts2U_DelegatesModel;
  @inject(Symbols.models.accounts2U_Multisignatures)
  // tslint:disable-next-line
  private Accounts2U_MultisignaturesModel: typeof Accounts2U_MultisignaturesModel;
  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;
  @inject(Symbols.models.rounds)
  private RoundsModel: typeof RoundsModel;

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
      this.AccountsModel.sequelize.query(
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
  public async removeTables(): Promise<void> {
    const models = [
      this.AccountsModel,
      this.RoundsModel,
      this.Accounts2DelegatesModel,
      this.Accounts2MultisignaturesModel,
      this.Accounts2U_DelegatesModel,
      this.Accounts2U_MultisignaturesModel];
    for (const model of models) {
      await model.drop({cascade: true})
        .catch(catchToLoggerAndRemapError('Account#removeTables error', this.logger));
    }
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
  public get(filter: AccountFilterData, fields?: FieldsInModel<AccountsModel>): Promise<AccountsModel> {
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

    const sort: any = filter.sort ? filter.sort : {};

    const condition: any = filterObject(filter, ['isDelegate', 'username', 'address', 'publicKey']);
    if (typeof(filter.address) === 'string') {
      condition.address = filter.address.toUpperCase();
    } else if (typeof (filter.address) !== 'undefined') {
      condition.address = { [Op.in]: filter.address.$in.map((add) => add.toUpperCase()) };
    }
    // Remove fields = undefined (such as limit, offset and sort)
    Object.keys(condition).forEach((k) => {
      if (typeof(condition[k]) === 'undefined') {
        delete condition[k];
      }
    });

    let scope = null;
    if (realFields.indexOf('u_delegates') !== -1 || realFields.indexOf('u_multisignatures') !== -1) {
      scope = 'full';
    } else if (realFields.indexOf('delegates') !== -1 || realFields.indexOf('multisignatures') !== -1) {
      scope = 'fullConfirmed';
    }

    return Promise.resolve(
      this.AccountsModel.scope(scope).findAll({
        // attributes: realFields, // NOTE: do not re-SET!
        limit : filter.limit > 0 ? filter.limit : undefined,
        offset: filter.offset > 0 ? filter.offset : undefined,
        order : typeof(sort) === 'string' ?
          [[sort, 'ASC']] :
          Object.keys(sort).map((col) => [col, sort[col] === -1 ? 'DESC' : 'ASC']),
        where : condition,
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
    // TODO: check if publicKey and address are coherent. ?
    await this.AccountsModel.upsert(fields);
  }

  /**
   * @param {string} address
   * @param diff
   * @returns {any}
   */
  public merge(address: string, diff: AccountDiffType): Array<DBOp<any>> {
    const update: any             = {};
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
                model: this.RoundsModel,
                query: this.RoundsModel.insertMemRoundBalanceSQL({
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
                model: this.RoundsModel,
                query: this.RoundsModel.insertMemRoundBalanceSQL({
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
      }

    }

    dbOps.push({
      model  : this.AccountsModel,
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
    return await this.AccountsModel.destroy({ where: { address: address.toUpperCase() } });
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
