import { inject, injectable } from 'inversify';
import { Body, Get, JsonController, Post, Put, QueryParams, UseInterceptor } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { IAccountsModule, IDelegatesModule, ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import accountSchema from '../schema/accounts';
import { SchemaValid, ValidateSchema } from './baseAPIClass';

@JsonController('/accounts')
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

  @Get('/getBalance')
  @ValidateSchema()
  public async getBalance(@SchemaValid(accountSchema.getBalance)
                          @QueryParams() params: { address: string }) {
    const account            = await this.accountsModule
      .getAccount({ address: params.address });
    const balance            = account ? account.balance : 0;
    const unconfirmedBalance = account ? account.u_balance : 0;
    return { balance, unconfirmedBalance };
  }

  @Get('/getPublicKey')
  @ValidateSchema()
  public async getPublickey(@SchemaValid(accountSchema.getPublicKey)
                            @QueryParams() params: { address: string }) {
    const account = await this.accountsModule
      .getAccount({ address: params.address });

    return { publicKey: account.publicKey };
  }

  @Get('/delegates')
  @ValidateSchema()
  public async getDelegates(@SchemaValid(accountSchema.getDelegates)
                            @QueryParams() params: { address: string }) {
    const account = await this.accountsModule
      .getAccount({ address: params.address });

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
    throw new Error('Method is not supported anymore');
    // const accountData = await this.accounts.openAccount(body.secret);
    // return {
    //  account: {
    //    address             : accountData.address,
    //    unconfirmedBalance  : accountData.u_balance,
    //    balance             : accountData.balance,
    //    publicKey           : accountData.publicKey,
    //    unconfirmedSignature: accountData.u_secondSignature,
    //    secondSignature     : accountData.secondSignature,
    //    secondPublicKey     : accountData.secondPublicKey,
    //    multisignatures     : accountData.multisignatures,
    //    u_multisignatures   : accountData.u_multisignatures
    //  },
    // };

  }

  /**
   * @deprecated
   */
  @Put('/delegates')
  public async addDelegate() {
    throw new Error('Method is now deprecated');
  }

  /**
   * @deprecated
   */
  @Post('/generatePublicKey')
  public async generatePublicKey() {
    throw new Error('Method is now deprecated');
  }

}
