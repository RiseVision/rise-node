import * as filterObject from 'filter-object';
import { inject, injectable } from 'inversify';
import * as isEmpty from 'is-empty';
import { Body, Get, JsonController, Post, Put, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { DeprecatedEndpoint } from '../helpers/decorators/deprecatedEndpoint';
import { ResponseSchema, OpenAPI } from 'rc-openapi-gen';
import { IAccountsModule, IDelegatesModule, ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { AccountsModel } from '../models';
import accountSchema from '../schema/accounts';
import { AppConfig } from '../types/genericTypes';
import { publicKey } from '../types/sanityTypes';
import { FieldsInModel } from '../types/utils';
import { APIError, DeprecatedAPIError } from './errors';
import { md } from '../helpers/strings';

@JsonController('/api/accounts')
@injectable()
@IoCSymbol(Symbols.api.accounts)
export class AccountsAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.delegates)
  private delegatesModule: IDelegatesModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;

  @Get('/')
  @OpenAPI({
    summary: 'Get Account',
    description: 'Retrieve an account object by its address or public key'
  })
  @ResponseSchema('responses.accounts.getAccount')
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
    const theQuery: { address: string, publicKey?: Buffer } = {address};
    if (!isEmpty(query.publicKey)) {
      theQuery.publicKey = Buffer.from(query.publicKey, 'hex');
    }
    const accData = await this.accountsModule.getAccount(theQuery);
    if (!accData) {
      throw new APIError('Account not found', 200);
    }
    return {
      account: {
        address             : accData.address,
        balance             : `${accData.balance}`,
        multisignatures     : accData.multisignatures || [],
        publicKey           : accData.hexPublicKey,
        secondPublicKey     : accData.secondPublicKey === null ? null : accData.secondPublicKey.toString('hex'),
        secondSignature     : accData.secondSignature,
        u_multisignatures   : accData.u_multisignatures || [],
        unconfirmedBalance  : `${accData.u_balance}`,
        unconfirmedSignature: accData.u_secondSignature,
      },
    };
  }

  @Get('/getBalance')
  @OpenAPI({
    summary: 'Get Balance',
    description: "Retrieve an account's RISE balance its address"
  })
  @ResponseSchema('responses.accounts.getBalance')
  @ValidateSchema()
  public async getBalance(@SchemaValid(accountSchema.getBalance)
                          @QueryParams() params: { address: string }) {
    const account            = await this.accountsModule
      .getAccount({address: params.address});
    const balance            = account ? `${account.balance}` : '0';
    const unconfirmedBalance = account ? `${account.u_balance}` : '0';
    return {balance, unconfirmedBalance};
  }

  @Get('/getPublicKey')
  @OpenAPI({
    summary: 'Get Public Key',
    description: "Retrieve an account's public key by its address"
  })
  @ResponseSchema('responses.accounts.getPublickey')
  @ValidateSchema()
  public async getPublickey(@SchemaValid(accountSchema.getPublicKey)
                            @QueryParams() params: { address: string }) {
    const account = await this.accountsModule
      .getAccount({address: params.address});
    if (!account) {
      throw new APIError('Account not found', 200);
    }
    return {publicKey: account.hexPublicKey};
  }

  @Get('/delegates')
  @OpenAPI({
    summary: 'Get Account Delegates',
    description: "Fetch a list of delegates a certain account has voted for"
  })
  @ResponseSchema('responses.accounts.getDelegates')
  @ValidateSchema()
  public async getDelegates(@SchemaValid(accountSchema.getDelegates)
                            @QueryParams() params: { address: string }) {
    const account = await this.accountsModule
      .getAccount({address: params.address});
    if (!account) {
      throw new APIError('Account not found', 200);
    }
    if (account.delegates) {
      const {delegates} = await this.delegatesModule.getDelegates({orderBy: 'rank:desc'});
      return {
        delegates: delegates
          .filter((d) => account.delegates.indexOf(d.delegate.hexPublicKey) !== -1)
          .map((d) => ({
            address       : d.delegate.address,
            approval      : d.info.approval,
            missedblocks  : d.delegate.missedblocks,
            producedblocks: d.delegate.producedblocks,
            productivity  : d.info.productivity,
            publicKey     : d.delegate.hexPublicKey,
            rank          : d.info.rank,
            rate          : d.info.rank,
            username      : d.delegate.username,
            vote          : d.delegate.vote,
          })),
      };
    }
    return {publicKey: account.publicKey};
  }

  @Get('/delegates/fee')
  @OpenAPI({
    summary: 'Get Delegates Fee',
    description: md`
      Get the fee for registering as a delegate at a certain height of the blockchain
      (omit the height for the current fee).
    `
  })
  @ResponseSchema('responses.accounts.getDelegatesFee')
  @ValidateSchema()
  public async getDelegatesFee(@SchemaValid(accountSchema.getDelegatesFee, {castNumbers: true})
                               @QueryParams() params: { height: number }) {
    return {
      fee: this.systemModule.getFees(params.height).fees.delegate,
    };
  }

  @Get('/top')
  @OpenAPI({
    summary: 'Get Top Accounts',
    description: md`
      Get a list of accounts sorted by descending balance.
      _Top accounts must be enabled on the providing node_
    `
  })
  @ResponseSchema('responses.accounts.top')
  @ResponseSchema('responses.general.error', {
    statusCode: 403,
    description: "Top Accounts is not enabled"
  })
  @ValidateSchema()
  public async topAccounts(@SchemaValid(accountSchema.top, {castNumbers: true})
                           @QueryParams() params: { limit?: number, offset?: number }) {
    if (!this.appConfig.topAccounts) {
      throw new APIError('Top Accounts is not enabled', 403);
    }
    let {limit, offset} = params;
    limit = limit || 100;
    offset = offset || 0;
    const returnFields: FieldsInModel<AccountsModel> = ['address', 'balance', 'publicKey'];
    const accs = await this.accountsModule
      .getAccounts({
          limit,
          offset,
          sort: {balance: -1},
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
  @OpenAPI({
    summary: 'Open Account',
    description: md`
      _**Deprecated**: Please use the [Transactions API](#tag/Transactions-API)_.
      Registers a delegate.
    `
  })
  @DeprecatedEndpoint()
  @ValidateSchema()
  public async open(@SchemaValid(accountSchema.open)
                    @Body() body: { secret: string }): Promise<any> {}

  /**
   * @deprecated
   */
  @Put('/delegates')
  @OpenAPI({
    summary: 'Add Delegate',
    description: md`
      _**Deprecated**: Please use the [Transactions API](#tag/Transactions-API)_.
      Registers a delegate.
    `
  })
  @DeprecatedEndpoint()
  public async addDelegate() {}

  /**
   * @deprecated
   */
  @Post('/generatePublicKey')
  @OpenAPI({
    summary: 'Generate Public Key',
    description: md`
      _**Deprecated**: Please use a client library like
      [vekexasia/dpos-offline](https://github.com/vekexasia/dpos-offline)
      to generate public keys_. Generates a public key.
    `
  })
  @DeprecatedEndpoint()
  public async generatePublicKey() {}

}
