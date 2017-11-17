import { ILogger } from '../../logger';
import { BlockLogic, SignedBlockType } from '../../logic/block';
import { TransactionLogic } from '../../logic/transaction';
import { IDatabase } from 'pg-promise';
import Sequence from '../../helpers/sequence';
import sql from '../../sql/blocks';

export type BlocksModuleUtilsLibrary = {
  logger: ILogger,
  logic: {
    block: BlockLogic,
    transaction: TransactionLogic,
  },
  db: IDatabase<any>,
  dbSequence: Sequence,
  genesisblock: any
};

export class BlocksModuleUtils {
  public constructor(public library: BlocksModuleUtilsLibrary) {
    this.library.logger.trace('Blocks->Utils: Submodule initialized');
  }

  public readDbRows(rows: any[]): SignedBlockType[] {
    const blocks = {};
    const order  = [];
    // a block is defined in multiple_rows
    // due to the view full_block_list which performs a left outer join
    // over transactions list.
    for (let i = 0, length = rows.length; i < length; i++) {
      // Normalize block
      // FIXME: Can have poor performance because it performs SHA256 hash calculation for each block
      const block = this.library.logic.block.dbRead(rows[i]);

      if (block) {
        // If block is not already in the list...
        if (!blocks[block.id]) {
          if (block.id === this.library.genesisblock.block.id) {
            // Generate fake signature for genesis block
            // tslint:disable-next-line
            block['generationSignature'] = (new Array(65)).join('0');
          }

          // Add block ID to order list
          order.push(block.id);
          // Add block to list
          blocks[block.id] = block;
        }

        // Normalize transaction
        const transaction             = this.library.logic.transaction.dbRead(rows[i]);
        // Set empty object if there are no transactions in block
        blocks[block.id].transactions = blocks[block.id].transactions || {};

        if (transaction) {
          // Add transaction to block if not there already
          if (!blocks[block.id].transactions[transaction.id]) {
            blocks[block.id].transactions[transaction.id] = transaction;
          }
        }
      }
    }

    // Reorganize list
    return order.map((v) => {
      blocks[v].transactions = Object.keys(blocks[v].transactions).map((t) => blocks[v].transactions[t]);
      return blocks[v];
    });
  }

  /**
   * Loads full blocks from database and normalize them
   *
   */
  public loadBlocksPart(filter, cb) {
    self.loadBlocksData(filter, function (err, rows) {
      var blocks = [];

      if (!err) {
        // Normalize list of blocks
        blocks = this.readDbRows(rows);
      }

      return setImmediate(cb, err, blocks);
    });
  }


  /**
   * Loads full normalized last block from database
   * see: loader.loadBlockChain (private)
   *
   * @async
   * @public
   * @method loadLastBlock
   * @param  {Function} cb Callback function
   * @return {Function} cb Callback function from params (through setImmediate)
   * @return {Object}   cb.err Error message if error occurred
   * @return {Object}   cb.block Full normalized last block
   */
  public loadLastBlock(cb) {
    this.library.dbSequence.add(function (cb) {
      // Get full last block from database
      // FIXME: Ordering in that SQL - to rewrite
      this.library.db.query(sql.loadLastBlock).then(function (rows) {
        // Normalize block
        var block = modules.blocks.utils.readDbRows(rows)[0];

        // Sort block's transactions
        block.transactions = block.transactions.sort(function (a, b) {
          if (block.id === library.genesisblock.block.id) {
            if (a.type === transactionTypes.VOTE) {
              return 1;
            }
          }

          if (a.type === transactionTypes.SIGNATURE) {
            return 1;
          }

          return 0;
        });

        // Update last block
        modules.blocks.lastBlock.set(block);
        return setImmediate(cb, null, block);
      }).catch(function (err) {
        library.logger.error(err.stack);
        return setImmediate(cb, 'Blocks#loadLastBlock error');
      });
    }, cb);
  };
}