import {Get, JsonController, Put, QueryParam, QueryParams} from 'routing-controllers';
import {SchemaValid, ValidateSchema} from './baseAPIClass';
import {IDatabase} from 'pg-promise';
import {ILogger} from '../../logger';
import {TransactionsModule} from '../transactions';
import {TransactionLogic} from '../../logic/transaction';
import schema from '../../schema/delegates';
import {DelegatesModule} from '../delegates';
import {SystemModule} from '../system';
import {publicKey} from '../../types/sanityTypes';
import {BlocksModule} from '../blocks';
import BigNumber from 'bignumber.js';
import {AccountsModule} from '../accounts';
import sql from '../../sql/delegates';
import constants from '../../helpers/constants';
import slots from '../../helpers/slots';
import OrderBy from '../../helpers/orderBy';

@JsonController('/delegates')
export class DelegatesAPI {
  public schema: any;
  private db: IDatabase<any>;
  private logger: ILogger;
  private txLogic: TransactionLogic;
  private modules: {
    delegatesModule: DelegatesModule
    transactions: TransactionsModule
    system: SystemModule
    blocks: BlocksModule
    accounts: AccountsModule
  };

  @Get('/')
  @ValidateSchema()
  public async getDelegates(@SchemaValid(schema.getDelegates)
                            @QueryParams() data: { orderBy: string, limit: number, offset: number }) {
    const d = await this.modules.delegatesModule.getDelegates(data);
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
    const f            = this.modules.system.getFees(height);
    const { delegate } = f.fees;
    delete f.fees;
    return { ...f, ... { fee: delegate } };

  }

  @Get('/forging/getForgedByAccount')
  @ValidateSchema()
  public async getForgedByAccount(@SchemaValid(schema.getForgedByAccount)
                                  @QueryParams() params: { generatorPublicKey: publicKey, start?: number, end?: number }) {
    if (typeof(params.start) !== 'undefined' || typeof(params.end) !== 'undefined') {
      const reward = await this.modules.blocks.utils.aggregateBlockReward({
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
      const account = await this.modules.accounts
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

  @Get('/voters')
  @ValidateSchema()
  public async getVoters(@SchemaValid(schema.getVoters.properties.publicKey)
                         @QueryParam('publicKey') publicKey: string) {
    const row       = await this.db.one(sql.getVoters, { publicKey });
    const addresses = row.accountIds ? row.accountIds : [];

    const accounts = await this.modules.accounts.getAccounts(
      { address: { $in: addresses }, sort: 'balance' },
      ['address', 'balance', 'username', 'publicKey']);

    return { accounts };
  }

  @Get('/search')
  @ValidateSchema()
  public async search(@SchemaValid(schema.search)
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
    const curBlock = this.modules.blocks.lastBlock;

    const activeDelegates = await this.modules.delegatesModule.generateDelegateList(curBlock.height);

    const currentBlockSlot = slots.getSlotNumber(curBlock.timestamp);
    const currentSlot      = slots.getSlotNumber();
    const nextForgers      = [];
    for (let i = 1; i <= slots.delegates && i <= limit; i++) {
      // This if looks a bit stupid to me.
      if (activeDelegates[(currentSlot + i) % slots.delegates]) {
        nextForgers.push(activeDelegates[(currentSlot + i) % slots.delegates]);
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
}