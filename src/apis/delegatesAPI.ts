import BigNumber from 'bignumber.js';
import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { IDatabase } from 'pg-promise';
import { Body, Get, JsonController, Post, Put, QueryParam, QueryParams, UseBefore } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { constants, Ed, OrderBy, Slots } from '../helpers/';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import {
  IAccountsModule,
  IBlocksModule,
  IBlocksModuleUtils,
  IDelegatesModule,
  IForgeModule,
  ISystemModule,
} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import schema from '../schema/delegates';
import sql from '../sql/delegates';
import { publicKey } from '../types/sanityTypes';
import { APIError, DeprecatedAPIError } from './errors';
import { ForgingApisWatchGuard } from './utils/forgingApisWatchGuard';

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
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
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

  @Get('/')
  @ValidateSchema()
  public async getDelegates(@SchemaValid(schema.getDelegates, { castNumbers: true })
                            @QueryParams() data: { orderBy: string, limit: number, offset: number }) {
    const d = await this.delegatesModule.getDelegates(data);
    if (d.sortField) {
      if (['approval', 'productivity', 'rank', 'vote'].indexOf(d.sortField) > -1) {
        d.delegates.sort((a, b) => {
          if (d.sortMethod === 'ASC') {
            return a[d.sortField] - b[d.sortField];
          } else {
            return b[d.sortField] - a[d.sortField];
          }
        });
      } else if (['username', 'address', 'publicKey'].indexOf(d.sortField) > -1) {
        d.delegates.sort((a, b) => {
          if (d.sortMethod === 'ASC') {
            return a[d.sortField].localeCompare(b[d.sortField]);
          } else {
            return b[d.sortField].localeCompare(a[d.sortField]);
          }
        });
      }
    }

    const delegates = d.delegates.slice(d.offset, d.limit);
    return { delegates, totalCount: d.count };
  }

  @Get('/fee')
  @ValidateSchema()
  public async getFee(@SchemaValid(schema.getFee, { castNumbers: true })
                      @QueryParams() params: { height?: number }) {
    const f            = this.system.getFees(params.height);
    const { delegate } = f.fees;
    delete f.fees;
    return { ...f, ... { fee: delegate } };

  }

  @Get('/forging/getForgedByAccount')
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
        .getAccount({ publicKey: params.generatorPublicKey }, ['fees', 'rewards']);

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
  @ValidateSchema()
  public async getDelegate(@SchemaValid(schema.getDelegate)
                           @QueryParams() params: { publicKey: publicKey, username: string }) {
    // FIXME: Delegates returned are automatically limited by maxDelegates. This means that a delegate cannot be found
    // if ranked (username) below the desired value.
    const { delegates } = await this.delegatesModule.getDelegates({ orderBy: 'username:asc' });
    const delegate      = delegates.find((d) => d.publicKey === params.publicKey || d.username === params.username);
    if (delegate) {
      return { delegate };
    }
    throw new APIError('Delegate not found', 200);
  }

  @Get('/voters')
  @ValidateSchema()
  public async getVoters(@SchemaValid(schema.getVoters)
                         @QueryParams() params: { publicKey: publicKey }) {
    const row       = await this.db.one(sql.getVoters, { publicKey: params.publicKey });
    const addresses = row.accountIds ? row.accountIds : [];

    const accounts = await this.accounts.getAccounts(
      { address: { $in: addresses }, sort: 'balance' },
      ['address', 'balance', 'username', 'publicKey']);

    return { accounts };
  }

  @Get('/search')
  @ValidateSchema()
  public async search(@SchemaValid(schema.search, { castNumbers: true })
                      @QueryParams() params: { q: string, limit?: number, orderBy: string }) {

    const orderBy = OrderBy(params.orderBy, {
      sortField : 'username',
      sortFields: sql.sortFields,
    });
    if (orderBy.error) {
      throw new Error(orderBy.error);
    }

    const delegates = await this.db.query(sql.search({
      limit     : params.limit || constants.activeDelegates,
      q         : params.q,
      sortField : orderBy.sortField,
      sortMethod: orderBy.sortMethod,
    }));
    return { delegates };
  }

  @Get('/count')
  public async count() {
    const { count } = await this.db.one(sql.count);
    return { count };
  }

  @Get('/getNextForgers')
  public async getNextForgers(@QueryParam('limit', { required: false }) limit: number = 10) {
    const curBlock = this.blocks.lastBlock;

    const activeDelegates = await this.delegatesModule.generateDelegateList(curBlock.height);

    const currentBlockSlot = this.slots.getSlotNumber(curBlock.timestamp);
    const currentSlot      = this.slots.getSlotNumber();
    const nextForgers      = [];
    for (let i = 1; i <= this.slots.delegates && i <= limit; i++) {
      // This if looks a bit stupid to me.
      if (activeDelegates[(currentSlot + i) % this.slots.delegates]) {
        nextForgers.push(activeDelegates[(currentSlot + i) % this.slots.delegates]);
      }
    }

    return {
      currentBlock: curBlock,
      currentBlockSlot,
      currentSlot,
      delegates   : nextForgers,
    };
  }

  @Put('/')
  public async createDelegate() {
    throw new DeprecatedAPIError();
  }

  // internal stuff.
  @Get('/forging/status')
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

    const account = await this.accounts.getAccount({ publicKey: pk });
    if (!account) {
      throw new APIError('Account not found', 200);
    }
    if (!account.isDelegate) {
      throw new APIError('Delegate not found', 200);
    }

    this.forgeModule.enableForge(kp);
  }

  @Post('/forging/disable')
  @ValidateSchema()
  public async forgingDisable(@SchemaValid(schema.disableForging)
                              @Body() params: { secret: string, publicKey: string }) {
    const kp = this.ed.makeKeypair(crypto
      .createHash('sha256').update(params.secret, 'utf8')
      .digest());

    const pk = kp.publicKey.toString('hex');
    if (params.publicKey && pk !== params.publicKey) {
      throw new APIError('Invalid passphrase', 200);
    }

    if (typeof(this.forgeModule.isForgeEnabledOn(pk)) === 'undefined') {
      throw new APIError('Forging is already disabled', 200);
    }

    const account = await this.accounts.getAccount({ publicKey: pk });
    if (!account) {
      throw new APIError('Account not found', 200);
    }
    if (!account.isDelegate) {
      throw new APIError('Delegate not found', 200);
    }

    this.forgeModule.disableForge(pk);
  }

}
