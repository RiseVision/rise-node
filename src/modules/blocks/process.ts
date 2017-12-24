import { inject, injectable, tagged } from 'inversify';
import * as _ from 'lodash';
import { IDatabase } from 'pg-promise';
import * as z_schema from 'z-schema';
import { catchToLoggerAndRemapError, constants, ForkType, IKeypair, ILogger, Sequence, Slots } from '../../helpers/';
import {
  IAppState, IBlockLogic, IPeerLogic, IPeersLogic, IRoundsLogic,
  ITransactionLogic
} from '../../ioc/interfaces/logic';
import {
  IAccountsModule,
  IBlocksModule,
  IBlocksModuleChain,
  IBlocksModuleProcess,
  IBlocksModuleUtils,
  IBlocksModuleVerify,
  IForkModule,
  ITransactionsModule,
  ITransportModule
} from '../../ioc/interfaces/modules/';
import { Symbols } from '../../ioc/symbols';
import { BasePeerType, SignedAndChainedBlockType, SignedBlockType, } from '../../logic/';
import { IBaseTransaction } from '../../logic/transactions/';
import schema from '../../schema/blocks';
import sql from '../../sql/blocks';
import { RawFullBlockListType } from '../../types/rawDBTypes';

@injectable()
export class BlocksModuleProcess implements IBlocksModuleProcess {
  // Modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.blocksSubModules.utils)
  private blocksUtilsModule: IBlocksModuleUtils;
  @inject(Symbols.modules.blocksSubModules.chain)
  private blocksChainModule: IBlocksModuleChain;
  @inject(Symbols.modules.blocksSubModules.verify)
  private blocksVerifyModule: IBlocksModuleVerify;
  @inject(Symbols.modules.fork)
  private forkModule: IForkModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.modules.transport)
  private transportModule: ITransportModule;

  // Generics
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
  @inject(Symbols.generic.zschema)
  private schema: z_schema;
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;

  // Helpers
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.defaultSequence)
  private sequence: Sequence;
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.dbSequence)
  private dbSequence: Sequence;
  @inject(Symbols.helpers.slots)
  private slots: Slots;

  // Logic
  @inject(Symbols.logic.appState)
  private appStateLogic: IAppState;
  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
  @inject(Symbols.logic.peers)
  private peersLogic: IPeersLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;
  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;

  public cleanup() {
    return Promise.resolve();
  }

  /**
   * Performs chain comparison with remote peer
   * WARNING: Can trigger chain recovery
   * @param {PeerLogic} peer
   * @param {number} height
   * @return {Promise<void>}
   */
  // FIXME VOid return for recoverChain
  // tslint:disable-next-line max-line-length
  public async getCommonBlock(peer: IPeerLogic, height: number): Promise<{ id: string, previousBlock: string, height: number } | void> {
    const { ids }              = await this.blocksUtilsModule.getIdSequence(height);
    const { body: commonResp } = await this.transportModule
      .getFromPeer<{ common: { id: string, previousBlock: string, height: number } }>(peer, {
        api   : `/blocks/common?ids=${ids.join(',')}`,
        method: 'GET',
      });
    // FIXME: Need better checking here, is base on 'common' property enough?
    if (!commonResp.common) {
      if (this.appStateLogic.getComputed('node.poorConsensus')) {
        return this.blocksChainModule.recoverChain();
      } else {
        throw new Error(`Chain comparison failed with peer ${peer.string} using ids: ${ids.join(', ')}`);
      }
    }

    if (!this.schema.validate(commonResp.common, schema.getCommonBlock)) {
      throw new Error('Cannot validate commonblock response');
    }

    // Check that block with ID, previousBlock and height exists in database
    const prevBlockRows = await this.db.query(sql.getCommonBlock(commonResp.common), {
      height       : commonResp.common.height,
      id           : commonResp.common.id,
      previousBlock: commonResp.common.previousBlock,
    })
      .catch(catchToLoggerAndRemapError('Blocks#getCommonBlock error', this.logger));

    if (!prevBlockRows.length || !prevBlockRows[0].count) {
      // Block does not exist  - comparison failed.
      if (this.appStateLogic.getComputed('node.poorConsensus')) {
        return this.blocksChainModule.recoverChain();
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
  // tslint:disable-next-line max-line-length
  public async loadBlocksOffset(limit: number, offset: number = 0, verify: boolean): Promise<SignedAndChainedBlockType> {
    const newLimit = limit + (offset || 0);
    const params   = { limit: newLimit, offset: offset || 0 };

    this.logger.debug('Loading blocks offset', { limit, offset, verify });

    return this.dbSequence.addAndPromise(async () => {
      const blocks: SignedAndChainedBlockType[] = this.blocksUtilsModule.readDbRows(
        await this.db.query(sql.loadBlocksOffset, params)
          .catch(catchToLoggerAndRemapError('Blocks#loadBlocksOffset error', this.logger))
      );

      // Cycle through every block and apply it.
      for (const block of blocks) {
        // Stop Processing if node is shutting down
        if (this.blocksModule.isCleaning) {
          return;
        }
        this.logger.debug('Processing block', block.id);
        if (verify && block.id !== this.genesisBlock.id) {
          // Sanity check of the block, if values are coherent.
          // No access to database.
          const check = await this.blocksVerifyModule.verifyBlock(block);

          if (!check.verified) {
            this.logger.error(`Block ${block.id} verification failed`, check.errors.join(', '));
            // Return first error from checks
            throw new Error(check.errors[0]);
          }
        }

        if (block.id === this.genesisBlock.id) {
          await this.blocksChainModule.applyGenesisBlock(block);
        } else {
          // Apply block - broadcast: false, saveBlock: false
          // FIXME: Looks like we are missing some validations here, because applyBlock is
          // different than processBlock used elesewhere
          // - that need to be checked and adjusted to be consistent
          await this.blocksChainModule.applyBlock(block, false, false);
        }

        this.blocksModule.lastBlock = block;

      }
      return this.blocksModule.lastBlock;
    });
  }

  /**
   * Query remote peer for block, process them and return last processed (and valid) block
   * @param {PeerLogic | BasePeerType} rawPeer
   * @return {Promise<SignedBlockType>}
   */
  public async loadBlocksFromPeer(rawPeer: IPeerLogic | BasePeerType): Promise<SignedBlockType> {
    let lastValidBlock: SignedBlockType = this.blocksModule.lastBlock;

    // normalize Peer
    const peer = this.peersLogic.create(rawPeer);

    this.logger.info(`Loading blocks from ${peer.string}`);

    const { body: blocksFromPeer } = await this.transportModule
      .getFromPeer<{ blocks: RawFullBlockListType[] }>(peer, {
        api   : `/blocks?lastBlockId=${lastValidBlock.id}`,
        method: 'GET',
      });

    // TODO: fix schema of loadBlocksFromPeer
    if (!this.schema.validate(blocksFromPeer.blocks, schema.loadBlocksFromPeer)) {
      throw new Error('Received invalid blocks data');
    }

    const blocks = this.blocksUtilsModule.readDbRows(blocksFromPeer.blocks);
    for (const block of blocks) {
      if (this.blocksModule.isCleaning) {
        return lastValidBlock;
      }
      try {
        await this.blocksVerifyModule.processBlock(block, false, true);
        lastValidBlock = block;
        this.logger.info(`Block ${block.id} loaded from ${peer.string}`, `height: ${block.height}`);
      } catch (err) {
        this.logger.debug('Block processing failed',
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
    const previousBlock = this.blocksModule.lastBlock;
    const txs           = this.transactionsModule.getUnconfirmedTransactionList(false, constants.maxTxsPerBlock);

    const ready: Array<IBaseTransaction<any>> = [];
    for (const tx of txs) {
      const sender = await this.accountsModule.getAccount({ publicKey: tx.senderPublicKey });
      if (!sender) {
        throw new Error('Sender not found');
      }

      if (!this.transactionLogic.ready(tx, sender)) {
        // Skip tx if it's not ready.
        continue;
      }

      try {
        await this.transactionLogic.verify(tx, sender, null, previousBlock.height);
      } catch (err) {
        // TODO: why is error swallowed here? shouldn't we better handle this error?
        this.logger.error(err.stack);
      }
      ready.push(tx);
    }

    const block = this.blockLogic.create({
      keypair,
      previousBlock,
      timestamp,
      transactions: ready,
    });

    // Call process block to save and broadcast the newly forged block!
    return this.blocksVerifyModule.processBlock(block, true, true);
  }

  public async onReceiveBlock(block: SignedBlockType) {
    return this.sequence.addAndPromise(async () => {
      // When client is not loaded, is syncing or round is ticking
      // Do not receive new blocks as client is not ready
      if (this.appStateLogic.get('loader.isSyncing') ||
        this.appStateLogic.get('rounds.isTicking')) {
        this.logger.debug('Client not ready to receive block', block.id);
        return;
      }

      const lastBlock = this.blocksModule.lastBlock;
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
          this.logger.debug('Block already processed', block.id);
        } else {
          this.logger.warn([
            'Discarded block that does not match with current chain:', block.id,
            'height:', block.height,
            'round:', this.roundsLogic.calcRound(block.height),
            'slot:', this.slots.getSlotNumber(block.timestamp),
            'generator:', block.generatorPublicKey,
          ].join(' '));
        }

      }
    });
  }

  /**
   * called by onReceiveBlock. Will update receipt on blocks module and call processBlock on verify Submodule
   * @param {SignedBlockType} block
   * @return {Promise<any>}
   */
  private receiveBlock(block: SignedBlockType) {
    this.logger.info([
      'Received new block id:', block.id,
      'height:', block.height,
      'round:', this.roundsLogic.calcRound(block.height),
      'slot:', this.slots.getSlotNumber(block.timestamp),
      'reward:', block.reward,
    ].join(' '));

    // Update last receipt
    this.blocksModule.lastReceipt.update();
    // Start block processing - broadcast: true, saveBlock: true
    return this.blocksVerifyModule.processBlock(block, true, true);
  }

  /**
   * Receive block detected as fork cause 1: Consecutive height but different previous block id
   */
  private async receiveForkOne(block: SignedBlockType, lastBlock: SignedBlockType) {
    const tmpBlock = _.clone(block);

    // Fork: Consecutive height but different previous block id
    await this.forkModule.fork(block, ForkType.TYPE_1);

    // Keep the oldest block, or if both have same age, keep block with lower id
    if (block.timestamp > lastBlock.timestamp || (block.timestamp === lastBlock.timestamp && block.id > lastBlock.id)) {
      this.logger.info('Last block stands');
    } else {
      this.logger.info('Last block and parent loses');
      try {
        const tmpBlockN = this.blockLogic.objectNormalize(tmpBlock);
        const check     = this.blocksVerifyModule.verifyReceipt(tmpBlockN);
        if (!check.verified) {
          this.logger.error(`Block ${tmpBlockN.id} verification failed`, check.errors.join(', '));
          throw new Error(check.errors[0]);
        }
        // Delete last 2 blocks
        await this.blocksChainModule.deleteLastBlock();
        await this.blocksChainModule.deleteLastBlock();
      } catch (err) {
        this.logger.error('Fork recovery failed', err);
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
    await this.forkModule.fork(block, ForkType.TYPE_5);

    // Check if delegate forged on more than one node
    if (block.generatorPublicKey === lastBlock.generatorPublicKey) {
      this.logger.warn('Delegate forging on multiple nodes', block.generatorPublicKey);
    }

    // Keep the oldest block, or if both have same age, keep block with lower id
    if (block.timestamp > lastBlock.timestamp || (block.timestamp === lastBlock.timestamp && block.id > lastBlock.id)) {
      this.logger.info('Last block stands');
    } else {
      this.logger.info('Last block loses');
      try {
        const tmpBlockN = this.blockLogic.objectNormalize(tmpBlock);

        // verify receipt of block
        const check = this.blocksVerifyModule.verifyReceipt(tmpBlockN);
        if (!check.verified) {
          this.logger.error(`Block ${tmpBlockN.id} verification failed`, check.errors.join(', '));
          throw new Error(check.errors[0]);
        }

        // delete previous block
        await this.blocksChainModule.deleteLastBlock();

        // Process new block (again);
        await this.receiveBlock(block);
      } catch (err) {
        this.logger.error('Fork recovery failed', err);
        throw err;
      }
    }
  }
}
