import bs = require('binary-search');
import { inject, injectable, tagged } from 'inversify';
import { Op, Transaction } from 'sequelize';
import * as _ from 'lodash';
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
import { AccountsModel, BlocksModel, TransactionsModel } from '../../models/';
import { DBOp } from '../../types/genericTypes';

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
    this.logger.warn('Deleting last block', { id: lastBlock.id, height: lastBlock.height });

    if (lastBlock.height === 1) {
      throw new Error('Cannot delete genesis block');
    }
    const newLastBlock          = await this.popLastBlock(lastBlock);
    // Set new "new" last block.
    this.blocksModule.lastBlock = newLastBlock;
    return newLastBlock;
  }

  public async deleteAfterBlock(height: number): Promise<void> {
    await this.BlocksModel.destroy({ where: { [Op.gte]: height } });
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
        const sender = await this.accountsModule
          .setAccountAndGet({ publicKey: tx.senderPublicKey });
        // Apply tx.
        const ops: Array<DBOp<any>> = [
          {
            model: this.AccountsModel,
            query: this.AccountsModel.createBulkAccountsSQL([tx.recipientId]),
            type: 'custom',
          },
          ... await this.transactionLogic.applyUnconfirmed({... tx, blockId: block.id} as any, sender),
          ... await this.transactionLogic.apply({... tx, blockId: block.id} as any, block, sender),
        ];
        await this.dbHelper.performOps(ops);

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

  @WrapInBalanceSequence
  public async applyBlock(block: SignedAndChainedBlockType,
                          broadcast: boolean,
                          saveBlock: boolean,
                          accountsMap: { [address: string]: AccountsModel }) {
    if (this.isCleaning) {
      return; // Avoid processing a new block if it is cleaning.
    }
    // Prevent shutdown during database writes.
    this.isProcessing = true;

    // Find all transactions that are in unconfirmedstate && that are overlapping
    // Overlapping txs are txs that have same sender of at least one of the tx
    // in the block but are NOT in the block.
    // Overlapping txs needs to be undoUnconfirmed since they could eventually exclude a tx
    // bundled within a block
    const allUnconfirmedTxs = this.transactionsModule.getUnconfirmedTransactionList(false);
    const allBlockTXIds = block.transactions.map((tx) => tx.id).sort();
    const overlappingTXs = allUnconfirmedTxs.filter((tx) => {
      const exists = bs(allBlockTXIds, tx.id, (a, b) => a.localeCompare(b)) >= 0;
      return !exists && typeof(accountsMap[tx.senderId]) !== 'undefined';
    });
    // Start atomic block saving.
    await this.BlocksModel.sequelize.transaction(async (dbTX) => {
      const ops: Array<DBOp<any>> = [];

      const recipients = _.sortedUniq(block.transactions
        .map((tx) => tx.recipientId)
        .filter((recipient) => recipient)
        .sort()
      );

      // undo all overlapping txs.
      for (const overTX of overlappingTXs) {
        ops.push(... await this.transactionLogic.undoUnconfirmed(overTX, accountsMap[overTX.senderId]));
      }

      ops.push({
        type: 'custom',
        query: await this.AccountsModel.createBulkAccountsSQL(recipients),
        model: this.AccountsModel,
      });

      for (const tx of block.transactions) {
        if (this.transactionsModule.transactionUnconfirmed(tx.id)) {
          continue;
        }
        ops.push(
          ... await this.transactionLogic.applyUnconfirmed(
            tx,
            accountsMap[tx.senderId],
            tx.requesterPublicKey
              ? accountsMap[this.accountsModule.generateAddressByPublicKey(tx.requesterPublicKey)]
              : undefined
          )
        );
      }

      // Apply
      for (const tx of block.transactions) {
        ops.push(
          ... await this.transactionLogic.apply(tx as any, block, accountsMap[tx.senderId])
        );
        this.transactionsModule.removeUnconfirmedTransaction(tx.id);
      }

      await this.dbHelper.performOps(ops, dbTX);
      if (saveBlock) {
        try {
          await this.saveBlock(block, dbTX);
        } catch (err) {
          this.logger.error('Failed to save block...');
          this.logger.error('Block', block.id);
          throw err;
        }
        this.logger.debug('Block applied correctly with ' + block.transactions.length + ' transactions');
      }

      await this.roundsModule.tick(block, dbTX);

      this.blocksModule.lastBlock = this.BlocksModel.classFromPOJO(block);

      await this.bus.message('newBlock', block, broadcast);
    }).catch((err) => {
      // Allow cleanup as processing finished even if rollback.
      this.isProcessing = false;
      throw err;
    });

    // remove overlapping txs from unconfirmed and move it to queued to allow re-process
    // If some of the overlapping txs are now "invalid" they will be discared within the next
    // txPool.processBundled loop.
    for (const overTX of overlappingTXs) {
      this.transactionsModule.removeUnconfirmedTransaction(overTX.id);
      await this.transactionsModule.processUnconfirmedTransaction(overTX, false);
    }

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
    const txOps = this.transactionLogic.dbSave(b.transactions, b.id, b.height);

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
    const previousBlock = await this.BlocksModel.findById(lb.previousBlock, { include: [this.TransactionsModel] });

    if (previousBlock === null) {
      throw new Error('previousBlock is null');
    }
    await this.transactionLogic.attachAssets(previousBlock.transactions);

    const txs = lb.transactions.slice().reverse();

    await this.BlocksModel.sequelize.transaction(async (dbTX) => {
      const accountsMap = await this.accountsModule.resolveAccountsForTransactions(txs);
      const ops: Array<DBOp<any>> = [];
      for (const tx of txs) {
        ops.push(... await this.transactionLogic.undo(tx, lb, accountsMap[tx.senderId]));
        ops.push(... await this.transactionLogic.undoUnconfirmed(tx, accountsMap[tx.senderId]));
      }
      await this.dbHelper.performOps(ops, dbTX);
      await this.roundsModule.backwardTick(lb, previousBlock, dbTX);
      await lb.destroy({ transaction: dbTX });
    });

    return previousBlock;

  }
}
