import { inject, injectable } from 'inversify';
import * as isEmpty from 'is-empty';
import { Body, Get, JsonController, Post, Put, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { IAccountsModule, IDelegatesModule, ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import accountSchema from '../schema/accounts';
import { publicKey } from '../types/sanityTypes';
import { APIError, DeprecatedAPIError } from './errors';

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
    const accData = await this.accountsModule.getAccount(query);
    if (!accData) {
      throw new APIError('Account not found', 200);
    }
    return {
      account: {
        address             : accData.address,
        balance             : accData.balance,
        multisignatures     : accData.multisignatures || [],
        publicKey           : accData.publicKey,
        secondPublicKey     : accData.secondPublicKey,
        secondSignature     : accData.secondSignature,
        u_multisignatures   : accData.u_multisignatures || [],
        unconfirmedBalance  : accData.u_balance,
        unconfirmedSignature: accData.u_secondSignature,
      },
    };
  }

  @Get('/getBalance')
  @ValidateSchema()
  public async getBalance(@SchemaValid(accountSchema.getBalance)
                          @QueryParams() params: { address: string }) {
    const account            = await this.accountsModule
      .getAccount({ address: params.address });
    const balance            = account ? account.balance : '0';
    const unconfirmedBalance = account ? account.u_balance : '0';
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
    return { publicKey: account.publicKey };
  }

  @Get('/delegates')
  @ValidateSchema()
  public async getDelegates(@SchemaValid(accountSchema.getDelegates)
                            @QueryParams() params: { address: string }) {
    const account = await this.accountsModule
      .getAccount({ address: params.address });
    if (!account) {
      throw new APIError('Account not found', 200);
    }
    if (account.delegates) {
      const { delegates } = await this.delegatesModule.getDelegates({ orderBy: 'rank:desc' });
      return {
        delegates: delegates.filter((d) => account.delegates.indexOf(d.publicKey) !== -1),
      };
    }
    return { publicKey: account.publicKey };
  }

  @Get('/delegates/fee')
  @ValidateSchema()
  public async getDelegatesFee(@SchemaValid(accountSchema.getDelegatesFee)
                               @QueryParams() params: { height: number }) {
    return {
      fee: this.systemModule.getFees(params.height).fees.delegate,
    };
  }

  @Post('/open')
  @ValidateSchema()
  public async open(@SchemaValid(accountSchema.open)
                    @Body() body: { secret: string }): Promise<any> {
    throw new DeprecatedAPIError();
  }

  /**
   * @deprecated
   */
  @Put('/delegates')
  public async addDelegate() {
    throw new DeprecatedAPIError();
  }

  /**
   * @deprecated
   */
  @Post('/generatePublicKey')
  public async generatePublicKey() {
    throw new DeprecatedAPIError();
  }

}
