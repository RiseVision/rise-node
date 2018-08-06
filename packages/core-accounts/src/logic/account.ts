import { CoreSymbols, RecreateAccountsTables } from '@risevision/core';
import {
  AccountDiffType,
  AccountFilterData,
  IAccountLogic,
  IAccountsModel,
  ILogger,
  Symbols
} from '@risevision/core-interfaces';
import { LaunchpadSymbols } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { catchToLoggerAndRemapError, MyBigNumb } from '@risevision/core-utils';
import { ConstantsType, DBOp, FieldsInModel, ModelAttributes } from '@risevision/core-types';
import * as crypto from 'crypto';
import * as filterObject from 'filter-object';
import * as fs from 'fs';
import { decorate, inject, injectable, named, postConstruct } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import * as path from 'path';
import * as sequelize from 'sequelize';
import { Op } from 'sequelize';
import * as z_schema from 'z-schema';
import { AccountsSymbols } from '../symbols';
import { accountsModelCreator } from './models/account';
import { IModelField, IModelFilter } from './models/modelField';

const DecoratedSubscriber = WPHooksSubscriber(Object);
decorate(injectable(), DecoratedSubscriber);

@injectable()
export class AccountLogic extends DecoratedSubscriber implements IAccountLogic {
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

  @inject(CoreSymbols.constants)
  private constants: ConstantsType;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(ModelSymbols.model)
  @named(AccountsSymbols.model)
  private AccountsModel: typeof IAccountsModel;

  @inject(LaunchpadSymbols.zschema)
  private schema: z_schema;

  @inject(LaunchpadSymbols.hookSystem)
  public hookSystem: WordPressHookSystem;

  @postConstruct()
  public postConstruct() {
    this.model = accountsModelCreator(this.table, this.constants);

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

  @RecreateAccountsTables()
  public async recreateTables(): Promise<void> {
    await this.AccountsModel.drop({ cascade: true })
      .catch(catchToLoggerAndRemapError('Account#removeTables error', this.logger));
    await this.AccountsModel.sequelize.query(
      fs.readFileSync(path.join(process.cwd(), 'sql', 'memoryTables.sql'), { encoding: 'utf8' })
    );
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
  public get(filter: AccountFilterData, fields?: FieldsInModel<IAccountsModel>): Promise<IAccountsModel> {
    return this.getAll(filter, fields)
      .then((res) => res[0]);
  }

  /**
   * Get accountS information for specific fields and filtering criteria.
   */
  public getAll(filter: AccountFilterData, fields?: FieldsInModel<IAccountsModel>): Promise<IAccountsModel[]> {
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
  public async set(address: string, fields: ModelAttributes<IAccountsModel>) {
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
          } else if (trueValue < 0) {
            update[fieldName] = sequelize.literal(`${fieldName} - ${Math.floor(Math.abs(trueValue))}`);
            // If decrementing u_balance on account
            if (update.u_balance) {
              // Remove virginity and ensure marked columns become immutable
              update.virgin = 0;
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

  public generateAddressByPublicKey(publicKey: Buffer): string {
    this.assertPublicKey(publicKey, false);

    const hash = crypto.createHash('sha256')
      .update(publicKey)
      .digest();

    const tmp = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) {
      tmp[i] = hash[7 - i];
    }
    return `${MyBigNumb.fromBuffer(tmp).toString()}R`;
  }
}
