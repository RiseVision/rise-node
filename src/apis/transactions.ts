import { LiskWallet as RISEWallet, SendTx } from 'dpos-offline';
import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import {Body, Get, JsonController, Post, Put, QueryParam, QueryParams, UseBefore} from 'routing-controllers';
import { Op } from 'sequelize';
import * as z_schema from 'z-schema';
import {castFieldsToNumberUsingSchema, constants, removeEmptyObjKeys, TransactionType} from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { assertValidSchema, SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { ISlots } from '../ioc/interfaces/helpers';
import { ITransactionLogic } from '../ioc/interfaces/logic';
import {
  IAccountsModule,
  IBlocksModule,
  ISystemModule,
  ITransactionsModule,
  ITransportModule
} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { IBaseTransaction, ITransportTransaction } from '../logic/transactions';
import { TransactionsModel } from '../models';
import schema from '../schema/transactions';
import { APIError } from './errors';
import { RestrictedAPIWatchGuard } from './utils/restrictedAPIWatchGuard';

@JsonController('/api/transactions')
@injectable()
@IoCSymbol(Symbols.api.transactions)
export class TransactionsAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;

  @inject(Symbols.helpers.slots)
  public slots: ISlots;

  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.modules.transport)
  private transportModule: ITransportModule;

  @inject(Symbols.models.transactions)
  private TXModel: typeof TransactionsModel;

  @inject(Symbols.logic.transaction)
  private txLogic: ITransactionLogic;

  @inject(Symbols.helpers.constants)
  private constants: typeof constants;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

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
    assertValidSchema(this.schema, body, { obj: schema.getTransactions, opts: {} });

    const andBody = {};
    Object.keys(body)
      .filter((what) => what.startsWith('and:'))
      .forEach((k) => andBody[k.split(':')[1]] = body[k]);
    const andWhereClause = this.createWhereClause(andBody);

    const orBody = {};
    Object.keys(body)
      .filter((what) => !what.startsWith('and:'))
      .forEach((k) => orBody[k] = body[k]);
    const orWhereClause = this.createWhereClause(orBody);

    let orderBy;
    if (body.orderBy) {
      orderBy = [body.orderBy.split(':')];
    }

    const where = removeEmptyObjKeys({ ...andWhereClause, [Op.or]: orWhereClause }, true);
    if (Object.keys(where[Op.or]).length === 0) {
      delete where[Op.or];
    }
    const { rows: transactions, count } = await this.TXModel.findAndCountAll({
      limit : body.limit || 100,
      offset: body.offset || 0,
      order : orderBy,
      where,
    });
    // Reattach transactions asset
    await this.txLogic.attachAssets(transactions);

    return {
      count,
      transactions: transactions
        .map((t) => t.toTransport(this.blocksModule)),
    };
  }

  @Get('/count')
  public getCount(): Promise<{ confirmed: number, multisignature: number, queued: number, unconfirmed: number }> {
    return this.transactionsModule.count();
  }

  @Get('/get')
  @ValidateSchema()
  public async getTX(
    @SchemaValid(schema.getTransaction)
    @QueryParams() params: { id: string }) {

    const { id } = params;
    const txOBJ     = (await this.transactionsModule.getByID(id));
    await this.txLogic.attachAssets([txOBJ]);

    const tx = txOBJ.toTransport(this.blocksModule);
    if (tx.type === TransactionType.VOTE) {
      // tslint:disable-next-line
      tx['votes'] = {
        added  : tx.asset.votes
          .filter((v) => v.startsWith('+'))
          .map((v) => v.substr(1)),
        deleted: tx.asset.votes
          .filter((v) => v.startsWith('-'))
          .map((v) => v.substr(1)),
      };
    }
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
        .filter((tx) => params.senderPublicKey ?
          Buffer.from(params.senderPublicKey, 'hex').equals(tx.senderPublicKey) :
          true)
        .filter((tx) => params.address ? params.address === tx.recipientId : true)
        .map((tx) => this.TXModel.toTransportTransaction(tx, this.blocksModule)),
    };
  }

  @Get('/multisignatures/get')
  @ValidateSchema()
  public async getMultiSig(@SchemaValid(schema.getPooledTransaction.properties.id)
                           @QueryParam('id', { required: true }) id: string) {
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
        .filter((tx) => params.senderPublicKey ?
          Buffer.from(params.senderPublicKey, 'hex').equals(tx.senderPublicKey) :
          true)
        .filter((tx) => params.address ? params.address === tx.recipientId : true)
        .map((tx) => this.TXModel.toTransportTransaction(tx, this.blocksModule)),
    };
  }

  @Get('/queued/get')
  @ValidateSchema()
  public async getQueuedTx(@SchemaValid(schema.getPooledTransaction.properties.id)
                           @QueryParam('id', { required: true }) id: string) {
    const transaction = this.transactionsModule.getQueuedTransaction(id);
    if (!transaction) {
      throw new APIError('Transaction not found', 200);
    }
    return { transaction: this.TXModel.toTransportTransaction(transaction, this.blocksModule) };
  }

  @Get('/unconfirmed')
  @ValidateSchema()
  public async getUnconfirmedTxs(@SchemaValid(schema.getPooledTransactions)
                                 @QueryParams() params: { senderPublicKey?: string, address?: string }) {
    const txs = this.transactionsModule.getUnconfirmedTransactionList(true);
    return {
      count       : txs.length,
      transactions: txs
        .filter((tx) => {
          // Either senderPublicKey or address matching as recipientId
          // or all if no params were set.
          return ( !params.senderPublicKey && !params.address) ||
            (
              params.senderPublicKey ?
                Buffer.from(params.senderPublicKey, 'hex').equals(tx.senderPublicKey) :
                false
            ) ||
            (
              params.address ?
                params.address === tx.recipientId :
                false
            );
        })
        .map((tx) => this.TXModel.toTransportTransaction(tx, this.blocksModule)),
    };
  }

  @Get('/unconfirmed/get')
  @ValidateSchema()
  public async getUnconfirmedTx(@SchemaValid(schema.getPooledTransaction.properties.id)
                                @QueryParam('id', { required: true }) id: string) {
    const transaction = this.transactionsModule.getUnconfirmedTransaction(id);
    if (!transaction) {
      throw new APIError('Transaction not found', 200);
    }
    return { transaction: this.TXModel.toTransportTransaction(transaction, this.blocksModule) };
  }

  @Post()
  @ValidateSchema()
  @UseBefore(RestrictedAPIWatchGuard)
  public async localCreate(
    @SchemaValid(schema.addTransactions, {castNumbers: true})
    @Body() body: {
      secret: string,
      recipientId: string,
      amount: number,
      secondSecret?: string
    }
  ) {
    const w = new RISEWallet(body.secret, this.constants.addressSuffix);
    const second = body.secondSecret ? new RISEWallet(body.secondSecret, this.constants.addressSuffix) : undefined;
    const transaction = w.signTransaction(
      new SendTx()
      .set('amount', body.amount)
      .set('timestamp', this.slots.getTime())
      .set('recipientId', body.recipientId)
      .set('fee', this.systemModule.getFees().fees.send),
      second
    );

    const res = await this.put({ transaction });
    if (res.accepted && res.accepted.length === 1) {
      return { transactionId: res.accepted[0] };
    } else {
      throw new Error(res.invalid[0].reason);
    }
  }

  @Put()
  @ValidateSchema()
  public async put(
    @SchemaValid({type: 'object', properties: { transaction: {type: 'object'}, transactions: {type: 'array', maxItems: 10}}})
    @Body() body: {
      transaction?: ITransportTransaction<any>,
      transactions?: Array<ITransportTransaction<any>>
    }
  ) {
    const { transaction } = body;
    let { transactions }  = body;
    if (transactions && !Array.isArray(transactions)) {
      transactions = [];
    }

    const invalidTxsWithReasons: Array<{ id: string, reason: string }> = [];
    const validTxsIDs                                                  = [];
    const allTxs                                                       = [];
    if (transaction) {
      allTxs.push(transaction);
    }
    if (transactions) {
      allTxs.push(...transactions);
    }

    const validTxs: Array<IBaseTransaction<any>>                    = [];
    const transportTxs: { [k: string]: ITransportTransaction<any> } = {};
    for (const tx of allTxs) {
      try {
        validTxs.push(this.txLogic.objectNormalize(tx));
        transportTxs[tx.id] = tx;
      } catch (e) {
        // Tx is not valid.
        invalidTxsWithReasons.push({ id: tx.id, reason: e.message });
      }
    }

    // Validate transactions against db. this is a mechanism to avoid pollution of queues of invalid transactions.
    // We filter them here even before we queue them
    // NOTE: These checks are performed here and then in transactionlogic.
    const accountsMap = await this.accountsModule.resolveAccountsForTransactions(validTxs);
    await Promise.all(validTxs.slice().map((tx) => this.transactionsModule
      .checkTransaction(tx, accountsMap, this.blocksModule.lastBlock.height)
      .then(() => validTxsIDs.push(tx.id))
      .catch((err) => {
        // Remove from valid
        validTxs.splice(validTxs.findIndex((t) => t.id === tx.id), 1);
        // Add to invalid
        invalidTxsWithReasons.push({ id: tx.id, reason: err.message });
      }))
    );
    if (validTxs.length > 0) {
      // Schema validation is done in transportModule
      await this.transportModule.receiveTransactions(
        validTxs.map((tx) => transportTxs[tx.id]),
        null,
        true
      );
    }

    return { accepted: validTxsIDs, invalid: invalidTxsWithReasons };
  }

  private createWhereClause(body: any) {
    const whereClause          = {
      amount         : {},
      blockId        : {},
      height         : {},
      recipientId    : {},
      senderId       : {},
      senderPublicKey: {},
      timestamp      : {},
      type           : {},
    };
    whereClause.amount[Op.lte] = body.maxAmount;
    whereClause.amount[Op.gte] = body.minAmount;

    whereClause.blockId[Op.eq] = body.blockId;

    whereClause.height[Op.gte] = body.fromHeight;
    whereClause.height[Op.lte] = body.toHeight;

    whereClause.recipientId[Op.eq] = body.recipientId;

    whereClause.senderId[Op.eq] = body.senderId;

    whereClause.senderPublicKey[Op.eq] = body.senderPublicKey ? Buffer.from(body.senderPublicKey, 'hex') : undefined;

    whereClause.timestamp[Op.lte] = body.toTimestamp;
    whereClause.timestamp[Op.gte] = body.fromTimestamp;

    whereClause.type[Op.eq] = body.type;

    // Computed stuff
    if (body.minConfirmations) {
      whereClause.height[Op.lte] = Math.min(
        Number.isInteger(whereClause.height[Op.lte]) ? whereClause.height[Op.lte] : Number.MAX_SAFE_INTEGER,
        this.blocksModule.lastBlock.height - body.minConfirmations
      );
    }

    if (body.fromUnixTime) {
      whereClause.timestamp[Op.gte] = Math.max(
        this.slots.getTime(body.fromUnixTime),
        Number.isInteger(whereClause.timestamp[Op.gte]) ? whereClause.timestamp[Op.gte] : 0
      );
    }
    if (body.toUnixTime) {
      whereClause.timestamp[Op.lte] = Math.min(
        this.slots.getTime(body.toUnixTime),
        Number.isInteger(whereClause.timestamp[Op.lte]) ? whereClause.timestamp[Op.lte] : 0
      );
    }

    if (Array.isArray(body.senderIds)) {
      whereClause.senderId = { [Op.in]: body.senderIds.map((item) => item.toUpperCase()) };
      if (body.senderId) {
        whereClause.senderId[Op.in].push(body.senderId.toUpperCase());
      }
    }

    if (Array.isArray(body.recipientIds)) {
      whereClause.recipientId = { [Op.in]: body.recipientIds.map((item) => item.toUpperCase()) };
      if (body.recipientId) {
        whereClause.recipientId[Op.in].push(body.recipientId.toUpperCase());
      }
    }

    if (Array.isArray(body.senderPublicKeys)) {
      whereClause.senderPublicKey = { [Op.in]: body.senderPublicKeys.map((pk) => Buffer.from(pk, 'hex')) };
      if (body.senderPublicKey) {
        whereClause.senderPublicKey[Op.in].push(Buffer.from(body.senderPublicKey, 'hex'));
      }
    }

    removeEmptyObjKeys(whereClause, true);
    for (const k in whereClause) {
      if (Object.keys(whereClause[k]).length === 0 && Object.getOwnPropertySymbols(whereClause[k]).length === 0) {
        delete whereClause[k];
      }
    }
    return whereClause;
  }

}
