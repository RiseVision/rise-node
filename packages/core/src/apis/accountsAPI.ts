import { APIError, DeprecatedAPIError } from '@risevision/core-apis';
import { IoCSymbol, SchemaValid, Symbols, ValidateSchema } from '@risevision/core-helpers';
import { IAccountsModel, IAccountsModule, ISystemModule } from '@risevision/core-interfaces';
import { AppConfig, FieldsInModel, publicKey } from '@risevision/core-types';
import * as filterObject from 'filter-object';
import { inject, injectable } from 'inversify';
import * as isEmpty from 'is-empty';
import { WordPressHookSystem } from 'mangiafuoco';
import { Body, Get, JsonController, Post, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';

const accountSchema = require('../../schema/accounts.json');

@JsonController('/api/accounts')
@injectable()
@IoCSymbol(Symbols.api.accounts)
export class AccountsAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(Symbols.generic.hookSystem)
  private hookSystem: WordPressHookSystem;
  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;

  @Get('/')
  @ValidateSchema()
  public async getAccount(@SchemaValid(accountSchema.getAccount)
                          @QueryParams() query: { address?: string, publicKey?: publicKey }) {
    if (isEmpty(query.address) && isEmpty(query.publicKey)) {
      throw new APIError('Missing required property: address or publicKey', 200);
    }

    const address = !isEmpty(query.publicKey)
      ? this.accountsModule.generateAddressByPublicKey(query.publicKey)
      : query.address;

    if (!isEmpty(query.address) && !isEmpty(query.publicKey) && address !== query.address) {
      throw new APIError('Account publicKey does not match address', 200);
    }
    const theQuery: { address: string, publicKey?: Buffer } = { address };
    if (!isEmpty(query.publicKey)) {
      theQuery.publicKey = Buffer.from(query.publicKey, 'hex');
    }
    const accData = await this.accountsModule.getAccount(theQuery);
    if (!accData) {
      throw new APIError('Account not found', 200);
    }
    return {
      account: await this.hookSystem.apply_filters(
        'core/apis/accounts/account',
        {
          address           : accData.address,
          balance           : `${accData.balance}`,
          // multisignatures     : accData.multisignatures || [],
          publicKey         : accData.hexPublicKey,
          // secondPublicKey     : accData.secondPublicKey === null ? null : accData.secondPublicKey.toString('hex'),
          // secondSignature     : accData.secondSignature,
          // u_multisignatures   : accData.u_multisignatures || [],
          unconfirmedBalance: `${accData.u_balance}`,
          // unconfirmedSignature: accData.u_secondSignature,
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
      throw new APIError('Account not found', 200);
    }
    return { publicKey: account.hexPublicKey };
  }

  @Get('/top')
  @ValidateSchema()
  public async topAccounts(@SchemaValid(accountSchema.top, { castNumbers: true })
                           @QueryParams() params: { limit?: number, offset?: number }) {
    if (!this.appConfig.topAccounts) {
      throw new APIError('Top Accounts is not enabled', 403);
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
        },
        returnFields
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
