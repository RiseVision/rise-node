import * as _ from 'lodash';
import { IDatabase, ITask } from 'pg-promise';
import sql from '../../../sql/blocks';
import { Bus, catchToLoggerAndRemapError, ILogger, Inserts, Sequence, TransactionType } from '../../helpers/';
import { BlockLogic, SignedAndChainedBlockType, SignedBlockType, TransactionLogic } from '../../logic/';
import { IConfirmedTransaction } from '../../logic/transactions/';
import { AccountsModule } from '../accounts';
import { BlocksModule } from '../blocks';
import { RoundsModule } from '../rounds';
import { TransactionsModule } from '../transactions';

// tslint:disable-next-line interface-over-type-literal
export type BlocksModuleChainLibrary = {
  logger: ILogger,
  db: IDatabase<any>,
  genesisblock: SignedAndChainedBlockType,
  bus: Bus,
  balancesSequence: Sequence,
  logic: {
    block: BlockLogic,
    transaction: TransactionLogic
  }
};

export class BlocksModuleChain {
  private modules: {
    rounds: RoundsModule,
    transactions: TransactionsModule,
    accounts: AccountsModule,
    blocks: BlocksModule
  };

  constructor(private library: BlocksModuleChainLibrary) {
    library.logger.trace('Blocks->Chain: Submodule initialized.');
  }

  public onBind(scope) {
    this.library.logger.trace('Blocks->Chain: Shared modules bind.');
    this.modules = {
      accounts    : scope.accounts,
      blocks      : scope.blocks,
      rounds      : scope.rounds,
      transactions: scope.transactions,
    };
  }

  /**
   * Deletes block from blocks table
   */
  public deleteBlock(blockId: string): Promise<void> {
    // Delete block with ID from blocks table
    // WARNING: DB_WRITE
    return this.library.db.none(sql.deleteBlock, { id: blockId })
      .catch(catchToLoggerAndRemapError<void>('Blocks#deleteBlock error', this.library.logger));
  }

  /**
   * Deletes last block and returns the "new" lastBlock (previous basically)
   * @returns {Promise<SignedBlockType>}
   */
  public async deleteLastBlock(): Promise<SignedBlockType> {
    const lastBlock = this.modules.blocks.lastBlock;
    this.library.logger.warn('Deleting last block', lastBlock);

    if (lastBlock.height === 1) {
      throw new Error('Cannot delete genesis block');
    }
    const newLastBlock            = await this.popLastBlock(lastBlock);
    // Set new "new" last block.
    this.modules.blocks.lastBlock = newLastBlock;
    return newLastBlock;
  }

  /**
   * Deletes blocks after a certain block id.
   * @param {string} blockId
   * @returns {Promise<void>}
   */
  public async deleteAfterBlock(blockId: string): Promise<void> {
    return this.library.db.query(sql.deleteAfterBlock, { id: blockId })
      .catch(catchToLoggerAndRemapError('Blocks#deleteAfterBlock error', this.library.logger));
  }

  /**
   * Recover chain - wrapper for deleteLastBLock
   * @returns {Promise<void>}
   */
  public async recoverChain(): Promise<void> {
    try {
      const newLastBlock = await this.deleteLastBlock();
      this.library.logger.error('Recovery complete, new last block', newLastBlock.id);
    } catch (err) {
      this.library.logger.error('Recovery failed', err);
      throw err;
    }
  }

  /**
   * Checks for genesis in db and eventually calls #saveBlock
   * @returns {Promise<any>}
   */
  public async saveGenesisBlock() {
    const rows    = await this.library.db.query(sql.getBlockId, { id: this.library.genesisblock.id })
      .catch(catchToLoggerAndRemapError('Blocks#saveGenesisBlock error', this.library.logger));
    const blockId = rows.length && rows[0].id;
    if (!blockId) {
      return this.saveBlock(this.library.genesisblock);
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

    const tracker = this.modules.blocks.utils.getBlockProgressLogger(
      block.transactions.length,
      block.transactions.length / 100,
      'Genesis block loading'
    );

    try {
      for (const tx of block.transactions) {
        // Apply transactions through setAccountAndGet, bypassing unconfirmed/confirmed states
        // FIXME: Poor performance - every transaction cause SQL query to be executed
        // WARNING: DB_WRITE
        const sender = await this.modules.accounts.setAccountAndGet({ publicKey: tx.senderPublicKey });

        // Apply tx.
        await this.modules.transactions.applyUnconfirmed(tx, sender);
        await this.modules.transactions.apply(tx, block, sender);

        tracker.applyNext();
      }
    } catch (err) {
      // Genesis is not valid?
      this.library.logger.error(err);
      process.exit(0);
    }
    this.modules.blocks.lastBlock = block;
    await this.modules.rounds.tick(block);
  }

  public async applyBlock(block: SignedAndChainedBlockType, broadcast: boolean, saveBlock: boolean) {
    // Prevent shutdown during database writes.
    this.modules.blocks.isActive = true;

    // Transactions to rewind in case of error.
    const appliedTransactions: { [k: string]: IConfirmedTransaction<any> } = {};

    // List of unconfirmed transactions ids.
    // Rewind any unconfirmed transactions before applying block.
    // TODO: It should be possible to remove this call if we can guarantee that only
    // TODO: this function is processing transactions atomically. Then speed should be improved further.
    // TODO: Other possibility, when we rebuild from block chain this action should be moved out of the rebuild fn.
    const unconfirmedTransactionIds = await this.modules.transactions.undoUnconfirmedList()
      .catch((err) => {
        // Fatal error, memory tables will be inconsistent
        this.library.logger.error('Failed to undo unconfirmed list', err);
        return process.exit(0);
      });

    // Apply transaction to unconfirmed mem_accounts field
    try {
      for (const transaction of block.transactions) {
        const sender = await this.modules.accounts.setAccountAndGet({ publicKey: transaction.senderPublicKey });
        await this.modules.transactions.applyUnconfirmed(transaction, sender)
          .catch((err) => {
            this.library.logger.error(`Failed to apply transaction ${transaction.id} - ${err.message || err}`);
            this.library.logger.error(err);
            this.library.logger.error('Transaction', transaction);
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
        const sender      = await this.modules.accounts.setAccountAndGet({ publicKey: transaction.senderPublicKey });

        await this.library.logic.transaction.undoUnconfirmed(transaction, sender);
      }
    }

    // Block and transactions are ok.
    // Apply transactions to confirmed mem_accounts fields.
    for (const tx of block.transactions) {
      try {
        const sender = await this.modules.accounts.getAccount({ publicKey: tx.senderPublicKey });
        await this.modules.transactions.apply(tx, block, sender);

      } catch (err) {
        // Fatal error, memory tables will be inconsistent
        this.library.logger.error(`Failed to apply transaction: ${tx.id}`, err);
        this.library.logger.error('Transaction', tx);
        return process.exit(0);
      }

      // Transaction applied, removed from the unconfirmed list.
      this.modules.transactions.removeUnconfirmedTransaction(tx.id);
    }

    this.modules.blocks.lastBlock = block;
    if (saveBlock) {
      try {
        await this.saveBlock(block);
      } catch (err) {
        this.library.logger.error('Failed to save block...');
        this.library.logger.error('Block', block);
        return process.exit(0);
      }
      this.library.logger.debug('Block applied correctly with ' + block.transactions.length + ' transactions');
    }

    await this.library.bus.message('newBlock', block, broadcast);

    await this.modules.rounds.tick(block);

    // restore the (yet) unconfirmed ids.
    await this.modules.transactions.applyUnconfirmedIds(unconfirmedTransactionIds);

    // Shutdown now can happen
    this.modules.blocks.isActive = false;
    // Nullify large objects.
    // Prevents memory leak during synchronisation.
    // appliedTransactions = unconfirmedTransactionIds = block = null;
    block = null;
    // Finish here if snapshotting.
    // FIXME: Not the best place to do that
    // if (err === 'Snapshot finished') {
    //   library.logger.info(err);
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
    await this.library.db.tx((t) => {
      // Create bytea fields (buffers), and returns pseudo-row object promise-like
      const promise = this.library.logic.block.dbSave(b);
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
          this.library.logger
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
      .map((tx) => this.library.logic.transaction.dbSave(tx as any))
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
    await this.library.bus.message('transactionsSaved', block.transactions);
    // Execute afterSave callbacks for each transaction, depends on tx type
    // see: logic.outTransfer.afterSave, logic.dapp.afterSave
    for (const tx of  block.transactions) {
      await this.library.logic.transaction.afterSave(tx);
    }
  }

  /**
   * Deletes the last block (passed), undo txs and backwardTick round
   * @param {SignedBlockType} lb
   * @returns {Promise<SignedBlockType>}
   */
  private async popLastBlock(lb: SignedBlockType): Promise<SignedAndChainedBlockType> {
    return this.library.balancesSequence.addAndPromise(async () => {
      const b = await this.modules.blocks.utils.loadBlocksPart({ id: lb.previousBlock });
      if (b.length === 0) {
        throw new Error('previousBlock is null');
      }
      const [previousBlock] = b;

      const txs = lb.transactions.reverse();
      try {
        for (const tx of txs) {
          const sender = await this.modules.accounts.getAccount({ publicKey: tx.senderPublicKey });
          // Undoing confirmed tx - refresh confirmed balance (see: logic.transaction.undo, logic.transfer.undo)
          // WARNING: DB_WRITE
          await this.modules.transactions.undo(tx as IConfirmedTransaction<any>, lb, sender);

          // Undoing unconfirmed tx - refresh unconfirmed balance (see: logic.transaction.undoUnconfirmed)
          // WARNING: DB_WRITE
          await this.modules.transactions.undoUnconfirmed(tx);
        }
      } catch (err) {
        this.library.logger.error('Failed to undo transactions', err);
        process.exit(0);
      }

      await this.modules.rounds.backwardTick(lb, previousBlock)
        .catch((err) => {
          // Fatal error, memory tables will be inconsistent
          this.library.logger.error('Failed to perform backwards tick', err);

          return process.exit(0);
        });

      await this.deleteBlock(lb.id)
        .catch((err) => {
          // Fatal error, memory tables will be inconsistent
          this.library.logger.error('Failed to delete block', err);
          return process.exit(0);
        });

      return previousBlock;
    });
  }
}
