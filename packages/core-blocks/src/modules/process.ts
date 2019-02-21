import {
  IAccountsModule,
  IAppState,
  IBlockLogic,
  IBlocksModel,
  IBlocksModule,
  IForkModule,
  ILogger,
  ISequence,
  ITransactionLogic,
  ITransactionPool,
  ITransactionsModel,
  ITransactionsModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import {
  IPeersModule,
  p2pSymbols,
  Peer,
  PeersLogic,
} from '@risevision/core-p2p';
import {
  BasePeerType,
  ForkType,
  IBaseTransaction,
  IKeypair,
  SignedAndChainedBlockType,
  SignedBlockType,
} from '@risevision/core-types';
import {
  WrapInDBSequence,
  WrapInDefaultSequence,
} from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import * as _ from 'lodash';
import { Op } from 'sequelize';
import * as z_schema from 'z-schema';
import { BlocksConstantsType } from '../blocksConstants';
import { BlocksSymbols } from '../blocksSymbols';
import { BlockLogic } from '../logic';
import { CommonBlockRequest, GetBlocksRequest } from '../p2p';
import { BlocksModuleChain } from './chain';
import { BlocksModuleUtils } from './utils';
import { BlocksModuleVerify } from './verify';

// tslint:disable-next-line no-var-requires
const schema = require('../../schema/blocks.json');

@injectable()
export class BlocksModuleProcess {
  // Generics
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;
  @inject(Symbols.generic.zschema)
  private schema: z_schema;
  @inject(BlocksSymbols.constants)
  private blocksConstants: BlocksConstantsType;

  // Helpers
  // tslint:disable-next-line member-ordering
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.dbSequence)
  public dbSequence: ISequence;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.defaultSequence)
  public defaultSequence: ISequence;

  // Logic
  @inject(Symbols.logic.appState)
  private appStateLogic: IAppState;
  @inject(Symbols.logic.block)
  private blockLogic: BlockLogic;
  @inject(Symbols.logic.peers)
  private peersLogic: PeersLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  // Modules
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(BlocksSymbols.modules.chain)
  private blocksChainModule: BlocksModuleChain;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(BlocksSymbols.modules.utils)
  private blocksUtilsModule: BlocksModuleUtils;
  @inject(BlocksSymbols.modules.verify)
  private blocksVerifyModule: BlocksModuleVerify;
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.fork)
  private forkModule: IForkModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.logic.txpool)
  private txPool: ITransactionPool;

  // models
  @inject(ModelSymbols.model)
  @named(Symbols.models.blocks)
  private BlocksModel: typeof IBlocksModel;
  @inject(ModelSymbols.model)
  @named(Symbols.models.transactions)
  private TransactionsModel: typeof ITransactionsModel;

  private isCleaning: boolean = false;

  @inject(p2pSymbols.transportMethod)
  @named(BlocksSymbols.p2p.getBlocks)
  private getBlocksRequest: GetBlocksRequest;
  @inject(p2pSymbols.transportMethod)
  @named(BlocksSymbols.p2p.commonBlocks)
  private commonBlockRequest: CommonBlockRequest;

  public cleanup() {
    this.isCleaning = true;
    return Promise.resolve();
  }

  /**
   * Performs chain comparison with remote peer
   * @param {Peer} peer
   * @param {number} height
   * @return {Promise}
   */
  public async getCommonBlock(
    peer: Peer,
    height: number
  ): Promise<{ id: string; previousBlock: string; height: number }> {
    const { ids } = await this.blocksUtilsModule.getIdSequence(height);

    const commonResp = await peer.makeRequest(this.commonBlockRequest, {
      query: { ids: ids.join(',') },
    });

    if (!commonResp || !commonResp.common) {
      throw new Error(
        `Chain comparison failed with peer ${peer.string} using ids: ${ids.join(
          ', '
        )}`
      );
    }

    if (!this.schema.validate(commonResp.common, schema.getCommonBlock)) {
      throw new Error('Cannot validate CommonBlock response');
    }

    // Check that block with ID, previousBlock and height exists in database
    const matchingCount = await this.BlocksModel.count({
      where: {
        height: commonResp.common.height,
        id: commonResp.common.id,
        previousBlock: commonResp.common.previousBlock,
      },
    });

    if (matchingCount === 0) {
      throw new Error(
        `Chain comparison failed with peer: ${
          peer.string
        } using block ${JSON.stringify(commonResp.common)}`
      );
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
  @WrapInDBSequence
  // tslint:disable-next-line max-line-length
  public async loadBlocksOffset(
    limit: number,
    offset: number = 0,
    verify: boolean
  ): Promise<SignedAndChainedBlockType> {
    const newLimit = limit + (offset || 0);
    const params = { limit: newLimit, offset: offset || 0 };

    this.logger.debug('Loading blocks offset', { limit, offset, verify });

    const blocks: IBlocksModel[] = await this.BlocksModel.findAll({
      include: [this.TransactionsModel],
      order: ['height', 'rowId'],
      where: {
        height: {
          [Op.gte]: params.offset,
          [Op.lt]: params.limit,
        },
      },
    });

    // Cycle through every block and apply it.
    for (const block of blocks) {
      // Stop Processing if node is shutting down
      if (this.isCleaning) {
        return;
      }

      this.logger.debug('Processing block', block.id);

      // Attach assets to block transactions
      await this.transactionLogic.attachAssets(block.transactions);

      if (verify && block.id !== this.genesisBlock.id) {
        // Sanity check of the block, if values are coherent.
        // No access to database.
        const check = await this.blocksVerifyModule.verifyBlock(block);
        if (!check.verified) {
          this.logger.error(
            `Block ${block.id} verification failed`,
            check.errors.join(', ')
          );
          // Return first error from checks
          throw new Error(check.errors[0]);
        }
      }

      if (block.id === this.genesisBlock.id) {
        await this.blocksChainModule.applyGenesisBlock(this.genesisBlock);
      } else {
        // Apply block - broadcast: false, saveBlock: false
        // FIXME: Looks like we are missing some validations here, because applyBlock is
        // different than processBlock used elesewhere
        // - that need to be checked and adjusted to be consistent
        const txAccounts = await this.accountsModule.txAccounts(
          block.transactions
        );

        await this.accountsModule.checkTXsAccountsMap(
          block.transactions,
          txAccounts
        );

        // verify transactions
        for (const tx of block.transactions) {
          await this.transactionLogic.verify(
            tx,
            txAccounts[tx.senderId],
            block.height
          );
        }

        await this.blocksChainModule.applyBlock(
          block,
          false,
          false,
          txAccounts
        );
      }
    }

    return this.blocksModule.lastBlock;
  }

  /**
   * Query remote peer for block, process them and return last processed (and valid) block
   * @param {Peer | BasePeerType} rawPeer
   * @return {Promise<SignedBlockType>}
   */
  public async loadBlocksFromPeer(
    rawPeer: Peer | BasePeerType
  ): Promise<SignedBlockType> {
    let lastValidBlock: SignedBlockType = this.blocksModule.lastBlock;

    // normalize Peer
    const peer = this.peersLogic.create(rawPeer);

    this.logger.info(`Loading blocks from ${peer.string}`);
    const blocksFromPeer = await peer.makeRequest(this.getBlocksRequest, {
      query: { lastBlockId: lastValidBlock.id },
    });

    for (const block of blocksFromPeer.blocks) {
      if (this.isCleaning) {
        return lastValidBlock;
      }
      try {
        await this.processBlock(block, { broadcast: false, saveBlock: true });
        lastValidBlock = block;
        this.logger.info(
          `Block ${block.id} loaded from ${peer.string}`,
          `height: ${block.height}`
        );
      } catch (err) {
        this.logger.debug('Block processing failed', {
          block,
          err: err.message || err.toString(),
          id: block.id,
          module: 'blocks',
        });
        this.peersModule.remove(peer.ip, peer.port);
        throw err;
      }
    }

    return lastValidBlock;
  }

  /**
   * Generates a new block with txs from pool.
   * @param {IKeypair} keypair
   * @param {number} timestamp
   * @return {Promise<void>}
   */
  public async generateBlock(
    keypair: IKeypair,
    timestamp: number
  ): Promise<SignedAndChainedBlockType> {
    const previousBlock = this.blocksModule.lastBlock;
    const txs = this.txPool.unconfirmed.txList({
      limit: this.blocksConstants.maxTxsPerBlock,
    });

    const ready: Array<IBaseTransaction<any, bigint>> = [];
    const confirmedTxs = await this.transactionsModule.filterConfirmedIds(
      txs.map((tx) => tx.id)
    );
    for (const tx of txs) {
      const sender = await this.accountsModule.getAccount({
        address: tx.senderId,
      });
      if (!sender) {
        throw new Error('Sender not found');
      }

      if (confirmedTxs.indexOf(tx.id) !== -1) {
        // NOTE: this should be unnecessary as there shouldnt be any chance for the txs to be in unconfirmedstate
        // if it was already confirmed.
        this.txPool.unconfirmed.remove(tx.id);
        await this.transactionsModule.undoUnconfirmed(tx);
        continue;
      }

      if (!(await this.transactionLogic.ready(tx, sender))) {
        // Skip tx if it's not ready.
        continue;
      }

      try {
        await this.transactionLogic.verify(tx, sender, previousBlock.height);
        ready.push(tx);
      } catch (err) {
        // TODO: why is error swallowed here? shouldn't we better handle this error?
        this.logger.error(err.stack);
      }
    }

    // Remove conflicting transactions transactions
    const conflicts = await this.transactionLogic.findConflicts(ready);
    for (const tx of conflicts) {
      for (let i = 0; i < ready.length; i++) {
        if (ready[i].id === tx.id) {
          ready.splice(i, 1);
          break;
        }
      }
    }
    return this.generateBlockWithTransactions(keypair, timestamp, ready);
  }

  /**
   * Generate a block with the given transactions
   * @param keypair
   * @param timestamp
   * @param txs
   */
  public async generateBlockWithTransactions(
    keypair: IKeypair,
    timestamp: number,
    txs: Array<IBaseTransaction<any, bigint>>
  ): Promise<SignedAndChainedBlockType> {
    const previousBlock = this.blocksModule.lastBlock;
    return this.blockLogic.create({
      keypair,
      previousBlock,
      timestamp,
      transactions: txs,
    });
  }

  public async processBlock(
    block: SignedBlockType,
    opts: { broadcast: boolean; saveBlock: boolean } = {
      broadcast: true,
      saveBlock: true,
    }
  ) {
    if (this.isCleaning) {
      // We're shutting down so stop processing any further
      throw new Error('Cleaning up');
    }
    // if (!this.loaded) {
    //  throw new Error('Blockchain is still loading');
    // }

    block = this.blockLogic.objectNormalize(block);

    // after verifyBlock block also have 'height' field so it's a SignedAndChainedBlock
    // That's because of verifyReceipt.
    const { verified, errors } = await this.blocksVerifyModule.verifyBlock(
      block
    );

    if (!verified) {
      this.logger.error(
        `Block ${block.id} verification failed`,
        errors.join(', ')
      );
      throw new Error(errors[0]);
    }

    // check if blocks exists.
    const dbBlock = await this.BlocksModel.findById(block.id);
    if (dbBlock !== null) {
      throw new Error(`Block ${block.id} already exists`);
    }

    // check transactions
    const accountsMap = await this.accountsModule.txAccounts(
      block.transactions
    );

    await this.accountsModule.checkTXsAccountsMap(
      block.transactions,
      accountsMap
    );
    await this.blocksVerifyModule.checkBlockTransactions(block, accountsMap);

    // if nothing has thrown till here then block is valid and can be applied.
    // The block and the transactions are OK i.e:
    // * Block and transactions have valid values (signatures, block slots, etc...)
    // * The check against database state passed (for instance sender has enough LSK, votes are under 101, etc...)
    // We thus update the database with the transactions values, save the block and tick it
    return this.blocksChainModule.applyBlock(
      block as SignedAndChainedBlockType,
      opts.broadcast,
      opts.saveBlock,
      accountsMap
    );
  }

  @WrapInDefaultSequence
  public async onReceiveBlock(block: SignedBlockType) {
    // When client is not loaded, is syncing or round is ticking
    // Do not receive new blocks as client is not ready
    if (this.appStateLogic.get('loader.isSyncing')) {
      this.logger.debug('Client not ready to receive block', block.id);
      return;
    }

    const lastBlock = this.blocksModule.lastBlock;
    // Detect sane block
    if (
      block.previousBlock === lastBlock.id &&
      lastBlock.height + 1 === block.height
    ) {
      // Process received block
      return this.processBlock(block);
    } else if (
      block.previousBlock !== lastBlock.id &&
      lastBlock.height + 1 === block.height
    ) {
      // Process received fork cause 1
      return this.receiveForkOne(block, lastBlock);
    } else if (
      block.previousBlock === lastBlock.previousBlock &&
      block.height === lastBlock.height &&
      block.id !== lastBlock.id
    ) {
      // Process received fork cause 5
      return this.receiveForkFive(block, lastBlock);
    } else {
      if (block.id === lastBlock.id) {
        this.logger.debug('Block already processed', block.id);
      } else {
        this.logger.warn(
          [
            'Discarded block that does not match with current chain:',
            block.id,
            'height:',
            block.height,
            'generator:',
            block.generatorPublicKey.toString('hex'),
          ].join(' ')
        );
        throw new Error('Block discarded - not in current chain');
      }
    }
  }

  /**
   * Receive block detected as fork cause 1: Consecutive height but different previous block id
   */
  private async receiveForkOne(
    block: SignedBlockType,
    lastBlock: SignedAndChainedBlockType
  ) {
    const tmpBlock = _.clone(block);

    // Fork: Consecutive height but different previous block id
    await this.forkModule.fork(block, ForkType.TYPE_1);

    // Keep the oldest block, or if both have same age, keep block with lower id
    if (
      block.timestamp > lastBlock.timestamp ||
      (block.timestamp === lastBlock.timestamp && block.id > lastBlock.id)
    ) {
      this.logger.info('Last block stands');
    } else {
      this.logger.info('Last block and parent loses');
      try {
        const tmpBlockN = this.blockLogic.objectNormalize(tmpBlock);
        // TODO: can I remove this --> ?
        // await this.delegatesModule.assertValidBlockSlot(block);
        const check = await this.blocksVerifyModule.verifyReceipt(tmpBlockN);
        if (!check.verified) {
          this.logger.error(
            `Block ${tmpBlockN.id} verification failed`,
            check.errors.join(', ')
          );
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
  private async receiveForkFive(
    block: SignedBlockType,
    lastBlock: SignedBlockType
  ) {
    const tmpBlock = _.clone(block);

    // Fork: Same height and previous block id, but different block id
    await this.forkModule.fork(block, ForkType.TYPE_5);

    // Check if delegate forged on more than one node
    if (block.generatorPublicKey === lastBlock.generatorPublicKey) {
      this.logger.warn(
        'Delegate forging on multiple nodes',
        block.generatorPublicKey
      );
    }

    // Keep the oldest block, or if both have same age, keep block with lower id
    if (
      block.timestamp > lastBlock.timestamp ||
      (block.timestamp === lastBlock.timestamp && block.id > lastBlock.id)
    ) {
      this.logger.info('Last block stands');
    } else {
      this.logger.info('Last block loses');
      try {
        const tmpBlockN = this.blockLogic.objectNormalize(tmpBlock);

        // verify receipt of block
        const check = await this.blocksVerifyModule.verifyReceipt(tmpBlockN);
        if (!check.verified) {
          this.logger.error(
            `Block ${tmpBlockN.id} verification failed`,
            check.errors.join(', ')
          );
          throw new Error(check.errors[0]);
        }

        // delete previous block
        await this.blocksChainModule.deleteLastBlock();

        // Process new block (again);
        await this.processBlock(block);
      } catch (err) {
        this.logger.error('Fork recovery failed', err);
        throw err;
      }
    }
  }
}
