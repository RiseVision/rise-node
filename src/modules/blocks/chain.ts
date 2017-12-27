import { inject, injectable, tagged } from 'inversify';
import * as _ from 'lodash';
import { IDatabase, ITask } from 'pg-promise';
import { Bus, catchToLoggerAndRemapError, ILogger, Inserts, Sequence, TransactionType } from '../../helpers/';
import { IBlockLogic, ITransactionLogic } from '../../ioc/interfaces/logic';
import {
  IAccountsModule, IBlocksModule, IBlocksModuleChain, IBlocksModuleUtils, IRoundsModule,
  ITransactionsModule
} from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { SignedAndChainedBlockType, SignedBlockType } from '../../logic/';
import { IConfirmedTransaction } from '../../logic/transactions/';
import sql from '../../sql/blocks';

@injectable()
export class BlocksModuleChain implements IBlocksModuleChain {

  // Modules
  @inject(Symbols.modules.rounds)
  private roundsModule: IRoundsModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.blocksSubModules.utils)
  private blocksModuleUtils: IBlocksModuleUtils;

  // Generic
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;

  // Helpers
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.bus)
  private bus: Bus;
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence)
  private balancesSequence: Sequence;

  // LOGIC
  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  public cleanup() {
    return Promise.resolve();
  }

  /**
   * Deletes block from blocks table
   */
  public deleteBlock(blockId: string): Promise<void> {
    // Delete block with ID from blocks table
    // WARNING: DB_WRITE
    return this.db.none(sql.deleteBlock, { id: blockId })
      .catch(catchToLoggerAndRemapError<void>('Blocks#deleteBlock error', this.logger));
  }

  /**
   * Deletes last block and returns the "new" lastBlock (previous basically)
   * @returns {Promise<SignedBlockType>}
   */
  public async deleteLastBlock(): Promise<SignedAndChainedBlockType> {
    const lastBlock = this.blocksModule.lastBlock;
    this.logger.warn('Deleting last block', lastBlock);

    if (lastBlock.height === 1) {
      throw new Error('Cannot delete genesis block');
    }
    const newLastBlock            = await this.popLastBlock(lastBlock);
    // Set new "new" last block.
    this.blocksModule.lastBlock = newLastBlock;
    return newLastBlock;
  }

  /**
   * Deletes blocks after a certain block id.
   * @param {string} blockId
   * @returns {Promise<void>}
   */
  public async deleteAfterBlock(blockId: string): Promise<void> {
    return this.db.query(sql.deleteAfterBlock, { id: blockId })
      .catch(catchToLoggerAndRemapError('Blocks#deleteAfterBlock error', this.logger));
  }

  /**
   * Recover chain - wrapper for deleteLastBLock
   * @returns {Promise<void>}
   */
  public async recoverChain(): Promise<void> {
    try {
      const newLastBlock = await this.deleteLastBlock();
      this.logger.error('Recovery complete, new last block', newLastBlock.id);
    } catch (err) {
      this.logger.error('Recovery failed', err);
      throw err;
    }
  }

  /**
   * Checks for genesis in db and eventually calls #saveBlock
   * @returns {Promise<any>}
   */
  public async saveGenesisBlock() {
    const rows    = await this.db.query(sql.getBlockId, { id: this.genesisBlock.id })
      .catch(catchToLoggerAndRemapError('Blocks#saveGenesisBlock error', this.logger));
    const blockId = rows.length && rows[0].id;
    if (!blockId) {
      return this.saveBlock(this.genesisBlock);
    }
  }

  /**
   * Apply genesis block transaction to blockchain
   * @param {SignedBlockType} block
   * @returns {Promise<void>}
   */
  public async applyGenesisBlock(block: SignedAndChainedBlockType) {
    // This is a shitty sort. Does not take into account b and it's not ok
    block.transactions.sort((a) => a.type === TransactionType.VOTE ? 1 : 0);

    const tracker = this.blocksModuleUtils.getBlockProgressLogger(
      block.transactions.length,
      block.transactions.length / 100,
      'Genesis block loading'
    );

    try {
      for (const tx of block.transactions) {
        // Apply transactions through setAccountAndGet, bypassing unconfirmed/confirmed states
        // FIXME: Poor performance - every transaction cause SQL query to be executed
        // WARNING: DB_WRITE
        const sender = await this.accountsModule.setAccountAndGet({ publicKey: tx.senderPublicKey });

        // Apply tx.
        await this.transactionsModule.applyUnconfirmed(tx, sender);
        await this.transactionsModule.apply(tx, block, sender);

        tracker.applyNext();
      }
    } catch (err) {
      // Genesis is not valid?
      this.logger.error(err);
      process.exit(0);
    }
    this.blocksModule.lastBlock = block;
    await this.roundsModule.tick(block);
  }

  public async applyBlock(block: SignedAndChainedBlockType, broadcast: boolean, saveBlock: boolean) {
    // Prevent shutdown during database writes.
    this.blocksModule.isActive = true;

    // Transactions to rewind in case of error.
    const appliedTransactions: { [k: string]: IConfirmedTransaction<any> } = {};

    // List of unconfirmed transactions ids.
    // Rewind any unconfirmed transactions before applying block.
    // TODO: It should be possible to remove this call if we can guarantee that only
    // TODO: this function is processing transactions atomically. Then speed should be improved further.
    // TODO: Other possibility, when we rebuild from block chain this action should be moved out of the rebuild fn.
    const unconfirmedTransactionIds = await this.transactionsModule.undoUnconfirmedList()
      .catch((err) => {
        // Fatal error, memory tables will be inconsistent
        this.logger.error('Failed to undo unconfirmed list', err);
        return process.exit(0);
      });

    // Apply transaction to unconfirmed mem_accounts field
    try {
      for (const transaction of block.transactions) {
        const sender = await this.accountsModule.setAccountAndGet({ publicKey: transaction.senderPublicKey });
        await this.transactionsModule.applyUnconfirmed(transaction, sender)
          .catch((err) => {
            this.logger.error(`Failed to apply transaction ${transaction.id} - ${err.message || err}`);
            this.logger.error(err);
            this.logger.error('Transaction', transaction);
            return Promise.reject(err);
          });
        appliedTransactions[transaction.id] = transaction;

        // Remove the transaction from the node queue, if it was present.
        const idx = unconfirmedTransactionIds.indexOf(transaction.id);
        if (idx !== -1) {
          unconfirmedTransactionIds.splice(idx, 1);
        }
      }
    } catch (err) {
      // If an error has occurred we need to rewind appliedTxs.
      // so that we can get back to the previous state as if nothing happend.
      const appliedIds = Object.keys(appliedTransactions);
      for (const txID of appliedIds) {
        const transaction = appliedTransactions[txID];
        const sender      = await this.accountsModule.setAccountAndGet({ publicKey: transaction.senderPublicKey });

        await this.transactionLogic.undoUnconfirmed(transaction, sender);
      }
      throw err;
    }

    // Block and transactions are ok.
    // Apply transactions to confirmed mem_accounts fields.
    for (const tx of block.transactions) {
      try {
        const sender = await this.accountsModule.getAccount({ publicKey: tx.senderPublicKey });
        await this.transactionsModule.apply(tx, block, sender);

      } catch (err) {
        // Fatal error, memory tables will be inconsistent
        this.logger.error(`Failed to apply transaction: ${tx.id}`, err);
        this.logger.error('Transaction', tx);
        return process.exit(0);
      }

      // Transaction applied, removed from the unconfirmed list.
      this.transactionsModule.removeUnconfirmedTransaction(tx.id);
    }

    this.blocksModule.lastBlock = block;
    if (saveBlock) {
      try {
        await this.saveBlock(block);
      } catch (err) {
        this.logger.error('Failed to save block...');
        this.logger.error('Block', block);
        return process.exit(0);
      }
      this.logger.debug('Block applied correctly with ' + block.transactions.length + ' transactions');
    }

    await this.bus.message('newBlock', block, broadcast);

    await this.roundsModule.tick(block);

    // restore the (yet) unconfirmed ids.
    await this.transactionsModule.applyUnconfirmedIds(unconfirmedTransactionIds);

    // Shutdown now can happen
    this.blocksModule.isActive = false;
    // Nullify large objects.
    // Prevents memory leak during synchronisation.
    // appliedTransactions = unconfirmedTransactionIds = block = null;
    block = null;
    // Finish here if snapshotting.
    // FIXME: Not the best place to do that
    // if (err === 'Snapshot finished') {
    //   logger.info(err);
    //   process.emit('SIGTERM');
    // }
  }

  /**
   * Save block with transactions to database
   * @param {SignedBlockType} b
   * @returns {Promise<void>}
   */
  public async saveBlock(b: SignedBlockType) {
    // Prepare and execute SQL transaction
    // WARNING: DB_WRITE
    await this.db.tx((t) => {
      // Create bytea fields (buffers), and returns pseudo-row object promise-like
      const promise = this.blockLogic.dbSave(b);
      // Initialize insert helper
      const inserts = new Inserts(promise, promise.values);

      const promises = [
        // Prepare insert SQL query
        t.none(inserts.template(), promise.values),
      ];

      // Apply transactions inserts
      t = this.promiseTransactions(t, b);
      // Exec inserts as batch
      return t.batch(promises);
    });

    await this.afterSave(b)
      .catch(
        catchToLoggerAndRemapError(
          'Blocks#saveBlock error',
          this.logger
        )
      );
  }

  /**
   * Build a sequence of transaction queries
   * FIXME: Processing here is not clean
   *
   * @returns {pgPromise.ITask<any>}
   */
  private promiseTransactions(t: ITask<any>, block: SignedBlockType): ITask<any> {
    if (_.isEmpty(block.transactions)) {
      // nothing to do if no txs.
      return t;
    }

    const savePromises = block.transactions
      .map((tx) => {
        // tslint:disable-next-line
        tx['blockId'] = block.id; // apply block id;
        return tx;
      })
      .map((tx) => this.transactionLogic.dbSave(tx as any))
      .reduce((a, b) => a.concat(b), []);

    // Group the saving things by table to batch sqls.
    const byTable = _.groupBy(savePromises, (p) => p.table);

    // Now cycle through tables and batch values together.
    Object.keys(byTable).forEach((table) => {
      const values    = byTable[table].map((p) => p.values).reduce((a, b) => a.concat(b), []);
      const newInsert = new Inserts(byTable[table][0], values, true);
      t.none(newInsert.template(), newInsert);
    });

    return t;
  }

  /**
   * Execute afterSave callback for txs of the saved block
   * @param {SignedBlockType} block
   * @returns {Promise<void>}
   */
  private async afterSave(block: SignedBlockType) {
    await this.bus.message('transactionsSaved', block.transactions);
    // Execute afterSave callbacks for each transaction, depends on tx type
    // see: logic.outTransfer.afterSave, logic.dapp.afterSave
    for (const tx of  block.transactions) {
      await this.transactionLogic.afterSave(tx);
    }
  }

  /**
   * Deletes the last block (passed), undo txs and backwardTick round
   * @param {SignedBlockType} lb
   * @returns {Promise<SignedBlockType>}
   */
  private async popLastBlock(lb: SignedBlockType): Promise<SignedAndChainedBlockType> {
    return this.balancesSequence.addAndPromise(async () => {
      const b = await this.blocksModuleUtils.loadBlocksPart({ id: lb.previousBlock });
      if (b.length === 0) {
        throw new Error('previousBlock is null');
      }
      const [previousBlock] = b;

      const txs = lb.transactions.reverse();
      try {
        for (const tx of txs) {
          const sender = await this.accountsModule.getAccount({ publicKey: tx.senderPublicKey });
          // Undoing confirmed tx - refresh confirmed balance (see: logic.transaction.undo, logic.transfer.undo)
          // WARNING: DB_WRITE
          await this.transactionsModule.undo(tx as IConfirmedTransaction<any>, lb, sender);

          // Undoing unconfirmed tx - refresh unconfirmed balance (see: logic.transaction.undoUnconfirmed)
          // WARNING: DB_WRITE
          await this.transactionsModule.undoUnconfirmed(tx);
        }
      } catch (err) {
        this.logger.error('Failed to undo transactions', err);
        process.exit(0);
      }

      await this.roundsModule.backwardTick(lb, previousBlock)
        .catch((err) => {
          // Fatal error, memory tables will be inconsistent
          this.logger.error('Failed to perform backwards tick', err);

          return process.exit(0);
        });

      await this.deleteBlock(lb.id)
        .catch((err) => {
          // Fatal error, memory tables will be inconsistent
          this.logger.error('Failed to delete block', err);
          return process.exit(0);
        });

      return previousBlock;
    });
  }
}
