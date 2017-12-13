import { IDatabase } from 'pg-promise';
import { Get, JsonController, QueryParam, QueryParams } from 'routing-controllers';
import { PeersModule, TransportModule } from '../';
import { constants, OrderBy, Sequence } from '../../helpers/';
import { BlockLogic, BlockRewardLogic, SignedBlockType } from '../../logic/';
import blocksSchema from '../../schema/blocks';
import sql from '../../../sql/blocks';
import { publicKey } from '../../types/sanityTypes';
import { SystemModule } from '../system';
import { SchemaValid, ValidateSchema } from './baseAPIClass';

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

@JsonController('/blocks')
export class BlocksAPI {
  public schema: any;

  constructor(private transportModule: TransportModule, private blocksModule: any,
              private systemModule: SystemModule,
              private peersModule: PeersModule,
              private dbSequence: Sequence,
              private blockReward: BlockRewardLogic,
              private transactionsModule: any,
              private blockLogic: BlockLogic,
              private db: IDatabase<any>) {
    this.schema = transportModule.schema;
  }

  @Get('/')
  @ValidateSchema()
  public async getBlocks(@SchemaValid(blocksSchema.getBlocks)
                         @QueryParams() filters) {
    return this.dbSequence.addAndPromise(() => this.list(filters));
  }

  @Get('/get')
  @ValidateSchema()
  public async getBlock(@SchemaValid(blocksSchema.getBlock)
                        @QueryParams() filters) {
    return this.dbSequence.addAndPromise((() => this.list(filters)));
  }

  @Get('/getBroadhash')
  public async getBroadHash() {
    return this.systemModule.getBroadhash();
  }

  @Get('/getEpoch')
  public getEpoch() {
    return { epoch: constants.epochTime };
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
    return { milestone: this.blockReward.calcMilestone(this.blocksModule.lastBlock.get().height) };
  }

  @Get('/getReward')
  public getReward() {
    return { reward: this.blockReward.calcReward(this.blocksModule.lastBlock.get().height) };
  }

  @Get('/getSupply')
  public getSupply() {
    return { supply: this.blockReward.calcSupply(this.blocksModule.lastBlock.get().height) };
  }

  @Get('/getStatus')
  public getStatus() {
    const lastBlock = this.blocksModule.lastBlock.get();
    return {
      broadhash: this.systemModule.broadhash,
      epoch    : constants.epochTime,
      fee      : this.systemModule.getFees(lastBlock.height).fees.send,
      height   : lastBlock.height,
      milestone: this.blockReward.calcMilestone(lastBlock.height),
      nethash  : this.systemModule.getNethash(),
      reward   : this.blockReward.calcReward(lastBlock.height),
      supply   : this.blockReward.calcSupply(lastBlock.height),
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
