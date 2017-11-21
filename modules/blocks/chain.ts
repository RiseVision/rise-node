import { ILogger } from '../../logger';
import { IDatabase, ITask } from 'pg-promise';
import { IBus } from '../../types/bus';
import Sequence from '../../helpers/sequence';
import * as Inserts from '../../helpers/inserts.js';
import { BlockLogic, SignedBlockType } from '../../logic/block';
import { TransactionLogic } from '../../logic/transaction';
import { BlocksModuleUtils } from './utils';
import { AccountsModule } from '../accounts';
import { TransactionsModule } from '../transactions';
import { IConfirmedTransaction } from '../../logic/transactions/baseTransactionType';
import { catchToLoggerAndRemapError, promiseToCB } from '../../helpers/promiseUtils';
import { RoundsModule } from '../rounds';
import sql from '../../sql/blocks';

export type BlocksModuleChainLibrary = {
  logger: ILogger,
  db: IDatabase<any>,
  genesisblock: any,
  bus: IBus,
  balancesSequence: Sequence,
  logic: {
    block: BlockLogic,
    transaction: TransactionLogic
  }
};

export class BlocksModuleChain {
  private modules: { rounds: RoundsModule, transactions: TransactionsModule, accounts: AccountsModule, blocks: { utils: BlocksModuleUtils } }

  constructor(private library: BlocksModuleChainLibrary) {
    library.logger.trace('Blocks->Chain: Submodule initialized.');
  }

  /**
   * Deletes block from blocks table
   */
  public deleteBlock(blockId: string): Promise<void> {
    // Delete block with ID from blocks table
    // WARNING: DB_WRITE
    return this.library.db.none(sql.deleteBlock, {id: blockId})
      .catch(catchToLoggerAndRemapError('Blocks#deleteBlock error', this.library.logger));
  }

  /**
   * Save block with dransactionjs to database
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
      t.batch(promises);
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
   **
   * Build a sequence of transaction queries
   * FIXME: Processing here is not clean
   *
   * @param {pgPromise.ITask<any>} t
   * @param {SignedBlockType} b
   * @returns {pgPromise.ITask<any>}
   */
  private promiseTransactions(t: ITask<any>, b: SignedBlockType): ITask<any> {
    // TODO: Implement me.
    return t;
  }

  /**
   * Execute afterSave callback for txs of the saved block
   * @param {SignedBlockType} block
   * @returns {Promise<void>}
   */
  private async afterSave(block: SignedBlockType) {
    this.library.bus.message('transactionsSaved', block.transactions);
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
  private async popLastBlock(lb: SignedBlockType): Promise<SignedBlockType> {
    return this.library.balancesSequence.addAndPromise(async () => {
      const b = await this.modules.blocks.utils.loadBlocksPart({id: lb.previousBlock});
      if (b.length === 0) {
        throw new Error('previousBlock is null');
      }
      const [previousBlock] = b;

      const txs = lb.transactions.reverse();
      try {
        for (const tx of txs) {
          const sender = await this.modules.accounts.getAccount({publicKey: tx.senderPublicKey});
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