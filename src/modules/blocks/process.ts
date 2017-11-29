import * as _ from 'lodash';
import { IDatabase } from 'pg-promise';
import * as z_schema from 'z-schema';
import sql from '../../../sql/blocks';
import { catchToLoggerAndRemapError, constants, ForkType, IKeypair, ILogger, Sequence, Slots } from '../../helpers/';
import {
  BasePeerType,
  BlockLogic,
  Peer,
  Peers,
  SignedAndChainedBlockType,
  SignedBlockType,
  TransactionLogic
} from '../../logic/';
import { IBaseTransaction } from '../../logic/transactions/';
import schema from '../../schema/blocks';
import { RawFullBlockListType } from '../../types/rawDBTypes';

import { AccountsModule } from '../accounts';
import { BlocksModule } from '../blocks';
import { DelegatesModule } from '../delegates';
import { LoaderModule } from '../loader';
import { RoundsModule } from '../rounds';
import { TransactionsModule } from '../transactions';
import { TransportModule } from '../transport';

// tslint:disable-next-line interface-over-type-literal
export type BlocksModuleProcessLibrary = {
  dbSequence: Sequence,
  db: IDatabase<any>,
  schema: z_schema,
  sequence: Sequence,
  logger: ILogger,
  genesisblock: SignedAndChainedBlockType
  logic: {
    block: BlockLogic,
    peers: Peers,
    transaction: TransactionLogic
  }
};

export class BlocksModuleProcess {
  private modules: {
    accounts: AccountsModule,
    blocks: BlocksModule,
    delegates: DelegatesModule,
    loader: LoaderModule,
    rounds: RoundsModule,
    transactions: TransactionsModule,
    transport: TransportModule,
  };
  private loaded: boolean = false;

  constructor(public library: BlocksModuleProcessLibrary) {
    this.library.logger.trace('Blocks->Process: Submodule initialized.');
  }

  /**
   * Performs chain comparison with remote peer
   * WARNING: Can trigger chain recovery
   * @param {Peer} peer
   * @param {number} height
   * @return {Promise<void>}
   */
  // FIXME VOid return for recoverChain
  public async getCommonBlock(peer: Peer, height: number): Promise<{ id: string, previousBlock: string, height: number } | void> {
    const { ids }              = await this.modules.blocks.utils.getIdSequence(height);
    const { body: commonResp } = await this.modules.transport
      .getFromPeer<{ common: { id: string, previousBlock: string, height: number } }>(peer, {
        api   : `/blocks/common?ids=${ids.join(',')}`,
        method: 'GET',
      });
    // FIXME: Need better checking here, is base on 'common' property enough?
    if (!commonResp.common) {
      if (this.modules.transport.poorConsensus) {
        return this.modules.blocks.chain.recoverChain();
      } else {
        throw new Error(`Chain comparison failed with peer ${peer.string} using ids: ${ids.join(', ')}`);
      }
    }

    if (!this.library.schema.validate(commonResp.common, schema.getCommonBlock)) {
      throw new Error('Cannot validate commonblock response');
    }

    // Check that block with ID, previousBlock and height exists in database
    const prevBlockRows = await this.library.db.query(sql.getCommonBlock(commonResp.common), {
      height       : commonResp.common.height,
      id           : commonResp.common.id,
      previousBlock: commonResp.common.previousBlock,
    })
      .catch(catchToLoggerAndRemapError('Blocks#getCommonBlock error', this.library.logger));

    if (!prevBlockRows.length || !prevBlockRows[0].count) {
      // Block does not exist  - comparison failed.
      if (this.modules.transport.poorConsensus) {
        return this.modules.blocks.chain.recoverChain();
      } else {
        throw new Error(`Chain comparison failed with peer: ${
          peer.string} using block ${JSON.stringify(commonResp.common)}`);
      }
    }

    return commonResp.common;
  }

  /**
   * Loads full blocks from database, used when rebuilding blockchain, snapshotting.
   * @param {number} limit
   * @param {number} offset
   * @param {boolean} verify
   * @return {Promise<void>}
   */
  public async loadBlocksOffset(limit: number, offset: number = 0, verify: boolean): Promise<SignedAndChainedBlockType> {
    const newLimit = limit + (offset || 0);
    const params   = { limit: newLimit, offset: offset || 0 };

    this.library.logger.debug('Loading blocks offset', { limit, offset, verify });

    return this.library.dbSequence.addAndPromise(async () => {
      const blocks: SignedAndChainedBlockType[] = this.modules.blocks.utils.readDbRows(
        await this.library.db.query(sql.loadBlocksOffset, params)
          .catch(catchToLoggerAndRemapError('Blocks#loadBlocksOffset error', this.library.logger))
      );

      // Cycle through every block and apply it.
      for (const block of blocks) {
        // Stop Processing if node is shutting down
        if (this.modules.blocks.isCleaning) {
          return;
        }
        this.library.logger.debug('Processing block', block.id);
        if (verify && block.id !== this.library.genesisblock.id) {
          // Sanity check of the block, if values are coherent.
          // No access to database.
          const check = await this.modules.blocks.verify.verifyBlock(block);

          if (!check.verified) {
            this.library.logger.error(`Block ${block.id} verification failed`, check.errors.join(', '));
            // Return first error from checks
            throw new Error(check.errors[0]);
          }
        }

        if (block.id === this.library.genesisblock.id) {
          await this.modules.blocks.chain.applyGenesisBlock(block);
        } else {
          // Apply block - broadcast: false, saveBlock: false
          // FIXME: Looks like we are missing some validations here, because applyBlock is
          // different than processBlock used elesewhere
          // - that need to be checked and adjusted to be consistent
          await this.modules.blocks.chain.applyBlock(block, false, false);
        }

        this.modules.blocks.lastBlock = block;

      }
      return this.modules.blocks.lastBlock;
    });
  }

  /**
   * Query remote peer for block, process them and return last processed (and valid) block
   * @param {Peer | BasePeerType} rawPeer
   * @return {Promise<SignedBlockType>}
   */
  public async loadBlocksFromPeer(rawPeer: Peer | BasePeerType): Promise<SignedBlockType> {
    let lastValidBlock: SignedBlockType = this.modules.blocks.lastBlock;

    // normalize Peer
    const peer = this.library.logic.peers.create(rawPeer);

    this.library.logger.info(`Loading blocks from ${peer.string}`);

    const { body: blocksFromPeer } = await this.modules.transport
      .getFromPeer<{ blocks: RawFullBlockListType[] }>(peer, {
        api   : `/blocks?lastBlockId=${lastValidBlock.id}`,
        method: 'GET',
      });

    // TODO: fix schema of loadBlocksFromPeer
    if (!this.library.schema.validate(blocksFromPeer.blocks, schema.loadBlocksFromPeer)) {
      throw new Error('Received invalid blocks data');
    }

    const blocks = this.modules.blocks.utils.readDbRows(blocksFromPeer.blocks);
    for (const block of blocks) {
      if (this.modules.blocks.isCleaning) {
        return lastValidBlock;
      }
      try {
        await this.modules.blocks.verify.processBlock(block, false, true);
        lastValidBlock = block;
        this.library.logger.info(`Block ${block.id} loaded from ${peer.string}`, `height: ${block.height}`);
      } catch (err) {
        this.library.logger.debug('Block processing failed',
          { id: block.id, err: err.message || err.toString(), module: 'blocks', block }
        );
        throw err;
      }
    }

    return lastValidBlock;
  }

  /**
   * Generates a new block
   * @param {IKeypair} keypair
   * @param {number} timestamp
   * @return {Promise<void>}
   */
  public async generateBlock(keypair: IKeypair, timestamp: number) {
    const previousBlock = this.modules.blocks.lastBlock;
    const txs           = this.modules.transactions.getUnconfirmedTransactionList(false, constants.maxTxsPerBlock);

    const ready: Array<IBaseTransaction<any>> = [];
    for (const tx of txs) {
      const sender = await this.modules.accounts.getAccount({ publicKey: tx.senderPublicKey });
      if (!sender) {
        throw new Error('Sender not found');
      }

      if (!this.library.logic.transaction.ready(tx, sender)) {
        // Skip tx if it's not ready.
        continue;
      }

      try {
        this.library.logic.transaction.verify(tx, sender, null, previousBlock.height);
      } catch (err) {
        // TODO: why is error swallowed here? shouldn't we better handle this error?
        this.library.logger.error(err.stack);
      }
      ready.push(tx);
    }

    const block = this.library.logic.block.create({
      keypair,
      previousBlock,
      timestamp,
      transactions: ready,
    });

    // Call process block to save and broadcast the newly forged block!
    return this.modules.blocks.verify.processBlock(block, true, true);
  }

  public async onReceiveBlock(block: SignedBlockType) {
    return this.library.sequence.addAndPromise(async () => {
      // When client is not loaded, is syncing or round is ticking
      // Do not receive new blocks as client is not ready
      if (!this.loaded || this.modules.loader.isSyncing || this.modules.rounds.isTicking()) {
        this.library.logger.debug('Client not ready to receive block', block.id);
        return;
      }

      const lastBlock = this.modules.blocks.lastBlock;
      // Detect sane block
      if (block.previousBlock === lastBlock.id && lastBlock.height + 1 === block.height) {
        // Process received block
        return this.receiveBlock(block);
      } else if (block.previousBlock !== lastBlock.id && lastBlock.height + 1 === block.height) {
        // Process received fork cause 1
        return this.receiveForkOne(block, lastBlock);
      } else if (block.previousBlock === lastBlock.previousBlock &&
        block.height === lastBlock.height && block.id !== lastBlock.id) {
        // Process received fork cause 5
        return this.receiveForkFive(block, lastBlock);
      } else {
        if (block.id === lastBlock.id) {
          this.library.logger.debug('Block already processed', block.id);
        } else {
          this.library.logger.warn([
            'Discarded block that does not match with current chain:', block.id,
            'height:', block.height,
            'round:', this.modules.rounds.calcRound(block.height),
            'slot:', Slots.getSlotNumber(block.timestamp),
            'generator:', block.generatorPublicKey,
          ].join(' '));
        }

      }
    });
  }

  public onBind(scope) {
    this.library.logger.trace('Blocks->Process: Shared modules bind.');
    this.modules = {
      accounts    : scope.accounts,
      blocks      : scope.blocks,
      delegates   : scope.delegates,
      loader      : scope.loader,
      rounds      : scope.rounds,
      transactions: scope.transactions,
      transport   : scope.transport,
    };

    // Set module as loaded
    this.loaded = true;
  }

  /**
   * called by onReceiveBlock. Will update receipt on blocks module and call processBlock on verify Submodule
   * @param {SignedBlockType} block
   * @return {Promise<any>}
   */
  private receiveBlock(block: SignedBlockType) {
    this.library.logger.info([
      'Received new block id:', block.id,
      'height:', block.height,
      'round:', this.modules.rounds.calcRound(block.height),
      'slot:', Slots.getSlotNumber(block.timestamp),
      'reward:', block.reward,
    ].join(' '));

    // Update last receipt
    this.modules.blocks.lastReceipt.update();
    // Start block processing - broadcast: true, saveBlock: true
    return this.modules.blocks.verify.processBlock(block, true, true);
  }

  /**
   * Receive block detected as fork cause 1: Consecutive height but different previous block id
   */
  private async receiveForkOne(block: SignedBlockType, lastBlock: SignedBlockType) {
    const tmpBlock = _.clone(block);

    // Fork: Consecutive height but different previous block id
    this.modules.delegates.fork(block, ForkType.TYPE_1);

    // Keep the oldest block, or if both have same age, keep block with lower id
    if (block.timestamp > lastBlock.timestamp || (block.timestamp === lastBlock.timestamp && block.id > lastBlock.id)) {
      this.library.logger.info('Last block stands');
    } else {
      this.library.logger.info('Last block and parent loses');
      try {
        const tmpBlockN = this.library.logic.block.objectNormalize(tmpBlock);
        const check     = this.modules.blocks.verify.verifyReceipt(tmpBlockN);
        if (!check.verified) {
          this.library.logger.error(`Block ${tmpBlockN.id} verification failed`, check.errors.join(', '));
          throw new Error(check.errors[0]);
        }
        // Delete last 2 blocks
        await this.modules.blocks.chain.deleteLastBlock();
        await this.modules.blocks.chain.deleteLastBlock();
      } catch (err) {
        this.library.logger.error('Fork recovery failed', err);
        throw err;
      }
    }
  }

  /**
   * Receive block detected as fork cause 5: Same height and previous block id, but different block id
   */
  private async receiveForkFive(block: SignedBlockType, lastBlock: SignedBlockType) {
    const tmpBlock = _.clone(block);

    // Fork: Same height and previous block id, but different block id
    this.modules.delegates.fork(block, ForkType.TYPE_5);

    // Check if delegate forged on more than one node
    if (block.generatorPublicKey === lastBlock.generatorPublicKey) {
      this.library.logger.warn('Delegate forging on multiple nodes', block.generatorPublicKey);
    }

    // Keep the oldest block, or if both have same age, keep block with lower id
    if (block.timestamp > lastBlock.timestamp || (block.timestamp === lastBlock.timestamp && block.id > lastBlock.id)) {
      this.library.logger.info('Last block stands');
    } else {
      this.library.logger.info('Last block loses');
      try {
        const tmpBlockN = this.library.logic.block.objectNormalize(tmpBlock);

        // verify receipt of block
        const check = this.modules.blocks.verify.verifyReceipt(tmpBlockN);
        if (!check.verified) {
          this.library.logger.error(`Block ${tmpBlockN.id} verification failed`, check.errors.join(', '));
          throw new Error(check.errors[0]);
        }

        // delete previous block
        await this.modules.blocks.chain.deleteLastBlock();

        // Process new block (again);
        await this.receiveBlock(block);
      } catch (err) {
        this.library.logger.error('Fork recovery failed', err);
        throw err;
      }
    }
  }
}
