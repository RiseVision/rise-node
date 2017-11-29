import * as _ from 'lodash';
import { Body, Get, JsonController, Put, QueryParam, QueryParams } from 'routing-controllers';
import schema from '../../schema/transactions';
import { TransactionsModule } from '../transactions';
import { SchemaValid, ValidateSchema } from './baseAPIClass';

// TODO : this is not possible to create due to limitation of routing-controllers
// We'll need to set up dependency injection first to let this work properly.
@JsonController('/transactions')
export class TransportAPI {
  public schema: any;

  constructor(private transactionModule: TransactionsModule) {
  }

  @Get()
  public async getTransactions(@Body() body: any) {
    const params  = {};
    const pattern = /(and|or){1}:/i;

    // Filter out 'and:'/'or:' from params to perform schema validation
    _.each(body, (value, key) => {
      const param = String(key).replace(pattern, '');
      // Dealing with array-like parameters (csv comma separated)
      if (_.includes(['senderIds', 'recipientIds', 'senderPublicKeys', 'recipientPublicKeys'], param)) {
        value     = String(value).split(',');
        body[key] = value;
      }
      params[param] = value;
    });

    if (!this.schema.validate(params, schema.getTransactions)) {
      throw new Error('Schema invalid');
    }

    const { transactions, count } = await this.transactionModule.list(body)
      .catch((err) => Promise.reject(new Error(`Failed to get transactions: ${err.message || err}`)));

    return { transactions, count };
  }

  @Get('/count')
  public getCount(): Promise<{ confirmed: number, multisignature: number, queued: number, unconfirmed: number }> {
    return this.transactionModule.count();
  }

  @Get('/get')
  public async getTX(@QueryParam('id', { required: true }) id: string) {
    // Do validation on length?
    const tx = await this.transactionModule.getByID(id);
    return { transaction: tx };
  }

  @Get('/multisignatures')
  @ValidateSchema()
  public getMultiSigs(@SchemaValid(schema.getPooledTransactions)
                      @QueryParams() params: { senderPublicKey?: string, address?: string }) {
    const txs = this.transactionModule.getMultisignatureTransactionList(true);

    return {
      count       : txs.length,
      transactions: txs
        .filter((tx) => params.senderPublicKey ? params.senderPublicKey === tx.senderPublicKey : true)
        .filter((tx) => params.address ? params.address === tx.recipientId : true),
    };
  }

  @Get('/multisignatures/get')
  @ValidateSchema()
  public async getMultiSig(@SchemaValid(schema.getPooledTransaction.properties.id)
                           @QueryParam('id') id: string) {
    const transaction = this.transactionModule.getMultisignatureTransaction(id);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    return { transaction };
  }

  @Get('/queued')
  @ValidateSchema()
  public getQueuedTxs(@SchemaValid(schema.getPooledTransactions)
                      @QueryParams() params: { senderPublicKey?: string, address?: string }) {
    const txs = this.transactionModule.getQueuedTransactionList(true);

    return {
      count       : txs.length,
      transactions: txs
        .filter((tx) => params.senderPublicKey ? params.senderPublicKey === tx.senderPublicKey : true)
        .filter((tx) => params.address ? params.address === tx.recipientId : true),
    };
  }

  @Get('/queued/get')
  @ValidateSchema()
  public async getQueuedTx(@SchemaValid(schema.getPooledTransaction.properties.id)
                           @QueryParam('id') id: string) {
    const transaction = this.transactionModule.getQueuedTransaction(id);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    return { transaction };
  }

  @Get('/unconfirmed')
  @ValidateSchema()
  public getUnconfirmedTxs(@SchemaValid(schema.getPooledTransactions)
                           @QueryParams() params: { senderPublicKey?: string, address?: string }) {
    const txs = this.transactionModule.getUnconfirmedTransactionList(true);

    return {
      count       : txs.length,
      transactions: txs
        .filter((tx) => params.senderPublicKey ? params.senderPublicKey === tx.senderPublicKey : true)
        .filter((tx) => params.address ? params.address === tx.recipientId : true),
    };
  }

  @Get('/unconfirmed/get')
  @ValidateSchema()
  public async getUnconfirmedTx(@SchemaValid(schema.getPooledTransaction.properties.id)
                                @QueryParam('id') id: string) {
    const transaction = this.transactionModule.getUnconfirmedTransaction(id);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    return { transaction };
  }

  @Put()
  /**
   * @deprecated
   */
  public async put() {
    throw new Error('This method is deprecated');
  }

}
