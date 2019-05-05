import { DeprecatedAPIError, HTTPError } from '@risevision/core-apis';
import { Sequence } from '@risevision/core-helpers';
import { LaunchpadSymbols } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import {
  ConstantsType,
  IBlockLogic,
  IBlockReward,
  IBlocksModel,
  IBlocksModule,
  ISystemModule,
  ITimeToEpoch,
  ITransactionLogic,
  ITransactionsModel,
  Symbols,
} from '@risevision/core-types';
import {
  IoCSymbol,
  removeEmptyObjKeys,
  SchemaValid,
  ValidateSchema,
  WrapInDBSequence,
} from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import { Get, JsonController, QueryParams } from 'routing-controllers';
import { Op } from 'sequelize';
import { As } from 'type-tagger';
import * as z_schema from 'z-schema';
import { BlocksSymbols } from '../blocksSymbols';

// tslint:disable-next-line
const blocksSchema = require('../../schema/blocks.json');

@JsonController('/api/blocks')
@IoCSymbol(BlocksSymbols.api.api)
@injectable()
export class BlocksAPI {
  // Generic
  @inject(LaunchpadSymbols.zschema)
  public schema: z_schema;
  // tslint:disable-next-line
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.dbSequence)
  public dbSequence: Sequence;

  // Helpers
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(Symbols.helpers.timeToEpoch)
  private epochConverter: ITimeToEpoch;

  // Logic
  @inject(Symbols.logic.blockReward)
  private blockRewardLogic: IBlockReward;
  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  // Modules
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(ModelSymbols.model)
  @named(ModelSymbols.names.blocks)
  private BlocksModel: typeof IBlocksModel;
  @inject(ModelSymbols.model)
  @named(ModelSymbols.names.transactions)
  private TransactionsModel: typeof ITransactionsModel;

  @Get('/')
  @ValidateSchema()
  @WrapInDBSequence
  public async getBlocks(
    @SchemaValid(blocksSchema.getBlocks, { castNumbers: true })
    @QueryParams()
    filters
  ) {
    const whereClause: any = {
      generatorPublicKey: filters.generatorPublicKey
        ? Buffer.from(filters.generatorPublicKey, 'hex')
        : undefined,
      height: filters.height,
      previousBlock: filters.previousBlock,
      reward: filters.reward,
      totalAmount: filters.totalAmount,
      totalFee: filters.totalFee,
    };

    removeEmptyObjKeys(whereClause);
    const orderBy = [
      filters.orderBy ? filters.orderBy.split(':') : ['height', 'desc'],
    ];

    const { rows: blocks, count } = await this.BlocksModel.findAndCountAll({
      limit: filters.limit || 100,
      offset: filters.offset || 0,
      order: orderBy,
      raw: true,
      where: whereClause,
    });
    // attach transactions and assets with it.
    await Promise.all(
      blocks.map((b) =>
        this.TransactionsModel.findAll({
          order: [['rowId', 'asc']],
          raw: true,
          where: { blockId: b.id },
        })
          .then((txs) => {
            b.transactions = txs;
            return this.transactionLogic.attachAssets(b.transactions);
          })
          .then(() => b)
      )
    );
    // console.log(blocks);
    return {
      blocks: blocks.map((b) => this.BlocksModel.toStringBlockType(b)),
      count,
    };
  }

  @Get('/rewards')
  @ValidateSchema()
  public async getRewards(@SchemaValid(blocksSchema.getRewards, {
    castNumbers: true,
  })
  @QueryParams()
  filter: {
    generator: string & As<'publicKey'>;
    from: number;
    to: number;
  }) {
    const from = this.epochConverter.getTime(filter.from * 1000);
    const to = this.epochConverter.getTime(filter.to * 1000);

    if (from > to || from < 0) {
      throw new HTTPError('From/To params are invalid', 500);
    }
    // tslint:disable-next-line
    const res = await this.BlocksModel.findAndCountAll({
      attributes: ['totalFee', 'reward'],
      raw: true,
      where: {
        generatorPublicKey: Buffer.from(filter.generator, 'hex') as any,
        timestamp: {
          [Op.gte]: from,
          [Op.lt]: to,
        },
      },
    });

    return {
      fees: res.rows
        .map((a) => BigInt(a.totalFee))
        .reduceRight((a, b) => a + b, 0n),
      rewards: res.rows
        .map((a) => BigInt(a.reward))
        .reduceRight((a, b) => a + b, 0n),
      totalBlocks: res.count,
    };
  }

  @Get('/get')
  @ValidateSchema()
  public async getBlock(@SchemaValid(blocksSchema.getBlock, {
    castNumbers: true,
  })
  @QueryParams()
  filters: {
    id: string;
  }) {
    const block = await this.BlocksModel.findByPk(filters.id, {
      include: [this.TransactionsModel],
    });
    if (block === null) {
      throw new HTTPError('Block not found', 200);
    }
    await this.transactionLogic.attachAssets(block.transactions);
    return { block: this.BlocksModel.toStringBlockType(block) };
  }

  @Get('/getHeight')
  @ValidateSchema()
  public async getHeight() {
    return { height: this.blocksModule.lastBlock.height };
  }

  @Get('/getBroadhash')
  public getBroadHash() {
    const lastBlock = this.blocksModule.lastBlock;
    return { broadhash: lastBlock.id };
  }

  @Get('/getEpoch')
  public getEpoch() {
    return { epoch: this.constants.epochTime };
  }

  @Get('/getFee')
  @ValidateSchema()
  public async getFee(@SchemaValid(blocksSchema.getFee, { castNumbers: true })
  @QueryParams()
  params: {
    height: number;
  }) {
    const fees = this.systemModule.getFees(params.height);
    return {
      // tslint:disable object-literal-sort-keys
      fee: fees.fees.send,
      fromHeight: fees.fromHeight,
      toHeight: fees.toHeight,
      height: fees.height,
      // tslint:enable object-literal-sort-keys
    };
  }

  @Get('/getFees')
  @ValidateSchema()
  public async getFees(@SchemaValid(blocksSchema.getFees, { castNumbers: true })
  @QueryParams()
  params: {
    height: number;
  }) {
    return this.systemModule.getFees(params.height);
  }

  @Get('/getNethash')
  public getNethash() {
    return { nethash: this.systemModule.getNethash() };
  }

  @Get('/getMilestone')
  public getMilestone() {
    return {
      milestone: this.blockRewardLogic.calcMilestone(
        this.blocksModule.lastBlock.height
      ),
    };
  }

  @Get('/getReward')
  public getReward() {
    return {
      reward: this.blockRewardLogic.calcReward(
        this.blocksModule.lastBlock.height
      ),
    };
  }

  @Get('/getSupply')
  public getSupply() {
    return {
      supply: this.blockRewardLogic.calcSupply(
        this.blocksModule.lastBlock.height
      ),
    };
  }

  @Get('/getStatus')
  public getStatus() {
    const lastBlock = this.blocksModule.lastBlock;
    return {
      broadhash: lastBlock.id,
      epoch: this.constants.epochTime,
      fee: this.systemModule.getFees(lastBlock.height).fees.send.toString(),
      height: lastBlock.height,
      milestone: this.blockRewardLogic.calcMilestone(lastBlock.height),
      nethash: this.systemModule.getNethash(),
      reward: this.blockRewardLogic.calcReward(lastBlock.height).toString(),
      supply: this.blockRewardLogic.calcSupply(lastBlock.height).toString(),
    };
  }
}
