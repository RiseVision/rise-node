import BigNumber from 'bignumber.js';
import * as crypto from 'crypto';
import * as filterObject from 'filter-object';
import { inject, injectable } from 'inversify';
import { Body, Get, JsonController, Post, Put, QueryParam, QueryParams, UseBefore } from 'routing-controllers';
import * as sequelize from 'sequelize';
import * as z_schema from 'z-schema';
import { constants, Ed, Slots } from '../helpers/';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { DeprecatedEndpoint } from '../helpers/decorators/deprecatedEndpoint';
import { ResponseSchema, OpenAPI } from 'rc-openapi-gen';
import {
  IAccountsModule,
  IBlocksModule,
  IBlocksModuleUtils,
  IDelegatesModule,
  IForgeModule,
  ISystemModule,
} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { Accounts2DelegatesModel, AccountsModel, BlocksModel, TransactionsModel } from '../models';
import schema from '../schema/delegates';
import { publicKey } from '../types/sanityTypes';
import { APIError } from './errors';
import { ForgingApisWatchGuard } from './utils/forgingApisWatchGuard';
import { md } from '../helpers/strings';

@JsonController('/api/delegates')
@injectable()
@IoCSymbol(Symbols.api.delegates)
export class DelegatesAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.modules.accounts)
  private accounts: IAccountsModule;
  @inject(Symbols.modules.blocks)
  private blocks: IBlocksModule;
  @inject(Symbols.modules.blocksSubModules.utils)
  private blocksUtils: IBlocksModuleUtils;
  @inject(Symbols.modules.delegates)
  private delegatesModule: IDelegatesModule;
  @inject(Symbols.helpers.ed)
  private ed: Ed;
  @inject(Symbols.modules.forge)
  private forgeModule: IForgeModule;
  @inject(Symbols.helpers.slots)
  private slots: Slots;
  @inject(Symbols.modules.system)
  private system: ISystemModule;

  // models
  @inject(Symbols.models.accounts2Delegates)
  private Accounts2DelegatesModel: typeof Accounts2DelegatesModel;
  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;
  @inject(Symbols.models.blocks)
  private BlocksModel: typeof BlocksModel;
  @inject(Symbols.models.transactions)
  private TransactionsModel: typeof TransactionsModel;

  @Get('/')
  @OpenAPI({
    summary: 'Get Delegate List',
    description: md`
      Get list of delegates sorted by rank.
      Defaults to top 101 delegates (e.g. active delegates)
    `
  })
  @ResponseSchema('responses.delegates.getDelegates')
  @ValidateSchema()
  public async getDelegates(@SchemaValid(schema.getDelegates, { castNumbers: true })
                            @QueryParams() data: { orderBy: string, limit: number, offset: number, includeBanned: 'true'|'false' }) {
    const d         = await this.delegatesModule
      .getDelegates({... data, includeBanned: data.includeBanned === 'true'} );
    const delegates = d.delegates.map((item) => {
      // tslint:disable object-literal-sort-keys
      return {
        address       : item.delegate.address,
        cmb           : item.delegate.cmb,
        username      : item.delegate.username,
        publicKey     : item.delegate.hexPublicKey,
        vote          : item.delegate.vote ? `${item.delegate.vote}` : '0',
        producedblocks: item.delegate.producedblocks,
        missedblocks  : item.delegate.missedblocks,
        votesWeight   : item.delegate.votesWeight,
        rate          : item.info.rank,
        rank          : item.info.rank,
        approval      : item.info.approval,
        productivity  : item.info.productivity,
      };
      // tslint:enable object-literal-sort-keys
    });
    if (d.sortField) {
      if (['approval', 'productivity', 'rank', 'vote', 'votesWeight', 'cmb'].indexOf(d.sortField) > -1) {
        delegates.sort((a, b) => {
          if (d.sortMethod === 'ASC') {
            return a[d.sortField] - b[d.sortField];
          } else {
            return b[d.sortField] - a[d.sortField];
          }
        });
      } else if (['username', 'address', 'publicKey'].indexOf(d.sortField) > -1) {
        delegates.sort((a, b) => {
          if (d.sortMethod === 'ASC') {
            return a[d.sortField].localeCompare(b[d.sortField]);
          } else {
            return b[d.sortField].localeCompare(a[d.sortField]);
          }
        });
      }
    }
    return { delegates: delegates.slice(d.offset, d.limit), totalCount: d.count };
  }

  @Get('/fee')
  @OpenAPI({
    summary: 'Get Delegates Fee',
    description: md`
      Get the fee for registering as a delegate at a certain height of the blockchain
      (omit the height for the current fee).
    `
  })
  @ResponseSchema('responses.delegates.getFee')
  @ValidateSchema()
  public async getFee(@SchemaValid(schema.getFee, { castNumbers: true })
                      @QueryParams() params: { height?: number }) {
    const f            = this.system.getFees(params.height);
    const { delegate } = f.fees;
    delete f.fees;
    return { ...f, ... { fee: delegate } };

  }

  @Get('/forging/getForgedByAccount')
  @OpenAPI({
    summary: 'Get Forged by Account',
    description: "Get earnings from forging by account public key"
  })
  @ResponseSchema('responses.delegates.getForgedByAccount')
  @ValidateSchema()
  public async getForgedByAccount(@SchemaValid(schema.getForgedByAccount, { castNumbers: true })
                                  // tslint:disable-next-line max-line-length
                                  @QueryParams() params: { generatorPublicKey: publicKey, start?: number, end?: number }) {
    if (typeof(params.start) !== 'undefined' || typeof(params.end) !== 'undefined') {
      const reward = await this.blocksUtils.aggregateBlockReward({
        end               : params.end,
        generatorPublicKey: params.generatorPublicKey,
        start             : params.start,
      });
      const forged = new BigNumber(reward.fees).plus(reward.rewards).toString();
      return {
        count  : reward.count,
        fees   : reward.fees,
        forged,
        rewards: reward.rewards,
      };
    } else {
      const account = await this.accounts
        .getAccount({ publicKey: Buffer.from(params.generatorPublicKey, 'hex') }, ['fees', 'rewards']);

      if (!account) {
        throw new APIError('Account not found', 200);
      }

      return {
        fees   : account.fees,
        forged : new BigNumber(account.fees).plus(account.rewards).toString(),
        rewards: account.rewards,
      };
    }

  }

  @Get('/get')
  @OpenAPI({
    summary: 'Get Delegate',
    description: "Retrieve delegate account and associated stats by public key or username"
  })
  @ResponseSchema('responses.delegates.getDelegate')
  @ValidateSchema()
  public async getDelegate(@SchemaValid(schema.getDelegate)
                           @QueryParams() params: { publicKey: publicKey, username: string }) {
    // FIXME: Delegates returned are automatically limited by maxDelegates. This means that a delegate cannot be found
    // if ranked (username) below the desired value.
    const { delegates } = await this.delegatesModule.getDelegates({ orderBy: 'username:asc', includeBanned: true });
    const delegate      = delegates
      .find((d) => d.delegate.hexPublicKey === params.publicKey || d.delegate.username === params.username);
    if (delegate) {
      return {
        delegate: filterObject(
          { ...delegate.delegate.toPOJO(), ...delegate.info, ...{ rate: delegate.info.rank } },
          ['username', 'address', 'cmb', 'publicKey', 'vote', 'producedblocks', 'votesWeight',
            'missedblocks', 'rank', 'approval', 'productivity', 'rate']
        ),
      };
    }
    throw new APIError('Delegate not found', 200);
  }

  @Get('/voters')
  @OpenAPI({
    summary: 'Get Voters',
    description: "Retrieve a list of accounts which voted for a delegate"
  })
  @ResponseSchema('responses.delegates.getVoters')
  @ValidateSchema()
  public async getVoters(@SchemaValid(schema.getVoters)
                         @QueryParams() params: { publicKey: publicKey }) {
    const rows      = await this.Accounts2DelegatesModel.findAll({
      attributes: ['accountId'],
      where     : { dependentId: params.publicKey },
    });
    const addresses = rows.map((r) => r.accountId);

    const accounts = await this.accounts.getAccounts(
      { address: { $in: addresses }, sort: 'balance' },
      ['address', 'balance', 'username', 'publicKey']);

    return {
      accounts: accounts.map((a) => filterObject(
        a.toPOJO(),
        ['address', 'balance', 'username', 'publicKey'])
      ),
    };
  }

  @Get('/search')
  @OpenAPI({
    summary: 'Search Delegates',
    description: "Retrieve a list of delegates whose usernames are like the search query"
  })
  @ResponseSchema('responses.delegates.search')
  @ValidateSchema()
  public async search(@SchemaValid(schema.search, { castNumbers: true })
                      @QueryParams() params: { q: string, limit?: number, orderBy?: string }) {

    const orderBy = params.orderBy ? params.orderBy.split(':') : ['username', 'ASC'];
    if (orderBy.length === 1) {
      orderBy.push('ASC');
    }
    const delQuery  = this.AccountsModel.searchDelegate(
      params.q,
      params.limit || this.slots.delegates,
      orderBy[0],
      orderBy[1] as any
    );
    const delegates = await this.Accounts2DelegatesModel.sequelize.query(
      delQuery,
      { raw: true, type: sequelize.QueryTypes.SELECT }
    );
    return {
      delegates: delegates.map((d) => {
        d.rate = d.rank;
        return d;
      }),
    };
  }

  @Get('/count')
  @OpenAPI({
    summary: 'Get Delegate Count',
    description: "Retrieve the total number of registered delegates"
  })
  @ResponseSchema('responses.delegates.count')
  public async count() {
    return { count: await this.Accounts2DelegatesModel.count() };
  }

  @Get('/getNextForgers')
  @OpenAPI({
    summary: 'Get Next Forgers',
    description: md`
      Retrieve the current slot and block to be forged,
      as well as the list of the next delegates' public keys in the round (defaults to 10)
    `
  })
  @ResponseSchema('responses.delegates.getNextForgers')
  public async getNextForgers(@QueryParam('limit', { required: false }) limit: number = 10) {
    const curBlock = this.blocks.lastBlock;

    const activeDelegates = await this.delegatesModule.generateDelegateList(curBlock.height);

    const currentBlockSlot      = this.slots.getSlotNumber(curBlock.timestamp);
    const currentSlot           = this.slots.getSlotNumber();
    const nextForgers: string[] = [];
    for (let i = 1; i <= this.slots.delegates && i <= limit; i++) {
      // This if looks a bit stupid to me.
      if (activeDelegates[(currentSlot + i) % this.slots.delegates]) {
        nextForgers.push(activeDelegates[(currentSlot + i) % this.slots.delegates].toString('hex'));
      }
    }

    return {
      currentBlock: this.BlocksModel.toStringBlockType(curBlock, this.TransactionsModel, this.blocks),
      currentBlockSlot,
      currentSlot,
      delegates   : nextForgers,
    };
  }

  @Put('/')
  @OpenAPI({
    summary: 'Add Delegate',
    description: md`
      _**Deprecated**: Please use the [Transactions API](#tag/Transactions-API)_.
      Registers a delegate.
    `
  })
  @DeprecatedEndpoint()
  public async createDelegate() {}

  // internal stuff.
  @Get('/forging/status')
  @OpenAPI({
    summary: 'Get Forging Status',
    description: md`
      Checks to see if forging is enabled for the network or a public key if provided.
      _Forging APIs must be enabled on the providing node_
    `
  })
  @ResponseSchema('responses.delegates.getForgingStatus')
  @ResponseSchema('responses.delegates.accessDenied', {
    statusCode: 403,
    description: 'Delegates API Access Denied'
  })
  @ValidateSchema()
  @UseBefore(ForgingApisWatchGuard)
  public async getForgingStatus(@SchemaValid(schema.forgingStatus)
                                @QueryParams() params: { publicKey: publicKey }) {
    if (params.publicKey) {
      return {
        delegates: [params.publicKey],
        enabled  : this.forgeModule.isForgeEnabledOn(params.publicKey),
      };
    } else {
      const delegates = this.forgeModule.getEnabledKeys();
      return {
        delegates,
        enabled: delegates.length > 0,
      };
    }

  }

  @Post('/forging/enable')
  @OpenAPI({
    summary: 'Enable Forging',
    description: md`
      Enable forging for a secret / public key pair.
      _Forging APIs must be enabled on the providing node_
    `
  })
  @ResponseSchema('responses.delegates.forgingEnable')
  @ResponseSchema('responses.delegates.accessDenied', {
    statusCode: 403,
    description: 'Delegates API Access Denied'
  })
  @ValidateSchema()
  @UseBefore(ForgingApisWatchGuard)
  public async forgingEnable(@SchemaValid(schema.disableForging)
                             @Body() params: { secret: string, publicKey: string }) {
    const kp = this.ed.makeKeypair(crypto
      .createHash('sha256').update(params.secret, 'utf8')
      .digest());

    const pk = kp.publicKey.toString('hex');
    if (params.publicKey && pk !== params.publicKey) {
      throw new APIError('Invalid passphrase', 200);
    }

    if (this.forgeModule.isForgeEnabledOn(pk)) {
      throw new APIError('Forging is already enabled', 200);
    }

    const account = await this.accounts.getAccount({ publicKey: kp.publicKey });
    if (!account) {
      throw new APIError('Account not found', 200);
    }
    if (!account.isDelegate) {
      throw new APIError('Delegate not found', 200);
    }

    this.forgeModule.enableForge(kp);
  }

  @Post('/forging/disable')
  @OpenAPI({
    summary: 'Disable Forging',
    description: md`
      Disable forging for a secret / public key pair.
      _Forging APIs must be enabled on the providing node_
    `
  })
  @ResponseSchema('responses.delegates.forgingDisable')
  @ResponseSchema('responses.delegates.accessDenied', {
    statusCode: 403,
    description: 'Delegates API Access Denied'
  })
  @ValidateSchema()
  @UseBefore(ForgingApisWatchGuard)
  public async forgingDisable(@SchemaValid(schema.disableForging)
                              @Body() params: { secret: string, publicKey: string }) {
    const kp = this.ed.makeKeypair(crypto
      .createHash('sha256').update(params.secret, 'utf8')
      .digest());

    const pk = kp.publicKey.toString('hex');
    if (params.publicKey && pk !== params.publicKey) {
      throw new APIError('Invalid passphrase', 200);
    }

    if (!this.forgeModule.isForgeEnabledOn(pk)) {
      throw new APIError('Forging is already disabled', 200);
    }

    const account = await this.accounts.getAccount({ publicKey: kp.publicKey });
    if (!account) {
      throw new APIError('Account not found', 200);
    }
    if (!account.isDelegate) {
      throw new APIError('Delegate not found', 200);
    }

    this.forgeModule.disableForge(pk);
  }

}
