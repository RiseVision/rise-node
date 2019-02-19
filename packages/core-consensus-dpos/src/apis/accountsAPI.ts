import { AccountsSymbols } from '@risevision/core-accounts';
import { DeprecatedAPIError } from '@risevision/core-apis';
import {
  IAccountsModule,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import {
  HTTPError,
  IoCSymbol,
  SchemaValid,
  ValidateSchema,
} from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import {
  Get,
  JsonController,
  Post,
  Put,
  QueryParams,
} from 'routing-controllers';
import * as z_schema from 'z-schema';
import { dPoSSymbols } from '../helpers/';
import { Accounts2DelegatesModel, AccountsModelForDPOS } from '../models';
import { DelegatesModule } from '../modules';

// tslint:disable-next-line no-var-requires
const schema = require('../../schema/accountsAPI.json');

@JsonController('/api/accounts')
@injectable()
@IoCSymbol(dPoSSymbols.accountsAPI)
export class AccountsAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(dPoSSymbols.modules.delegates)
  private delegatesModule: DelegatesModule;

  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.accounts2Delegates)
  private Accounts2DelegatesModel: typeof Accounts2DelegatesModel;
  @inject(ModelSymbols.model)
  @named(AccountsSymbols.model)
  private AccountsModel: typeof AccountsModelForDPOS;

  @inject(Symbols.modules.system)
  private system: ISystemModule;

  @Get('/votes')
  @ValidateSchema()
  public async getDelegates(@SchemaValid(schema.getDelegates)
  @QueryParams()
  params: {
    address: string;
  }) {
    const rows = await this.Accounts2DelegatesModel.findAll({
      attributes: ['username'],
      raw: true,
      where: { address: params.address },
    });
    const usernames = rows.map((r) => r.username);

    return { votes: usernames };
  }

  @Put('/delegates')
  public async addDelegate() {
    throw new DeprecatedAPIError();
  }

  @Post('/generatePublicKey')
  public async generatePublicKey() {
    throw new DeprecatedAPIError();
  }
}
