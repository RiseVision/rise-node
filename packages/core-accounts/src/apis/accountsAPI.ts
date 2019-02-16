import { CoreSymbols } from '@risevision/core';
import { DeprecatedAPIError } from '@risevision/core-apis';
import { toTransportable } from '@risevision/core-helpers';
import {
  IAccountsModel,
  IAccountsModule,
  ISystemModule,
} from '@risevision/core-interfaces';
import { LaunchpadSymbols } from '@risevision/core-launchpad';
import {
  AppConfig,
  ConstantsType,
  FieldsInModel,
} from '@risevision/core-types';
import {
  HTTPError,
  IoCSymbol,
  SchemaValid,
  ValidateSchema,
} from '@risevision/core-utils';
import * as filterObject from 'filter-object';
import { inject, injectable } from 'inversify';
import * as isEmpty from 'is-empty';
import { WordPressHookSystem } from 'mangiafuoco';
import 'reflect-metadata';
import {
  Body,
  Get,
  JsonController,
  Post,
  QueryParams,
} from 'routing-controllers';
import * as z_schema from 'z-schema';
import { FilterAPIGetAccount } from '../hooks';
import { AccountsSymbols } from '../symbols';

// tslint:disable-next-line
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
  @QueryParams()
  query: {
    address?: string;
  }) {
    if (isEmpty(query.address)) {
      throw new HTTPError(
        'Missing required property: address or publicKey',
        200
      );
    }

    const accData = await this.accountsModule.getAccount({
      address: query.address,
    });
    if (!accData) {
      throw new HTTPError('Account not found', 200);
    }

    /**
     * @codesample filterHookCall
     */
    const account = await this.hookSystem.apply_filters(
      FilterAPIGetAccount.name,
      {
        address: accData.address,
        balance: `${accData.balance}`,
        unconfirmedBalance: `${accData.u_balance}`,
      },
      accData
    );
    return {
      account: toTransportable(account),
    };
  }

  @Get('/getBalance')
  @ValidateSchema()
  public async getBalance(@SchemaValid(accountSchema.getBalance)
  @QueryParams()
  params: {
    address: string;
  }) {
    const account = await this.accountsModule.getAccount({
      address: params.address,
    });
    const balance = account ? `${account.balance}` : '0';
    const unconfirmedBalance = account ? `${account.u_balance}` : '0';
    return { balance, unconfirmedBalance };
  }

  @Get('/top')
  @ValidateSchema()
  public async topAccounts(@SchemaValid(accountSchema.top, {
    castNumbers: true,
  })
  @QueryParams()
  params: {
    limit?: number;
    offset?: number;
  }) {
    if (!this.appConfig.topAccounts) {
      throw new HTTPError('Top Accounts is not enabled', 403);
    }
    let { limit, offset } = params;
    limit = limit || 100;
    offset = offset || 0;
    const returnFields: FieldsInModel<IAccountsModel> = ['address', 'balance'];
    const accs = await this.accountsModule.getAccounts({
      limit,
      offset,
      sort: { balance: -1 as -1 },
    });

    return {
      accounts: accs
        .map((acc) => acc.toPOJO())
        .map((acc) => filterObject(acc, returnFields))
        .map((acc) => toTransportable(acc)),
    };
  }

  @Post('/open')
  @ValidateSchema()
  public async open(@SchemaValid(accountSchema.open)
  @Body()
  body: {
    secret: string;
  }): Promise<any> {
    throw new DeprecatedAPIError();
  }
}
