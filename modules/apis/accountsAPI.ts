import { BodyParams, Controller, Get, Post, Put, QueryParams } from 'ts-express-decorators';
import { cbToPromise } from '../../helpers/promiseToCback';
import accountSchema from '../../schema/accounts';
import { AccountsModule } from '../accounts';
import { SchemaValid, ValidateSchema } from './baseAPIClass';

@Controller('/accounts')
class AccountsPublicAPI {
  public schema: any;

  constructor(private accounts: AccountsModule) {
    this.schema = accounts.library.schema;
  }

  @Get('/getBalance')
  @ValidateSchema
  public async getBalance(@SchemaValid(accountSchema.getBalance)
                          @QueryParams() params: { address: string }) {
    const account            = await this.accounts
      .getAccount({address: params.address});
    const balance            = account ? account.balance : 0;
    const unconfirmedBalance = account ? account.u_balance : 0;
    return {balance, unconfirmedBalance};
  }

  @Get('/getPublicKey')
  @ValidateSchema
  public async getPublickey(@SchemaValid(accountSchema.getPublicKey)
                            @QueryParams() params: { address: string }) {
    const account = await this.accounts
      .getAccount({address: params.address});

    return {publicKey: account.publicKey};
  }

  @Get('/delegates')
  @ValidateSchema
  public async getDelegates(@SchemaValid(accountSchema.getDelegates)
                            @QueryParams() params: { address: string }) {
    const account = await this.accounts
      .getAccount({address: params.address});

    if (account.delegates) {
      const delegates = await cbToPromise<string[]>((cb) => this.accounts.modules
        .delegates.getDelegates(params, cb));
      return {
        delegates: delegates.filter((d) => account.delegates.indexOf(d) !== -1)
      };
    }
    return {publicKey: account.publicKey};
  }

  @Get('/delegates/fee')
  @ValidateSchema
  public async getDelegatesFee(@SchemaValid(accountSchema.getDelegatesFee)
                               @QueryParams() params: { height: number }) {
    return {
      fee: this.accounts.modules.system.getFees(params.height).delegate,
    };
  }

  @Post('/open')
  @ValidateSchema
  public async open(@SchemaValid(accountSchema.open)
                    @BodyParams() body: { secret: string }): Promise<any> {
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
  @Put('delegates')
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
