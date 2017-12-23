import BigNumber from 'bignumber.js';
import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { IDatabase } from 'pg-promise';
import { Get, JsonController, Put, QueryParam, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { constants, Ed, OrderBy, Slots } from '../helpers/';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import {
  IAccountsModule, IBlocksModule, IBlocksModuleUtils, IDelegatesModule, IForgeModule, ISystemModule,
} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import schema from '../schema/delegates';
import sql from '../sql/delegates';
import { publicKey } from '../types/sanityTypes';

@JsonController('/api/delegates')
@injectable()
@IoCSymbol(Symbols.api.delegates)
export class DelegatesAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
  @inject(Symbols.helpers.ed)
  private ed: Ed;
  @inject(Symbols.helpers.slots)
  private slots: Slots;

  @inject(Symbols.modules.delegates)
  private delegatesModule: IDelegatesModule;
  @inject(Symbols.modules.system)
  private system: ISystemModule;
  @inject(Symbols.modules.blocks)
  private blocks: IBlocksModule;
  @inject(Symbols.modules.blocksSubModules.utils)
  private blocksUtils: IBlocksModuleUtils;
  @inject(Symbols.modules.accounts)
  private accounts: IAccountsModule;
  @inject(Symbols.modules.forge)
  private forgeModule: IForgeModule;

  @Get('/')
  @ValidateSchema()
  public async getDelegates(@SchemaValid(schema.getDelegates, {castNumbers: true})
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
  public async getFee(@SchemaValid(schema.getFee.properties.height)
                      @QueryParam('height', { required: true }) height: number) {
    const f            = this.system.getFees(height);
    const { delegate } = f.fees;
    delete f.fees;
    return { ...f, ... { fee: delegate } };

  }

  @Get('/forging/getForgedByAccount')
  @ValidateSchema()
  public async getForgedByAccount(@SchemaValid(schema.getForgedByAccount, {castNumbers: true})
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
        throw new Error('Account not found');
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
    const { delegates } = await this.delegatesModule.getDelegates({ orderBy: 'username:asc' });
    const delegate      = delegates.find((d) => d.publicKey === params.publicKey || d.username === params.username);
    if (delegate) {
      return { delegate };
    }
    throw new Error('Delegate not found');
  }

  @Get('/voters')
  @ValidateSchema()
  public async getVoters(@SchemaValid(schema.getVoters.properties.publicKey)
                         @QueryParam('publicKey') pk: string) {
    const row       = await this.db.one(sql.getVoters, { publicKey: pk });
    const addresses = row.accountIds ? row.accountIds : [];

    const accounts = await this.accounts.getAccounts(
      { address: { $in: addresses }, sort: 'balance' },
      ['address', 'balance', 'username', 'publicKey']);

    return { accounts };
  }

  @Get('/search')
  @ValidateSchema()
  public async search(@SchemaValid(schema.search, {castNumbers: true})
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
  public createDelegate() {
    return Promise.reject('Method deprecated');
  }

  // internal stuff.
  @Get('/forging/status')
  @ValidateSchema()
  public getForgingStatus(@SchemaValid(schema.forgingStatus.properties.publicKey)
                          @QueryParam('publicKey') pk: publicKey) {
    // TODO: Add middleware
    /*
    		if (!checkIpInList(library.config.forging.access.whiteList, req.ip)) {
			return setImmediate(cb, 'Access denied');
		}
     */
    if (pk) {
      return {
        delegates: [pk],
        enabled  : this.forgeModule.isForgeEnabledOn(pk),
      };
    } else {
      const delegates = this.forgeModule.getEnabledKeys();
      return {
        delegates,
        enabled: delegates.length > 0,
      };
    }

  }

  @Get('/forging/enable')
  @ValidateSchema()
  public async forgingEnable(@SchemaValid(schema.disableForging)
                             @QueryParams() params: { secret: string, publicKey: string }) {
    const kp = this.ed.makeKeypair(crypto
      .createHash('sha256').update(params.secret, 'utf8')
      .digest());

    const pk = kp.publicKey.toString('hex');
    if (params.publicKey && pk !== params.publicKey) {
      throw new Error('Invalid passphrase');
    }

    if (this.forgeModule.isForgeEnabledOn(pk)) {
      throw new Error('Forging is already enabled');
    }

    const account = await this.accounts.getAccount({ publicKey: pk });
    if (!account) {
      throw new Error('Account not found');
    }
    if (!account.isDelegate) {
      throw new Error('Delegate not found');
    }

    this.forgeModule.enableForge(kp);
  }

  @Get('/forging/disable')
  @ValidateSchema()
  public async forgingDisable(@SchemaValid(schema.disableForging)
                              @QueryParams() params: { secret: string, publicKey: string }) {
    const kp = this.ed.makeKeypair(crypto
      .createHash('sha256').update(params.secret, 'utf8')
      .digest());

    const pk = kp.publicKey.toString('hex');
    if (params.publicKey && pk !== params.publicKey) {
      throw new Error('Invalid passphrase');
    }

    if (typeof(this.forgeModule.isForgeEnabledOn(pk)) === 'undefined') {
      throw new Error('Forging is already disabled');
    }

    const account = await this.accounts.getAccount({ publicKey: pk });
    if (!account) {
      throw new Error('Account not found');
    }
    if (!account.isDelegate) {
      throw new Error('Delegate not found');
    }

    this.forgeModule.disableForge(pk);
  }

}
