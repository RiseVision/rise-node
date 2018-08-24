import { inject, injectable, tagged } from 'inversify';
import * as sequelize from 'sequelize';
import { Op } from 'sequelize';
import {
  BlockProgressLogger,
  catchToLoggerAndRemapError,
  constants as constantType,
  ILogger,
  Sequence
} from '../../helpers/';
import { IBlockLogic, IRoundsLogic, ITransactionLogic } from '../../ioc/interfaces/logic';
import { IBlocksModule, IBlocksModuleUtils } from '../../ioc/interfaces/modules/';
import { Symbols } from '../../ioc/symbols';
import { SignedAndChainedBlockType } from '../../logic/';
import { AccountsModel, BlocksModel, RoundsFeesModel, TransactionsModel } from '../../models';
import { RawFullBlockListType } from '../../types/rawDBTypes';
import { publicKey } from '../../types/sanityTypes';

@injectable()
export class BlocksModuleUtils implements IBlocksModuleUtils {

  // Generic
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;

  // Helpers
  @inject(Symbols.helpers.constants)
  private constants: typeof constantType;
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.dbSequence)
  private dbSequence: Sequence;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  // Logic
  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
  @inject(Symbols.logic.rounds)
  private rounds: IRoundsLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  // models
  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;
  @inject(Symbols.models.blocks)
  private BlocksModel: typeof BlocksModel;
  @inject(Symbols.models.transactions)
  private TransactionsModel: typeof TransactionsModel;
  @inject(Symbols.models.roundsFees)
  private RoundsFeesModel: typeof RoundsFeesModel;

  // Modules
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  public readDbRows(rows: RawFullBlockListType[]): SignedAndChainedBlockType[] {
    const blocks = {};
    const order  = [];
    // a block is defined in multiple_rows
    // due to the view full_block_list which performs a left outer join
    // over transactions list.
    for (let i = 0, length = rows.length; i < length; i++) {
      // Normalize block
      const block = this.blockLogic.dbRead(rows[i]);

      if (block) {
        // If block is not already in the list...
        if (!blocks[block.id]) {
          if (block.id === this.genesisBlock.id) {
            // Generate fake signature for genesis block
            // tslint:disable-next-line
            block['generationSignature'] = (new Array(65)).join('0');
          }

          // Add block ID to order list
          order.push(block.id);
          // Add block to list
          blocks[block.id] = block;
        }

        // Normalize transaction
        const transaction             = this.transactionLogic.dbRead(rows[i]);
        // Set empty object if there are no transactions in block
        blocks[block.id].transactions = blocks[block.id].transactions || {};

        if (transaction) {
          // Add transaction to block if not there already
          if (!blocks[block.id].transactions[transaction.id]) {
            blocks[block.id].transactions[transaction.id] = transaction;
          }
        }
      }
    }

    // Reorganize list
    return order.map((v) => {
      blocks[v].transactions = Object.keys(blocks[v].transactions).map((t) => blocks[v].transactions[t]);
      return blocks[v];
    });
  }

  /**
   * Loads blocks from database and normalize them
   *
   */
  public async loadBlocksPart(filter: { limit?: number, id?: string, lastId?: string }) {
    return this.loadBlocksData(filter);
  }

  /**
   * Loads the last block from db and normalizes it.
   * @return {Promise<BlocksModel>}
   */
  public async loadLastBlock(): Promise<BlocksModel> {
    const b                     = await this.BlocksModel.findOne({
      include: [this.TransactionsModel],
      limit  : 1,
      order  : [['height', 'DESC']],
    });
    // attach transaction assets
    await this.transactionLogic.attachAssets(b.transactions);

    this.blocksModule.lastBlock = b;
    return b;
  }

  /**
   * Gets block IDs sequence - last block id, ids of first blocks of last 5 rounds and genesis block id.
   * @param {number} height
   */
  public async getIdSequence(height: number): Promise<{ firstHeight: number, ids: string[] }> {
    const lastBlock = this.blocksModule.lastBlock;
    // Get IDs of first blocks of (n) last rounds, descending order
    // EXAMPLE: For height 2000000 (round 19802) we will get IDs of blocks at height: 1999902, 1999801, 1999700,
    // 1999599, 1999498
    const firstInRound             = this.rounds.firstInRound(this.rounds.calcRound(height));
    const heightsToQuery: number[] = [];
    for (let i = 0; i < 5; i++) {
      heightsToQuery.push(firstInRound - this.constants.activeDelegates * i);
    }

    const blocks: Array<{ id: string, height: number }> = await BlocksModel
      .findAll({
        attributes: ['id', 'height'],
        order     : [['height', 'DESC']],
        raw       : true,
        where     : {height: heightsToQuery},
      });

    if (blocks.length === 0) {
      throw new Error(`Failed to get id sequence for height ${height}`);
    }

    // Add genesis block at the end if the set doesn't contain it already
    if (this.genesisBlock) {
      if (!blocks.find((v) => v.id === this.genesisBlock.id)) {
        blocks.push({
          height: this.genesisBlock.height,
          id    : this.genesisBlock.id,
        });
      }
    }

    // Add last block at the beginning if the set doesn't contain it already
    if (lastBlock && !blocks.find((v) => v.id === lastBlock.id)) {
      blocks.unshift({
        height: lastBlock.height,
        id    : lastBlock.id,
      });
    }

    const ids: string[] = blocks.map((r) => r.id);

    return {firstHeight: blocks[0].height, ids};
  }

  // tslint:disable-next-line max-line-length
  public async loadBlocksData(filter: { limit?: number, id?: string, lastId?: string }): Promise<BlocksModel[]> {
    const params: any = {limit: filter.limit || 1};
    if (filter.id && filter.lastId) {
      throw new Error('Invalid filter: Received both id and lastId');
    } else if (filter.id) {
      params.id = filter.id;
    } else if (filter.lastId) {
      params.lastId = filter.lastId;
    }
    return await this.dbSequence.addAndPromise<BlocksModel[]>(async () => {
      const block = await this.BlocksModel.findOne({
        include: [this.TransactionsModel],
        where  : {id: filter.lastId || filter.id || null},
      });

      const height = block !== null ? block.height : 0;
      // Calculate max block height for database query

      if (typeof(params.lastId) !== 'undefined') {
        const limit = height + (parseInt(`${filter.limit}`, 10) || 1);
        return await this.BlocksModel.findAll({
          include: [this.TransactionsModel],
          order: ['height', 'rowId'],
          where: {height: {[Op.gt]: height, [Op.lt]: limit}},
        });
      }
      return [block];
    })
    // Attach assets to each block transaction.
      .then((blocks) => Promise.all(
        blocks.map((b) => this.transactionLogic.attachAssets(b.transactions)
          .then(() => b))
        )
      )
      .catch(catchToLoggerAndRemapError<BlocksModel[]>('Blocks#loadBlockData error', this.logger));
  }

  public getBlockProgressLogger(txCount: number, logsFrequency: number, msg: string) {
    return new BlockProgressLogger(txCount, logsFrequency, msg, this.logger);
  }

  /**
   * Gets block rewards for a delegate for time period
   */
  // tslint:disable-next-line max-line-length
  public async aggregateBlockReward(filter: { generatorPublicKey: publicKey, start?: number, end?: number }): Promise<{ fees: number, rewards: number, count: number }> {
    const params: any                                                         = {};
    params.generatorPublicKey                                                 = filter.generatorPublicKey;
    params.delegates                                                          = this.constants.activeDelegates;
    const timestampClausole: { timestamp?: any } = {timestamp: {}};

    if (typeof(filter.start) !== 'undefined') {
      timestampClausole.timestamp[Op.gte] = filter.start - this.constants.epochTime.getTime() / 1000;
    }

    if (typeof(filter.end) !== 'undefined') {
      timestampClausole.timestamp[Op.lte] = filter.end - this.constants.epochTime.getTime() / 1000;
    }

    if (typeof(timestampClausole.timestamp[Op.gte]) === 'undefined'
      && typeof(timestampClausole.timestamp[Op.lte]) === 'undefined') {
      delete timestampClausole.timestamp;
    }

    const bufPublicKey = Buffer.from(params.generatorPublicKey, 'hex');
    const acc          = await AccountsModel
      .findOne({where: {isDelegate: 1, publicKey: bufPublicKey}});
    if (acc === null) {
      throw new Error('Account not found or is not a delegate');
    }

    const res: { count: string, rewards: string } = await this.BlocksModel.findOne({
      attributes: [
        sequelize.literal('COUNT(1)'),
        sequelize.literal('SUM("reward") as rewards'),
      ],
      raw       : true,
      where     : {
        ...timestampClausole,
        generatorPublicKey: bufPublicKey,
      },
    }) as any;

    const data = {
      count  : parseInt(res.count, 10),
      fees   : (await this.RoundsFeesModel.aggregate('fees', 'sum', {
        where: {
          ...timestampClausole,
          publicKey: bufPublicKey,
        },
      })) as number,
      rewards: res.rewards === null ? 0 : parseInt(res.rewards, 10),
    };
    if (isNaN(data.fees)) {
      // see https://github.com/sequelize/sequelize/issues/6299
      data.fees = 0;
    }
    return data;
  }

}
