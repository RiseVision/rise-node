import { PrivateApisGuard } from '@risevision/core-apis';
import {
  IAccountsModel,
  IAccountsModule,
  IBlocksModule,
  ISystemModule,
  ITimeToEpoch,
  ITransactionLogic,
  ITransactionsModel,
  ITransactionsModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import {
  ConstantsType,
  IBaseTransaction,
  ITransportTransaction,
} from '@risevision/core-types';
import {
  assertValidSchema,
  castFieldsToNumberUsingSchema,
  HTTPError,
  IoCSymbol,
  removeEmptyObjKeys,
  SchemaValid,
  ValidateSchema,
} from '@risevision/core-utils';
import { Address, RiseV2 } from 'dpos-offline';
import { inject, injectable, named } from 'inversify';
import * as _ from 'lodash';
import { WordPressHookSystem } from 'mangiafuoco';
import {
  Body,
  Get,
  JsonController,
  Post,
  Put,
  QueryParam,
  QueryParams,
  UseBefore,
} from 'routing-controllers';
import { Op } from 'sequelize';
import * as z_schema from 'z-schema';
import { TXApiGetTxFilter } from '../hooks/filters';
import { TransactionPool } from '../TransactionPool';
import { TXSymbols } from '../txSymbols';

// tslint:disable-next-line
const schema = require('../../schema/api.json');

@JsonController('/api/transactions')
@injectable()
@IoCSymbol(TXSymbols.api.api)
export class TransactionsAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.generic.constants)
  public constants: ConstantsType;

  @inject(Symbols.helpers.timeToEpoch)
  public timeToEpoch: ITimeToEpoch;

  @inject(Symbols.generic.hookSystem)
  private hookSystem: WordPressHookSystem;

  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(TXSymbols.module)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(ModelSymbols.model)
  @named(TXSymbols.model)
  private TXModel: typeof ITransactionsModel;
  @inject(ModelSymbols.model)
  @named(ModelSymbols.names.accounts)
  private AccountsModel: typeof IAccountsModel;

  @inject(TXSymbols.logic)
  private txLogic: ITransactionLogic;

  @inject(TXSymbols.pool)
  private pool: TransactionPool;

  @Get()
  public async getTransactions(@QueryParams() body: any) {
    const pattern = /(and|or){1}:/i;

    _.each(body, (value, key) => {
      const param = String(key).replace(pattern, '');
      // Dealing with array-like parameters (csv comma separated)
      if (
        _.includes(
          [
            'senderIds',
            'recipientIds',
            'senderPublicKeys',
            'recipientPublicKeys',
          ],
          param
        )
      ) {
        value = String(value).split(',');
        body[key] = value;
      }
      // params[param] = value;
    });
    body = castFieldsToNumberUsingSchema(schema.getTransactions, body);
    assertValidSchema(this.schema, body, {
      obj: schema.getTransactions,
      opts: {},
    });

    const andBody = {};
    Object.keys(body)
      .filter((what) => what.startsWith('and:'))
      .forEach((k) => (andBody[k.split(':')[1]] = body[k]));
    const andWhereClause = this.createWhereClause(andBody);

    const orBody = {};
    Object.keys(body)
      .filter((what) => !what.startsWith('and:'))
      .forEach((k) => (orBody[k] = body[k]));
    const orWhereClause = this.createWhereClause(orBody);

    let orderBy;
    if (body.orderBy) {
      orderBy = [body.orderBy.split(':')];
    }

    const where = removeEmptyObjKeys(
      { ...andWhereClause, [Op.or]: orWhereClause },
      true
    );
    if (Object.keys(where[Op.or]).length === 0) {
      delete where[Op.or];
    }
    const { rows: transactions, count } = await this.TXModel.findAndCountAll({
      limit: body.limit || 100,
      offset: body.offset || 0,
      order: orderBy,
      where,
    });
    // Reattach transactions asset
    await this.txLogic.attachAssets(transactions);

    return {
      count,
      transactions: transactions.map((t) => t.toTransport()),
    };
  }

  @Get('/count')
  public getCount() {
    return this.transactionsModule.count();
  }

  @Get('/get')
  @ValidateSchema()
  public async getTX(@SchemaValid(schema.getTransaction)
  @QueryParams()
  params: {
    id: string;
  }) {
    const { id } = params;
    const txOBJ = await this.TXModel.findById(id);
    if (txOBJ === null) {
      throw new Error('Transaction not found');
    }
    await this.txLogic.attachAssets([txOBJ]);

    const tx = await this.hookSystem.apply_filters(
      TXApiGetTxFilter.name,
      txOBJ.toTransport()
    );
    return { transaction: tx };
  }

  @Get('/pending')
  @ValidateSchema()
  public async getPendings(@SchemaValid(schema.getPooledTransactions)
  @QueryParams()
  params: {
    senderPublicKey?: string;
    address?: string;
  }) {
    const txs = this.pool.pending.txList({ reverse: true });

    return {
      count: txs.length,
      transactions: txs
        .filter((tx) =>
          params.senderPublicKey
            ? Buffer.from(params.senderPublicKey, 'hex').equals(
                tx.senderPublicKey
              )
            : true
        )
        .filter((tx) =>
          params.address ? params.address === tx.recipientId : true
        )
        .map((tx) => this.TXModel.toTransportTransaction(tx)),
    };
  }

  @Get('/pending/get')
  @ValidateSchema()
  public async getPending(
    @SchemaValid(schema.getPooledTransaction.properties.id)
    @QueryParam('id')
    id: string
  ) {
    if (!this.pool.pending.has(id)) {
      throw new HTTPError('Transaction not found', 200);
    }
    const { tx } = this.pool.pending.get(id);
    return { transaction: this.TXModel.toTransportTransaction(tx) };
  }

  @Get('/queued')
  @ValidateSchema()
  public async getQueuedTxs(@SchemaValid(schema.getPooledTransactions)
  @QueryParams()
  params: {
    senderPublicKey?: string;
    address?: string;
  }) {
    const txs = this.pool.queued.txList({ reverse: true });

    return {
      count: txs.length,
      transactions: txs
        .filter((tx) =>
          params.senderPublicKey
            ? Buffer.from(params.senderPublicKey, 'hex').equals(
                tx.senderPublicKey
              )
            : true
        )
        .filter((tx) =>
          params.address ? params.address === tx.recipientId : true
        )
        .map((tx) => this.TXModel.toTransportTransaction(tx)),
    };
  }

  @Get('/queued/get')
  @ValidateSchema()
  public async getQueuedTx(
    @SchemaValid(schema.getPooledTransaction.properties.id)
    @QueryParam('id')
    id: string
  ) {
    if (!this.pool.queued.has(id)) {
      throw new HTTPError('Transaction not found', 200);
    }
    const { tx } = this.pool.queued.get(id);
    return { transaction: this.TXModel.toTransportTransaction(tx) };
  }

  @Get('/unconfirmed')
  @ValidateSchema()
  public async getUnconfirmedTxs(@SchemaValid(schema.getPooledTransactions)
  @QueryParams()
  params: {
    senderPublicKey?: string;
    address?: string;
  }) {
    const txs = this.pool.unconfirmed.txList({ reverse: true });
    return {
      count: txs.length,
      transactions: txs
        .filter((tx) => {
          // Either senderPublicKey or address matching as recipientId
          // or all if no params were set.
          return (
            (!params.senderPublicKey && !params.address) ||
            (params.senderPublicKey
              ? Buffer.from(params.senderPublicKey, 'hex').equals(
                  tx.senderPublicKey
                )
              : false) ||
            (params.address ? params.address === tx.recipientId : false)
          );
        })
        .map((tx) => this.TXModel.toTransportTransaction(tx)),
    };
  }

  @Get('/unconfirmed/get')
  @ValidateSchema()
  public async getUnconfirmedTx(
    @SchemaValid(schema.getPooledTransaction.properties.id)
    @QueryParam('id')
    id: string
  ) {
    if (!this.pool.unconfirmed.has(id)) {
      throw new HTTPError('Transaction not found', 200);
    }
    const { tx } = this.pool.unconfirmed.get(id);
    return { transaction: this.TXModel.toTransportTransaction(tx) };
  }

  @Post()
  @ValidateSchema()
  @UseBefore(PrivateApisGuard)
  public async localCreate(@SchemaValid(schema.addTransactions, {
    castNumbers: true,
  })
  @Body()
  body: {
    secret: string;
    recipientId: string;
    amount: number;
    secondSecret?: string;
  }) {
    const kp = RiseV2.deriveKeypair(body.secret);
    const skp = body.secondSecret
      ? RiseV2.deriveKeypair(body.secondSecret)
      : undefined;

    const transaction = RiseV2.txs.createAndSign(
      {
        amount: `${body.amount}`,
        kind: 'send',
        recipient: body.recipientId as Address,
      },
      kp,
      true
    );

    if (skp) {
      transaction.signSignature = RiseV2.txs.calcSignature(transaction, skp);
    }

    const postableTx = RiseV2.txs.toPostable(transaction);
    const res = await this.put({
      transaction: {
        ...postableTx,
        version: (postableTx as any).version || 0,
      } as any,
    });
    if (res.accepted && res.accepted.length === 1) {
      return { transactionId: res.accepted[0] };
    } else {
      throw new Error(res.invalid[0].reason);
    }
  }

  @Put()
  @ValidateSchema()
  public async put(@SchemaValid({
    properties: {
      transaction: { type: 'object' },
      transactions: { type: 'array', maxItems: 10 },
    },
    type: 'object',
  })
  @Body()
  body: {
    transaction?: ITransportTransaction<any>;
    transactions?: Array<ITransportTransaction<any>>;
  }) {
    const { transaction } = body;
    let { transactions } = body;
    if (transactions && !Array.isArray(transactions)) {
      transactions = [];
    }

    const invalidTxsWithReasons: Array<{ id: string; reason: string }> = [];
    const validTxsIDs = [];
    const allTxs = [];
    if (transaction) {
      allTxs.push(transaction);
    }
    if (transactions) {
      allTxs.push(...transactions);
    }

    const validTxs: Array<IBaseTransaction<any>> = [];
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
    const accountsMap = await this.accountsModule.txAccounts(validTxs);

    await Promise.all(
      validTxs.slice().map((tx) =>
        this.transactionsModule
          .checkTransaction(tx, accountsMap, this.blocksModule.lastBlock.height)
          .then(() => validTxsIDs.push(tx.id))
          .catch((err) => {
            // Remove from valid
            validTxs.splice(validTxs.findIndex((t) => t.id === tx.id), 1);
            // Add to invalid
            invalidTxsWithReasons.push({ id: tx.id, reason: err.message });
          })
      )
    );
    if (validTxs.length > 0) {
      // Schema validation is done in txLogic.objectNormalize.
      await this.transactionsModule.processIncomingTransactions(
        validTxs.map((tx) => this.txLogic.objectNormalize(transportTxs[tx.id])),
        null
      );
    }

    return { accepted: validTxsIDs, invalid: invalidTxsWithReasons };
  }

  // tslint:disable-next-line cognitive-complexity
  private createWhereClause(body: any) {
    const whereClause = {
      amount: {},
      blockId: {},
      height: {},
      recipientId: {},
      senderId: {},
      senderPublicKey: {},
      timestamp: {},
      type: {},
    };
    whereClause.amount[Op.lte] = body.maxAmount;
    whereClause.amount[Op.gte] = body.minAmount;

    whereClause.blockId[Op.eq] = body.blockId;

    whereClause.height[Op.gte] = body.fromHeight;
    whereClause.height[Op.lte] = body.toHeight;

    whereClause.recipientId[Op.eq] = body.recipientId;

    whereClause.senderId[Op.eq] = body.senderId;

    whereClause.senderPublicKey[Op.eq] = body.senderPublicKey
      ? Buffer.from(body.senderPublicKey, 'hex')
      : undefined;

    whereClause.timestamp[Op.lte] = body.toTimestamp;
    whereClause.timestamp[Op.gte] = body.fromTimestamp;

    whereClause.type[Op.eq] = body.type;

    // Computed stuff
    if (body.minConfirmations) {
      whereClause.height[Op.lte] = Math.min(
        Number.isInteger(whereClause.height[Op.lte])
          ? whereClause.height[Op.lte]
          : Number.MAX_SAFE_INTEGER,
        this.blocksModule.lastBlock.height - body.minConfirmations
      );
    }

    if (body.fromUnixTime) {
      whereClause.timestamp[Op.gte] = Math.max(
        this.timeToEpoch.getTime(body.fromUnixTime * 1000),
        Number.isInteger(whereClause.timestamp[Op.gte])
          ? whereClause.timestamp[Op.gte]
          : 0
      );
    }
    if (body.toUnixTime) {
      whereClause.timestamp[Op.lte] = Math.min(
        this.timeToEpoch.getTime(body.toUnixTime * 1000),
        Number.isInteger(whereClause.timestamp[Op.lte])
          ? whereClause.timestamp[Op.lte]
          : 0
      );
    }

    if (Array.isArray(body.senderIds)) {
      whereClause.senderId = {
        [Op.in]: body.senderIds.map((item) => item.toUpperCase()),
      };
      if (body.senderId) {
        whereClause.senderId[Op.in].push(body.senderId.toUpperCase());
      }
    }

    if (Array.isArray(body.recipientIds)) {
      whereClause.recipientId = {
        [Op.in]: body.recipientIds.map((item) => item.toUpperCase()),
      };
      if (body.recipientId) {
        whereClause.recipientId[Op.in].push(body.recipientId.toUpperCase());
      }
    }

    if (Array.isArray(body.senderPublicKeys)) {
      whereClause.senderPublicKey = {
        [Op.in]: body.senderPublicKeys.map((pk) => Buffer.from(pk, 'hex')),
      };
      if (body.senderPublicKey) {
        whereClause.senderPublicKey[Op.in].push(
          Buffer.from(body.senderPublicKey, 'hex')
        );
      }
    }

    removeEmptyObjKeys(whereClause, true);
    for (const k in whereClause) {
      if (
        Object.keys(whereClause[k]).length === 0 &&
        Object.getOwnPropertySymbols(whereClause[k]).length === 0
      ) {
        delete whereClause[k];
      }
    }
    return whereClause;
  }
}
