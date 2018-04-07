import {inject, injectable} from 'inversify';
import * as _ from 'lodash';
import { Get, JsonController, Put, QueryParam, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { castFieldsToNumberUsingSchema } from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { assertValidSchema, SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { ITransactionsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import schema from '../schema/transactions';
import { APIError, DeprecatedAPIError } from './errors';

@JsonController('/api/transactions')
@injectable()
@IoCSymbol(Symbols.api.transactions)
export class TransactionsAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;

  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;

  @Get()
  public async getTransactions(@QueryParams() body: any) {
    const pattern = /(and|or){1}:/i;

    _.each(body, (value, key) => {
      const param = String(key).replace(pattern, '');
      // Dealing with array-like parameters (csv comma separated)
      if (_.includes(['senderIds', 'recipientIds', 'senderPublicKeys', 'recipientPublicKeys'], param)) {
        value     = String(value).split(',');
        body[key] = value;
      }
      // params[param] = value;
    });
    body = castFieldsToNumberUsingSchema(schema.getTransactions, body);
    assertValidSchema(this.schema, body, { obj: schema.getTransactions, opts: {}});

    const { transactions, count } = await this.transactionsModule.list(body)
      .catch((err) => Promise.reject(new Error(`Failed to get transactions: ${err.message || err}`)));

    return { transactions, count };
  }

  @Get('/count')
  public getCount(): Promise<{ confirmed: number, multisignature: number, queued: number, unconfirmed: number }> {
    return this.transactionsModule.count();
  }

  @Get('/get')
  public async getTX(@QueryParam('id', { required: true }) id: string) {
    // Do validation on length?
    const tx = await this.transactionsModule.getByID(id);
    return { transaction: tx };
  }

  @Get('/multisignatures')
  @ValidateSchema()
  public async getMultiSigs(@SchemaValid(schema.getPooledTransactions)
                      @QueryParams() params: { senderPublicKey?: string, address?: string }) {
    const txs = this.transactionsModule.getMultisignatureTransactionList(true);

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
    const transaction = this.transactionsModule.getMultisignatureTransaction(id);
    if (!transaction) {
      throw new APIError('Transaction not found', 200);
    }
    return { transaction };
  }

  @Get('/queued')
  @ValidateSchema()
  public async getQueuedTxs(@SchemaValid(schema.getPooledTransactions)
                      @QueryParams() params: { senderPublicKey?: string, address?: string }) {
    const txs = this.transactionsModule.getQueuedTransactionList(true);

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
    const transaction = this.transactionsModule.getQueuedTransaction(id);
    if (!transaction) {
      throw new APIError('Transaction not found', 200);
    }
    return { transaction };
  }

  @Get('/unconfirmed')
  @ValidateSchema()
  public async getUnconfirmedTxs(@SchemaValid(schema.getPooledTransactions)
                           @QueryParams() params: { senderPublicKey?: string, address?: string }) {
    const txs = this.transactionsModule.getUnconfirmedTransactionList(true);

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
    const transaction = this.transactionsModule.getUnconfirmedTransaction(id);
    if (!transaction) {
      throw new APIError('Transaction not found', 200);
    }
    return { transaction };
  }

  @Put()
  /**
   * @deprecated
   */
  public async put() {
    throw new DeprecatedAPIError();
  }

}
