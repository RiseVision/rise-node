import {Get, JsonController, QueryParams} from 'routing-controllers';
import {TransportModule} from '../transport';
import {PeersModule} from '../peers';
import {SchemaValid, ValidateSchema} from './baseAPIClass';
import blocksSchema from '../../schema/blocks';
import Sequence from '../../helpers/sequence';
import {publicKey} from '../../types/sanityTypes';
import OrderBy from '../../helpers/orderBy';
import sql from '../../sql/blocks';
import {IDatabase} from 'pg-promise';

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
// TODO : this is not possible to create due to limitation of routing-controllers
// We'll need to set up dependency injection first to let this work properly.
@JsonController('/blocks')
export class blocksAPI {
  public schema: any;

  constructor(private transportModule: TransportModule, private blocksModule: any,
              private peersModule: PeersModule,
              private dbSequence: Sequence,
              private transactionsModule: any,
              private db: IDatabase<any>) {
    this.schema = transportModule.schema;
  }

  @Get('/')
  @ValidateSchema()
  public async getBlocks(@SchemaValid(blocksSchema.getBlocks)
                         @QueryParams() params) {
    this.dbSequence.addAndPromise(() => this.list())
  }

  private async list(filter: FilterType) {
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

    const rows = await this.db.query(sql.list({
      sortField : orderBy.sortField,
      sortMethod: orderBy.sortMethod,
      where,
    }), params);




  }
}
