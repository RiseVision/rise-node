import {inject, injectable} from 'inversify';
import * as _ from 'lodash';
import { Get, JsonController, Put, QueryParam, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { castFieldsToNumberUsingSchema } from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { ITransactionsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import schema from '../schema/transactions';

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
    let params  = {};
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
    params = castFieldsToNumberUsingSchema(schema.getTransactions, params);

    if (!this.schema.validate(params, schema.getTransactions)) {
      throw new Error(`Schema invalid ${this.schema.getLastErrors()[0].path} - ${this.schema.getLastError().message}`);
    }

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
  public getMultiSigs(@SchemaValid(schema.getPooledTransactions)
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
      throw new Error('Transaction not found');
    }
    return { transaction };
  }

  @Get('/queued')
  @ValidateSchema()
  public getQueuedTxs(@SchemaValid(schema.getPooledTransactions)
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
      throw new Error('Transaction not found');
    }
    return { transaction };
  }

  @Get('/unconfirmed')
  @ValidateSchema()
  public getUnconfirmedTxs(@SchemaValid(schema.getPooledTransactions)
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
