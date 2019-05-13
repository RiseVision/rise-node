import { CoreSymbols } from '@risevision/core';
import { LaunchpadSymbols } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import {
  AccountDiffType,
  AccountFilterData,
  Address,
  ConstantsType,
  DBOp,
  IAccountLogic,
  IAccountsModel,
  IIdsHandler,
  ILogger,
  Symbols,
} from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import * as sequelize from 'sequelize';
import * as z_schema from 'z-schema';
import { AccountsSymbols } from '../symbols';

@injectable()
export class AccountLogic implements IAccountLogic {
  @inject(CoreSymbols.constants)
  private constants: ConstantsType;

  @inject(Symbols.helpers.idsHandler)
  private idsHandler: IIdsHandler;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(ModelSymbols.model)
  @named(AccountsSymbols.model)
  private AccountsModel: typeof IAccountsModel;

  @inject(LaunchpadSymbols.zschema)
  private schema: z_schema;

  /**
   * Get account information for specific fields and filtering criteria
   */
  // tslint:disable-next-line max-line-length
  public get(filter: AccountFilterData): Promise<IAccountsModel> {
    return this.getAll(filter).then((res) => res[0]);
  }

  /**
   * Get accountS information for specific fields and filtering criteria.
   */
  public getAll(filter: AccountFilterData): Promise<IAccountsModel[]> {
    const sort: any = filter.sort ? filter.sort : {};

    const { limit, offset } = filter;

    delete filter.sort;
    delete filter.limit;
    delete filter.offset;

    // Remove fields = undefined (such as limit, offset and sort)
    Object.keys(filter).forEach((k) => {
      if (typeof filter[k] === 'undefined') {
        delete filter[k];
      }
    });

    return this.AccountsModel.findAll({
      limit: limit > 0 ? limit : undefined,
      offset: offset > 0 ? offset : undefined,
      order:
        typeof sort === 'string'
          ? [[sort, 'ASC']]
          : Object.keys(sort).map((col) => [
              col,
              sort[col] === -1 ? 'DESC' : 'ASC',
            ]),
      where: filter,
    });
  }

  /**
   * @param {string} address
   * @param diff
   * @returns {any}
   */
  // tslint:disable-next-line cognitive-complexity
  public mergeBalanceDiff(
    address: Address,
    diff: { balance?: bigint; u_balance?: bigint }
  ): Array<DBOp<any>> {
    const update: any = {};
    const dbOps: Array<DBOp<any>> = [];

    ['balance', 'u_balance'].forEach((column) => {
      if (typeof diff[column] === 'bigint') {
        const operand = diff[column] > 0 ? '+' : '-';
        const value = diff[column] > 0 ? diff[column] : -diff[column];
        update[column] = sequelize.literal(`${column} ${operand} ${value}`);
        if (operand === '-') {
          update.virgin = 0;
        }
      }
    });

    dbOps.push({
      model: this.AccountsModel,
      options: {
        limit: 1,
        where: { address },
      },
      type: 'update',
      values: update,
    });

    return dbOps;
  }

  public generateAddressFromPubData(pubData: Buffer): Address {
    return this.idsHandler.addressFromPubData(pubData);
  }
}
