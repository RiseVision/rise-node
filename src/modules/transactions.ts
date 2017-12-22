import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { IDatabase } from 'pg-promise';
import { constants, ILogger, OrderBy } from '../helpers/';
import { ITransactionLogic, ITransactionPoolLogic } from '../ioc/interfaces/logic';
import { IAccountsModule, ITransactionsModule } from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import { SignedAndChainedBlockType, SignedBlockType } from '../logic/';
import { IBaseTransaction, IConfirmedTransaction } from '../logic/transactions/';
import txSQL from '../sql/logic/transactions';

@injectable()
export class TransactionsModule implements ITransactionsModule {
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;

  @inject(Symbols.logic.transactionPool)
  private transactionPool: ITransactionPoolLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  public cleanup() {
    return Promise.resolve();
  }

  /**
   * Checks if txid is in pool
   */
  public transactionInPool(id: string): boolean {
    return this.transactionPool.transactionInPool(id);
  }

  /**
   * Get unconfirmed transaction from pool by id
   */
  public getUnconfirmedTransaction<T = any>(id: string): IBaseTransaction<T> {
    return this.transactionPool.unconfirmed.get(id);
  }

  /**
   * Get queued tx from pool by id
   */
  public getQueuedTransaction<T = any>(id: string): IBaseTransaction<T> {
    return this.transactionPool.queued.get(id);
  }

  /**
   * Get multisignature tx from pool by id
   */
  public getMultisignatureTransaction<T = any>(id: string): IBaseTransaction<T> {
    return this.transactionPool.multisignature.get(id);
  }

  /**
   * Gets unconfirmed transactions based on limit and reverse option.
   */
  public getUnconfirmedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return this.transactionPool.unconfirmed.list(reverse, limit);
  }

  /**
   * Gets queued transactions based on limit and reverse option.
   */
  public getQueuedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return this.transactionPool.queued.list(reverse, limit);
  }

  /**
   * Gets multisignature transactions based on limit and reverse option.
   */
  public getMultisignatureTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return this.transactionPool.multisignature.list(reverse, limit);
  }

  /**
   * Gets unconfirmed, multisignature and queued transactions based on limit and reverse option.
   */
  public getMergedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return this.transactionPool.getMergedTransactionList(reverse, limit);
  }

  /**
   * Removes transaction from unconfirmed, queued and multisignature.
   */
  public removeUnconfirmedTransaction(id: string) {
    return this.transactionPool.unconfirmed.remove(id);
  }

  /**
   * Checks kind of unconfirmed transaction and process it, resets queue
   * if limit reached.
   */
  public processUnconfirmedTransaction(transaction: IBaseTransaction<any>,
                                       broadcast: boolean, bundled: boolean): Promise<void> {
    return this.transactionPool.processNewTransaction(transaction, broadcast, bundled);
  }

  /**
   * Applies unconfirmed list to unconfirmed Ids.
   */
  public applyUnconfirmedIds(ids: string[]): Promise<void> {
    return this.transactionPool.applyUnconfirmedList(ids, this);
  }

  /**
   * Applies unconfirmed list
   */
  public applyUnconfirmedList(): Promise<void> {
    return this.transactionPool.applyUnconfirmedList(
      this.transactionPool.unconfirmed.list(true),
      this
    );
  }

  /**
   * Undoes unconfirmed list from queue.
   */
  public undoUnconfirmedList(): Promise<string[]> {
    return this.transactionPool.undoUnconfirmedList(this);
  }

  /**
   * Applies confirmed transaction.
   */
  public apply(transaction: IConfirmedTransaction<any>, block: SignedBlockType, sender: any): Promise<void> {
    this.logger.debug('Applying confirmed transaction', transaction.id);
    return this.transactionLogic.apply(transaction, block, sender);
  }

  /**
   * Undoes confirmed transaction.
   */
  public undo(transaction: IConfirmedTransaction<any>, block: SignedBlockType, sender: any): Promise<void> {
    this.logger.debug('Undoing confirmed transaction', transaction.id);
    return this.transactionLogic.undo(transaction, block, sender);
  }

  /**
   * Gets requester if requesterPublicKey and calls applyUnconfirmed.
   */
  public async applyUnconfirmed(transaction: IBaseTransaction<any> & { blockId?: string }, sender: any): Promise<void> {
    this.logger.debug('Applying unconfirmed transaction', transaction.id);

    if (!sender && transaction.blockId !== this.genesisBlock.id) {
      throw new Error('Invalid block id');
    } else {
      if (transaction.requesterPublicKey) {
        const requester = await this.accountsModule.getAccount({ publicKey: transaction.requesterPublicKey });
        if (!requester) {
          throw new Error('Requester not found');
        }

        await this.transactionLogic.applyUnconfirmed(transaction, sender, requester);
      } else {
        await this.transactionLogic.applyUnconfirmed(transaction, sender);
      }
    }
  }

  /**
   * Validates account and Undoes unconfirmed transaction.
   */
  public async undoUnconfirmed(transaction): Promise<void> {
    this.logger.debug('Undoing unconfirmed transaction', transaction.id);

    const sender = await this.accountsModule.getAccount({ publicKey: transaction.senderPublicKey });
    await this.transactionLogic.undoUnconfirmed(transaction, sender);
  }

  /**
   * Receives transactions
   */
  public receiveTransactions(transactions: Array<IBaseTransaction<any>>,
                             broadcast: boolean, bundled: boolean): Promise<void> {
    return this.transactionPool.receiveTransactions(
      transactions,
      broadcast,
      bundled
    );
  }

  public async count(): Promise<{ confirmed: number, multisignature: number, queued: number, unconfirmed: number }> {
    const [res] = await this.db.query(txSQL.count);
    return {
      confirmed     : res.count,
      multisignature: this.transactionPool.multisignature.count,
      queued        : this.transactionPool.queued.count,
      unconfirmed   : this.transactionPool.unconfirmed.count,
    };
  }

  /**
   * Fills the pool.
   */
  public async fillPool(): Promise<void> {
    const newUnconfirmedTXs = await this.transactionPool.fillPool();
    await this.transactionPool.applyUnconfirmedList(newUnconfirmedTXs, this);
  }

  /**
   * Checks if `modules` is loaded.
   * @return {boolean} True if `modules` is loaded.
   */
  public isLoaded() {
    return true;
  }

  public async list(filter): Promise<{ count: number, transactions: Array<IConfirmedTransaction<any>> }> {
    const params: any      = {};
    const where            = [];
    // tslint:disable object-literal-sort-keys
    const allowedFieldsMap = {
      blockId            : '"t_blockId" = ${blockId}',
      senderPublicKey    : '"t_senderPublicKey" = DECODE (${senderPublicKey}, \'hex\')',
      recipientPublicKey : '"m_recipientPublicKey" = DECODE (${recipientPublicKey}, \'hex\')',
      senderId           : '"t_senderId" = ${senderId}',
      recipientId        : '"t_recipientId" = ${recipientId}',
      fromHeight         : '"b_height" >= ${fromHeight}',
      toHeight           : '"b_height" <= ${toHeight}',
      fromTimestamp      : '"t_timestamp" >= ${fromTimestamp}',
      toTimestamp        : '"t_timestamp" <= ${toTimestamp}',
      senderIds          : '"t_senderId" IN (${senderIds:csv})',
      recipientIds       : '"t_recipientId" IN (${recipientIds:csv})',
      senderPublicKeys   : 'ENCODE ("t_senderPublicKey", \'hex\') IN (${senderPublicKeys:csv})',
      recipientPublicKeys: 'ENCODE ("m_recipientPublicKey", \'hex\') IN (${recipientPublicKeys:csv})',
      minAmount          : '"t_amount" >= ${minAmount}',
      maxAmount          : '"t_amount" <= ${maxAmount}',
      type               : '"t_type" = ${type}',
      minConfirmations   : 'confirmations >= ${minConfirmations}',
      limit              : null,
      offset             : null,
      orderBy            : null,
    };
    // tslint:enable object-literal-sort-keys

    let isFirstWhere = true;
    // TODO: move this validation to schema validation.

    // Process parameters and fill where object.
    Object.keys(filter).forEach((key) => {
      let value   = filter[key];
      const field = String(key).split(':');
      if (field.length === 1) {
        // Only field identifier, so using default 'OR' condition
        field.unshift('OR');
      } else if (field.length === 2) {
        // Condition supplied, checking if correct one
        if (_.includes(['or', 'and'], field[0].toLowerCase())) {
          field[0] = field[0].toUpperCase();
        } else {
          throw new Error('Incorrect condition [' + field[0] + '] for field: ' + field[1]);
        }
      } else {
        // Invalid parameter 'x:y:z'
        throw new Error('Invalid parameter supplied: ' + key);
      }

      // Mutating parametres when unix timestamp is supplied
      if (_.includes(['fromUnixTime', 'toUnixTime'], field[1])) {
        // Lisk epoch is 1464109200 as unix timestamp
        value    = value - constants.epochTime.getTime() / 1000;
        field[1] = field[1].replace('UnixTime', 'Timestamp');
      }

      if (!_.includes(_.keys(allowedFieldsMap), field[1])) {
        throw new Error('Parameter is not supported: ' + field[1]);
      }

      // Checking for empty parameters, 0 is allowed for few
      if (!value && !(value === 0 &&
          _.includes(['fromTimestamp', 'minAmount', 'minConfirmations', 'type', 'offset'], field[1]))) {
        throw new Error('Value for parameter [' + field[1] + '] cannot be empty');
      }

      if (allowedFieldsMap[field[1]]) {
        where.push((!isFirstWhere ? (field[0] + ' ') : '') + allowedFieldsMap[field[1]]);
        params[field[1]] = value;
        isFirstWhere     = false;
      }
    });

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

    if (params.limit > 1000) {
      throw new Error('Invalid limit, maximum is 1000');
    }

    const orderBy = OrderBy(
      filter.orderBy, {
        sortFields: txSQL.sortFields,
        fieldPrefix(sortField) {
          if (['height'].indexOf(sortField) > -1) {
            return 'b_' + sortField;
          } else if (['confirmations'].indexOf(sortField) > -1) {
            return sortField;
          } else {
            return 't_' + sortField;
          }
        },
      }
    );

    if (orderBy.error) {
      throw new Error(orderBy.error);
    }

    const rows = await this.db.query(txSQL.countList({ where }), params)
      .catch((err) => {
        this.logger.error(err.stack);
        return Promise.reject(new Error('Transactions#list error'));
      });

    const count = rows.length ? rows[0].count : 0;

    const txRows = await this.db.query(
      txSQL.list({ where, sortField: orderBy.sortField, sortMethod: orderBy.sortMethod }),
      params
    ).catch((err) => {
      this.logger.error(err.stack);
      return Promise.reject(new Error('Transactions#list error'));
    });

    const transactions: Array<IConfirmedTransaction<any>> = txRows
      .map((rawTX) => this.transactionLogic.dbRead(rawTX));

    return { count, transactions };
  }

  /**
   * Get transaction by id
   */
  public async getByID<T = any>(id: string): Promise<IConfirmedTransaction<T>> {
    const rows = await this.db.query(txSQL.getById, { id });
    if (rows.length === 0) {
      throw new Error(`Transaction not found: ${id}`);
    }
    return this.transactionLogic.dbRead(rows[0]);
  }

  /**
   * Get the Added and Deleted votes by tx id.
   */
  private async getVotesById(id: string): Promise<{ added: string[], deleted: string[] }> {
    const rows = await this.db.query(txSQL.getVotesById, { id });
    if (rows.length === 0) {
      throw new Error(`Transaction not found: ${id}`);
    }
    const votes: string[] = rows[0].votes.split(',');
    const added           = votes.filter((vote) => vote.substring(0, 1) === '+');
    const deleted         = votes.filter((vote) => vote.substring(0, 1) === '-');

    return { added, deleted };
  }

}
