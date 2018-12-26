import { inject, injectable, tagged } from 'inversify';
import { Get, JsonController, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { constants as constantsType, removeEmptyObjKeys, Sequence } from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { WrapInDBSequence } from '../helpers/decorators/wrapInSequence';
import { IBlockLogic, IBlockReward, ITransactionLogic } from '../ioc/interfaces/logic';
import { IBlocksModule, ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { BlocksModel, TransactionsModel } from '../models';
import blocksSchema from '../schema/blocks';
import { APIError } from './errors';

@JsonController('/api/blocks')
@IoCSymbol(Symbols.api.blocks)
@injectable()
export class BlocksAPI {

  // Generic
  @inject(Symbols.generic.zschema)
  public schema: z_schema;

  // Helpers
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  // tslint:disable-next-line
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.dbSequence)
  public dbSequence: Sequence;

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

  @inject(Symbols.models.blocks)
  private BlocksModel: typeof BlocksModel;
  @inject(Symbols.models.transactions)
  private TransactionsModel: typeof TransactionsModel;

  @Get('/')
  @ValidateSchema()
  @WrapInDBSequence
  public async getBlocks(@SchemaValid(blocksSchema.getBlocks, { castNumbers: true })
                         @QueryParams() filters) {
    const whereClause: any = {
      generatorPublicKey: filters.generatorPublicKey ? Buffer.from(filters.generatorPublicKey, 'hex') : undefined,
      height            : filters.height,
      previousBlock     : filters.previousBlock,
      reward            : filters.reward,
      totalAmount       : filters.totalAmount,
      totalFee          : filters.totalFee,
    };

    removeEmptyObjKeys(whereClause);
    const orderBy = [filters.orderBy ? filters.orderBy.split(':') : ['height', 'desc']];

    const { rows: blocks, count } = await this.BlocksModel.findAndCountAll({
      limit  : filters.limit || 100,
      offset : filters.offset || 0,
      order  : orderBy,
      where  : whereClause,
    });
    // attach transactions and assets with it.
    await Promise.all(blocks
      .map((b) => this.TransactionsModel.findAll({ where: { blockId: b.id }, order: [['rowId', 'asc']] })
        .then((txs) => {
          b.transactions = txs;
          return this.transactionLogic.attachAssets(b.transactions);
        })
        .then(() => b)
      )
    );
    // console.log(blocks);
    return {
      blocks: blocks.map((b) => this.BlocksModel.toStringBlockType(
        b,
        this.TransactionsModel,
        this.blocksModule
        )
      ),
      count,
    };
  }

  @Get('/get')
  @ValidateSchema()
  public async getBlock(@SchemaValid(blocksSchema.getBlock, { castNumbers: true })
                        @QueryParams() filters: { id: string }) {
    const block = await this.dbSequence.addAndPromise(async () => {
      const b = await this.BlocksModel.findById(filters.id, { include: [this.TransactionsModel] });
      if (b === null) {
        throw new APIError('Block not found', 200);
      }
      await this.transactionLogic.attachAssets(b.transactions);
      return this.BlocksModel.toStringBlockType(b, this.TransactionsModel, this.blocksModule);
    });
    if (typeof (block as any).TransactionsModel !== 'undefined') {
      delete (block as any).TransactionsModel;
    }
    return { block };
  }

  @Get('/getHeight')
  @ValidateSchema()
  public async getHeight() {
    return { height: this.blocksModule.lastBlock.height };
  }

  @Get('/getBroadhash')
  public async getBroadHash() {
    return { broadhash: await this.systemModule.getBroadhash() };
  }

  @Get('/getEpoch')
  public getEpoch() {
    return { epoch: this.constants.epochTime };
  }

  @Get('/getFee')
  @ValidateSchema()
  public async getFee(@SchemaValid(blocksSchema.getFee, { castNumbers: true })
                      @QueryParams() params: { height: number }) {
    const fees = this.systemModule.getFees(params.height);
    return { fee: fees.fees.send, fromHeight: fees.fromHeight, toHeight: fees.toHeight, height: fees.height };
  }

  @Get('/getFees')
  @ValidateSchema()
  public async getFees(@SchemaValid(blocksSchema.getFees, { castNumbers: true })
                       @QueryParams() params: { height: number }) {
    return this.systemModule.getFees(params.height);
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
  public async getStatus() {
    const lastBlock = this.blocksModule.lastBlock;
    return {
      broadhash: await this.systemModule.getBroadhash(),
      epoch    : this.constants.epochTime,
      fee      : this.systemModule.getFees(lastBlock.height).fees.send,
      height   : lastBlock.height,
      milestone: this.blockRewardLogic.calcMilestone(lastBlock.height),
      nethash  : this.systemModule.getNethash(),
      reward   : this.blockRewardLogic.calcReward(lastBlock.height),
      supply   : this.blockRewardLogic.calcSupply(lastBlock.height),
    };
  }
}
