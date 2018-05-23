import { inject, injectable, tagged } from 'inversify';
import { Transaction, Op } from 'sequelize';
import { Bus, catchToLoggerAndRemapError, DBHelper, ILogger, Sequence, TransactionType, wait } from '../../helpers/';
import { WrapInBalanceSequence } from '../../helpers/decorators/wrapInSequence';
import { IBlockLogic, ITransactionLogic } from '../../ioc/interfaces/logic';
import {
  IAccountsModule,
  IBlocksModule,
  IBlocksModuleChain,
  IBlocksModuleUtils,
  IRoundsModule,
  ITransactionsModule
} from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { SignedAndChainedBlockType, SignedBlockType } from '../../logic/';
import { IBaseTransaction, IConfirmedTransaction } from '../../logic/transactions/';
import { AccountsModel, BlocksModel, TransactionsModel } from '../../models/';

@injectable()
export class BlocksModuleChain implements IBlocksModuleChain {

  // Generic
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;

  // Helpers
  @inject(Symbols.helpers.bus)
  private bus: Bus;
  @inject(Symbols.helpers.db)
  private dbHelper: DBHelper;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence)
  public balancesSequence: Sequence;

  // LOGIC
  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  // Modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.blocksSubModules.utils)
  private blocksModuleUtils: IBlocksModuleUtils;
  @inject(Symbols.modules.rounds)
  private roundsModule: IRoundsModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;

  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;
  @inject(Symbols.models.blocks)
  private BlocksModel: typeof BlocksModel;
  @inject(Symbols.models.transactions)
  private TransactionsModel: typeof TransactionsModel;
  /**
   * Lock for processing.
   * @type {boolean}
   */
  private isCleaning: boolean = false;

  private isProcessing: boolean = false;

  public async cleanup() {
    this.isCleaning = true;
    while (this.isProcessing) {
      this.logger.info('Waiting for block processing to finish');
      await wait(1000);
    }
  }

  /**
   * Deletes last block and returns the "new" lastBlock (previous basically)
   * @returns {Promise<SignedBlockType>}
   */
  public async deleteLastBlock(): Promise<BlocksModel> {
    const lastBlock = this.blocksModule.lastBlock;
    this.logger.warn('Deleting last block', lastBlock);

    if (lastBlock.height === 1) {
      throw new Error('Cannot delete genesis block');
    }
    const newLastBlock          = await this.popLastBlock(lastBlock);
    // Set new "new" last block.
    this.blocksModule.lastBlock = newLastBlock;
    return newLastBlock;
  }

  public async deleteAfterBlock(height: number): Promise<void> {
    await this.BlocksModel.destroy({where: {[Op.gte]: height}});
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
    const genesis = await this.BlocksModel.findById(this.genesisBlock.id);
    if (!genesis) {
      return this.BlocksModel.sequelize.transaction((t) => this.saveBlock(this.genesisBlock, t));
    }
  }

  /**
   * Apply genesis block transaction to blockchain
   * @param {BlocksModel} block
   * @returns {Promise<void>}
   */
  public async applyGenesisBlock(block: SignedAndChainedBlockType) {
    // Order vote transactions to be at the end of processing.
    block.transactions.sort((a, b) => {
      if (a.type !== b.type) {
        if (a.type === TransactionType.VOTE) {
          return 1;
        } else if (b.type === TransactionType.VOTE) {
          return -1;
        }
      }
      return 0;
    });

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
        const sender = await this.accountsModule
          .setAccountAndGet({publicKey: tx.senderPublicKey});

        // Apply tx.
        await this.transactionsModule.applyUnconfirmed({...tx, blockId: block.id}, sender);
        await this.transactionsModule.apply({...tx, blockId: block.id}, block, sender);

        tracker.applyNext();
      }
    } catch (err) {
      // Genesis is not valid?
      this.logger.error(err);
      process.exit(0);
    }
    this.blocksModule.lastBlock = this.BlocksModel.classFromPOJO(block);
    await this.BlocksModel.sequelize.transaction((t) => this.roundsModule.tick(this.blocksModule.lastBlock, t));
  }

  public async applyBlock(block: SignedAndChainedBlockType, broadcast: boolean, saveBlock: boolean) {
    if (this.isCleaning) {
      return; // Avoid processing a new block if it is cleaning.
    }
    // Prevent shutdown during database writes.
    this.isProcessing = true;

    // List of unconfirmed transactions ids.
    // Rewind any unconfirmed transactions before applying block.
    const unconfirmedTransactionIds = await this.transactionsModule.undoUnconfirmedList()
      .catch((err) => {
        // Fatal error, memory tables will be inconsistent
        this.logger.error('Failed to undo unconfirmed list', err);
        return process.exit(0);
      });

    // Start atomic block saving.
    await this.BlocksModel.sequelize.transaction(async (dbTX) => {
      // Apply transaction to unconfirmed mem_accounts field
      // Divide transactions by senderAccounts.
      const txsBySender: { [address: string]: Array<IBaseTransaction<any>> } = {};
      block.transactions.forEach((tx) => {
        txsBySender[tx.senderId] = txsBySender[tx.senderId] || [];
        txsBySender[tx.senderId].push(tx);
      });

      // Apply Unconfirmed parallelly grouped by sender.
      await Promise.all(Object.keys(txsBySender).map(async (address) => {
        const txs  = txsBySender[address];
        let sender = null;
        for (const transaction of txs) {
          sender = sender ?
            await this.accountsModule
              .getAccount({ address: transaction.senderId }, this.AccountsModel.fieldsFor(transaction, false)) :
            await this.accountsModule
              .setAccountAndGet({ publicKey: transaction.senderPublicKey });
          await this.transactionsModule.applyUnconfirmed(transaction, sender)
            .catch((err) => {
              this.logger.error(`Failed to applyUnconfirmed transaction ${transaction.id} - ${err.message || err}`);
              this.logger.error(err);
              this.logger.error('Transaction', transaction);
              throw err;
            });

          // Remove the transaction from the node queue, if it was present.
          const idx = unconfirmedTransactionIds.indexOf(transaction.id);
          if (idx !== -1) {
            unconfirmedTransactionIds.splice(idx, 1);
          }
        }
      }));

      // Apply confirmed parallelly
      await Promise.all(Object.keys(txsBySender).map(async (address) => {
        const txs  = txsBySender[address];
        for (const transaction of txs) {
          const sender = await this.accountsModule.getAccount(
            { address: transaction.senderId },
            this.AccountsModel.fieldsFor(transaction, true)
          );
          await this.transactionsModule.apply(transaction, block, sender)
            .catch((err) => {
              this.logger.error(`Failed to apply transaction: ${transaction.id}`, err);
              this.logger.error('Transaction', transaction);
              throw err;
            });

          // Transaction applied, removed from the unconfirmed list.
          this.transactionsModule.removeUnconfirmedTransaction(transaction.id);
        }
      }));

      this.blocksModule.lastBlock = this.BlocksModel.classFromPOJO(block);
      if (saveBlock) {
        try {
          await this.saveBlock(block, dbTX);
        } catch (err) {
          this.logger.error('Failed to save block...');
          this.logger.error('Block', block);
          throw err;
        }
        this.logger.debug('Block applied correctly with ' + block.transactions.length + ' transactions');
      }

      await this.bus.message('newBlock', block, broadcast);

      await this.roundsModule.tick(block, dbTX);
    }).catch((err) => {
      // Allow cleanup as processing finished even if rollback.
      this.isProcessing = false;
      throw err;
    });

    // restore the (yet) unconfirmed ids.
    await this.transactionsModule.applyUnconfirmedIds(unconfirmedTransactionIds);

    block = null;

    this.isProcessing = false;
  }

  /**
   * Save block with transactions to database
   * @param {SignedBlockType} b
   * @param {Transaction} dbTX Database transaction Object
   * @returns {Promise<void>}
   */
  public async saveBlock(b: SignedBlockType, dbTX: Transaction) {
    const saveOp = this.blockLogic.dbSave(b);
    const txOps  = b.transactions
      .map((t: IConfirmedTransaction<any>) => this.transactionLogic.dbSave({
        ...t,
        blockId: b.id,
        height : b.height,
      }))
      .reduce((o1, o2) => o1.concat(o2), []);

    await this.dbHelper.performOps([saveOp, ...txOps], dbTX);

    await this.afterSave(b)
      .catch(
        catchToLoggerAndRemapError(
          'Blocks#saveBlock error',
          this.logger
        )
      );
  }

  /**
   * Execute afterSave callback for txs of the saved block
   * @param {SignedBlockType} block
   * @returns {Promise<void>}
   */
  private async afterSave(block: SignedBlockType) {
    await this.bus.message('transactionsSaved', block.transactions);
    // Execute afterSave callbacks for each transaction, depends on tx type
    for (const tx of  block.transactions) {
      await this.transactionLogic.afterSave(tx);
    }
  }

  /**
   * Deletes the last block (passed), undo txs and backwardTick round
   * @param {SignedBlockType} lb
   * @returns {Promise<SignedBlockType>}
   */
  @WrapInBalanceSequence
  private async popLastBlock(lb: BlocksModel): Promise<BlocksModel> {
    const previousBlock = await this.BlocksModel.findById(lb.previousBlock, {include: [this.TransactionsModel]});

    if (previousBlock === null) {
      throw new Error('previousBlock is null');
    }
    const txs = lb.transactions.slice().reverse();

    await this.BlocksModel.sequelize.transaction(async (dbTX) => {
      for (const tx of txs) {
        const sender = await this.AccountsModel.scope('fullConfirmed').find({where: {publicKey: tx.senderPublicKey}});
        await this.transactionsModule.undo(tx, lb, sender);
        await this.transactionsModule.undoUnconfirmed(tx);
      }
      await this.roundsModule.backwardTick(lb, previousBlock, dbTX);
      await lb.destroy({transaction: dbTX});
    });

    return previousBlock;

  }
}
