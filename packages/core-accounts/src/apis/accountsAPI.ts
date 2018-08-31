import 'reflect-metadata';
import { CoreSymbols } from '@risevision/core';
import { DeprecatedAPIError } from '@risevision/core-apis';
import { IAccountsModel, IAccountsModule, ISystemModule, Symbols } from '@risevision/core-interfaces';
import { LaunchpadSymbols } from '@risevision/core-launchpad';
import { AppConfig, ConstantsType, FieldsInModel, publicKey } from '@risevision/core-types';
import { HTTPError, IoCSymbol, SchemaValid, ValidateSchema } from '@risevision/core-utils';
import * as filterObject from 'filter-object';
import { inject, injectable } from 'inversify';
import * as isEmpty from 'is-empty';
import { WordPressHookSystem } from 'mangiafuoco';
import { Body, Get, JsonController, Post, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { AccountsSymbols } from '../symbols';
import { FilterAPIGetAccount } from '../hooks';

const accountSchema = require('../../schema/accounts.json');
@JsonController('/api/accounts')
@injectable()
@IoCSymbol(AccountsSymbols.api)
export class AccountsAPI {
  @inject(LaunchpadSymbols.zschema)
  public schema: z_schema;
  @inject(AccountsSymbols.module)
  private accountsModule: IAccountsModule;
  @inject(CoreSymbols.modules.system)
  private systemModule: ISystemModule;

  @inject(LaunchpadSymbols.hookSystem)
  private hookSystem: WordPressHookSystem;
  @inject(LaunchpadSymbols.appConfig)
  private appConfig: AppConfig;
  @inject(LaunchpadSymbols.constants)
  private constants: ConstantsType;

  @Get('/')
  @ValidateSchema()
  public async getAccount(@SchemaValid(accountSchema.getAccount)
                          @QueryParams() query: { address?: string, publicKey?: publicKey }) {
    if (isEmpty(query.address) && isEmpty(query.publicKey)) {
      throw new HTTPError('Missing required property: address or publicKey', 200);
    }

    const address = !isEmpty(query.publicKey)
      ? this.accountsModule.generateAddressByPublicKey(Buffer.from(query.publicKey, 'hex'))
      : query.address;

    if (!isEmpty(query.address) && !isEmpty(query.publicKey) && address !== query.address) {
      throw new HTTPError('Account publicKey does not match address', 200);
    }
    const theQuery: { address: string, publicKey?: Buffer } = { address };
    if (!isEmpty(query.publicKey)) {
      theQuery.publicKey = Buffer.from(query.publicKey, 'hex');
    }
    const accData = await this.accountsModule.getAccount(theQuery);
    if (!accData) {
      throw new HTTPError('Account not found', 200);
    }
    return {
      account: await this.hookSystem.apply_filters(
        FilterAPIGetAccount.name,
        {
          address           : accData.address,
          balance           : `${accData.balance}`,
          publicKey         : accData.hexPublicKey,
          unconfirmedBalance: `${accData.u_balance}`,
        },
        accData
      ),
    };
  }

  @Get('/getBalance')
  @ValidateSchema()
  public async getBalance(@SchemaValid(accountSchema.getBalance)
                          @QueryParams() params: { address: string }) {
    const account            = await this.accountsModule
      .getAccount({ address: params.address });
    const balance            = account ? `${account.balance}` : '0';
    const unconfirmedBalance = account ? `${account.u_balance}` : '0';
    return { balance, unconfirmedBalance };
  }

  @Get('/getPublicKey')
  @ValidateSchema()
  public async getPublickey(@SchemaValid(accountSchema.getPublicKey)
                            @QueryParams() params: { address: string }) {
    const account = await this.accountsModule
      .getAccount({ address: params.address });
    if (!account) {
      throw new HTTPError('Account not found', 200);
    }
    return { publicKey: account.hexPublicKey };
  }

  @Get('/top')
  @ValidateSchema()
  public async topAccounts(@SchemaValid(accountSchema.top, { castNumbers: true })
                           @QueryParams() params: { limit?: number, offset?: number }) {
    if (!this.appConfig.topAccounts) {
      throw new HTTPError('Top Accounts is not enabled', 403);
    }
    let { limit, offset }                             = params;
    limit                                             = limit || 100;
    offset                                            = offset || 0;
    const returnFields: FieldsInModel<IAccountsModel> = ['address', 'balance', 'publicKey'];
    const accs                                        = await this.accountsModule
      .getAccounts({
          limit,
          offset,
          sort: { balance: -1 },
        }
      );

    return {
      accounts: accs
        .map((acc) => acc.toPOJO())
        .map((acc) => filterObject(acc, returnFields)),

    };
  }

  @Post('/open')
  @ValidateSchema()
  public async open(@SchemaValid(accountSchema.open)
                    @Body() body: { secret: string }): Promise<any> {
    throw new DeprecatedAPIError();
  }

}
