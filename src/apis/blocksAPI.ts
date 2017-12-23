import { inject, injectable, tagged } from 'inversify';
import { IDatabase } from 'pg-promise';
import { Get, JsonController, QueryParam, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { constants as constantsType, OrderBy, Sequence } from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { IBlockLogic, IBlockReward } from '../ioc/interfaces/logic';
import { IBlocksModule, ISystemModule} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { SignedBlockType } from '../logic';
import blocksSchema from '../schema/blocks';
import sql from '../sql/blocks';
import { publicKey } from '../types/sanityTypes';

// tslint:disable-next-line
type FilterType = {
  generatorPublicKey?: publicKey,
  numberOfTransactions?: number
  previousBlock?: string
  height?: number
  // Total Amount of block's transactions
  totalAmount?: number
  totalFee?: number
  reward?: number
  limit?: number
  offset?: number
  orderBy?: string
};

@JsonController('/api/blocks')
@IoCSymbol(Symbols.api.blocks)
@injectable()
export class BlocksAPI {
  // Modules
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  // Generic
  // tslint:disable-next-line
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;

  // Logic
  @inject(Symbols.logic.blockReward)
  private blockRewardLogic: IBlockReward;
  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;

  // Helpers
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.dbSequence)
  private dbSequence: Sequence;

  @Get('/')
  @ValidateSchema()
  public async getBlocks(@SchemaValid(blocksSchema.getBlocks, {castNumbers: true})
                         @QueryParams() filters) {
    return this.dbSequence.addAndPromise(() => this.list(filters));
  }

  @Get('/get')
  @ValidateSchema()
  public async getBlock(@SchemaValid(blocksSchema.getBlock, {castNumbers: true})
                        @QueryParams() filters) {
    return this.dbSequence.addAndPromise((() => this.list(filters)));
  }

  @Get('/getBroadhash')
  public async getBroadHash() {
    return this.systemModule.getBroadhash();
  }

  @Get('/getEpoch')
  public getEpoch() {
    return { epoch: this.constants.epochTime };
  }

  @Get('/getFee')
  @ValidateSchema()
  public getFee(@SchemaValid(blocksSchema.getFee.properties.height)
                @QueryParam('height', { required: true }) height: number) {
    const fees = this.systemModule.getFees(height);
    return { fee: fees.fees.send, fromHeight: fees.fromHeight, toHeight: fees.toHeight, height };
  }

  @Get('/getFees')
  @ValidateSchema()
  public getFees(@SchemaValid(blocksSchema.getFees.properties.height)
                 @QueryParam('height', { required: true }) height: number) {
    return this.systemModule.getFees(height);
  }

  @Get('/getNethash')
  public getNethash() {
    return { nethash: this.systemModule.getNethash() };
  }

  @Get('/getMilestone')
  public getMilestone() {
    return { milestone: this.blockRewardLogic.calcMilestone(this.blocksModule.lastBlock.height) };
  }

  @Get('/getReward')
  public getReward() {
    return { reward: this.blockRewardLogic.calcReward(this.blocksModule.lastBlock.height) };
  }

  @Get('/getSupply')
  public getSupply() {
    return { supply: this.blockRewardLogic.calcSupply(this.blocksModule.lastBlock.height) };
  }

  @Get('/getStatus')
  public getStatus() {
    const lastBlock = this.blocksModule.lastBlock;
    return {
      broadhash: this.systemModule.broadhash,
      epoch    : this.constants.epochTime,
      fee      : this.systemModule.getFees(lastBlock.height).fees.send,
      height   : lastBlock.height,
      milestone: this.blockRewardLogic.calcMilestone(lastBlock.height),
      nethash  : this.systemModule.getNethash(),
      reward   : this.blockRewardLogic.calcReward(lastBlock.height),
      supply   : this.blockRewardLogic.calcSupply(lastBlock.height),
    };
  }

  private async list(filter: FilterType): Promise<{ count: number, blocks: SignedBlockType[] }> {
    const params: any = {};
    const where       = [];
    if (filter.generatorPublicKey) {
      where.push('"b_generatorPublicKey"::bytea = ${generatorPublicKey}');
      params.generatorPublicKey = filter.generatorPublicKey;
    }
    // FIXME: Useless condition
    if (filter.numberOfTransactions) {
      where.push('"b_numberOfTransactions" = ${numberOfTransactions}');
      params.numberOfTransactions = filter.numberOfTransactions;
    }

    if (filter.previousBlock) {
      where.push('"b_previousBlock" = ${previousBlock}');
      params.previousBlock = filter.previousBlock;
    }

    if (filter.height === 0 || filter.height > 0) {
      where.push('"b_height" = ${height}');
      params.height = filter.height;
    }

    // FIXME: Useless condition
    if (filter.totalAmount >= 0) {
      where.push('"b_totalAmount" = ${totalAmount}');
      params.totalAmount = filter.totalAmount;
    }

    // FIXME: Useless condition
    if (filter.totalFee >= 0) {
      where.push('"b_totalFee" = ${totalFee}');
      params.totalFee = filter.totalFee;
    }

    // FIXME: Useless condition
    if (filter.reward >= 0) {
      where.push('"b_reward" = ${reward}');
      params.reward = filter.reward;
    }

    if (!filter.limit) {
      params.limit = 100;
    } else {
      params.limit = Math.abs(filter.limit);
    }

    if (!filter.offset) {
      params.offset = 0;
    } else {
      params.offset = Math.abs(filter.offset);
    }

    if (params.limit > 100) {
      throw new Error('Invalid limit. Maximum is 100');
    }
    const orderBy = OrderBy(
      (filter.orderBy || 'height:desc'), {
        fieldPrefix: 'b_',
        sortFields : sql.sortFields,
      }
    );

    if (orderBy.error) {
      throw new Error(orderBy.error);
    }

    const rows = await this.db.query(sql.countList({ where }), params);

    const count = rows[0].count;

    const blockRows = await this.db.query(sql.list({
      sortField : orderBy.sortField,
      sortMethod: orderBy.sortMethod,
      where,
    }), params);

    const blocks = blockRows.map((b) => this.blockLogic.dbRead(b));

    return {
      blocks,
      count,
    };
  }
}
