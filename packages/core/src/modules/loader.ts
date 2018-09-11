import {
  BlocksModuleChain,
  BlocksModuleProcess,
  BlocksModuleUtils,
  BlocksModuleVerify,
  BlocksSymbols
} from '@risevision/core-blocks';
import {
  IAccountLogic,
  IAccountsModel,
  IAppState,
  IBlocksModel,
  IBlocksModule,
  IJobsQueue,
  ILoaderModule,
  ILogger,
  ISequence,
  ISystemModule,
  ITransactionLogic,
  ITransactionsModule,
  Symbols
} from '@risevision/core-interfaces';
import {
  AppConfig,
  ConstantsType,
  SignedAndChainedBlockType,
  SignedBlockType
} from '@risevision/core-types';
import { wait, WrapInDefaultSequence } from '@risevision/core-utils';
import { inject, injectable, named, postConstruct } from 'inversify';
import * as promiseRetry from 'promise-retry';
import * as sequelize from 'sequelize';
import { Op } from 'sequelize';
import SocketIO from 'socket.io';
import z_schema from 'z-schema';
import { ModelSymbols } from '@risevision/core-models';
import { WordPressHookSystem } from 'mangiafuoco';
import sql from '../sql/loader';

import Timer = NodeJS.Timer;
import { OnBlockchainReady, RecreateAccountsTables } from '../hooks';
import { BroadcasterLogic, Peer, PeersModule } from '@risevision/core-p2p';

const loaderSchema = require('../../schema/loader.json');

@injectable()
export class LoaderModule implements ILoaderModule {

  public loaded: boolean                       = false;
  private blocksToSync: number                 = 0;
  private isActive: boolean                    = false;
  private lastblock: SignedAndChainedBlockType = null;
  private network: { height: number, peers: Peer[] };
  private retries: number                      = 5;
  private syncIntervalId: Timer                = null;

  // Generic
  @inject(Symbols.generic.appConfig)
  private config: AppConfig;
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  @inject(Symbols.generic.hookSystem)
  private hookSystem: WordPressHookSystem;

  // Helpers
  // @inject(Symbols.helpers.bus)
  // private bus: Bus;
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(Symbols.helpers.jobsQueue)
  private jobsQueue: IJobsQueue;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.generic.zschema)
  private schema: z_schema;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.defaultSequence)
  public defaultSequence: ISequence;

  // Logic
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;
  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: BroadcasterLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  // Modules
  @inject(BlocksSymbols.modules.chain)
  private blocksChainModule: BlocksModuleChain;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(BlocksSymbols.modules.process)
  private blocksProcessModule: BlocksModuleProcess;
  @inject(BlocksSymbols.modules.utils)
  private blocksUtilsModule: BlocksModuleUtils;
  // @inject(BlocksSymbols.modules.verify)
  // private blocksVerifyModule: BlocksModuleVerify;
  // @inject(Symbols.modules.multisignatures)
  // private multisigModule: IMultisignaturesModule;
  @inject(Symbols.modules.peers)
  private peersModule: PeersModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  // @inject(Symbols.modules.transport)
  // private transportModule: ITransportModule;

  // Models
  @inject(ModelSymbols.model)
  @named(Symbols.models.accounts)
  private AccountsModel: typeof IAccountsModel;
  @inject(ModelSymbols.model)
  @named(Symbols.models.blocks)
  private BlocksModel: typeof IBlocksModel;
  //
  // @inject(TXSymbols.p2p.getTransactions)
  // private gtFactory: RequestFactoryType<void, GetTransactionsRequest>;

  @postConstruct()
  public initialize() {
    this.network = {
      height: 0,
      peers : [],
    };
  }

  public async getNetwork() {
    if (!(
      this.network.height > 0 &&
      Math.abs(this.network.height - this.blocksModule.lastBlock.height) === 1)
    ) {
      const { peers } = await this.peersModule.list({});
      this.network    = this.findGoodPeers(peers);
    }
    return this.network;
  }

  public async getRandomPeer(): Promise<Peer> {
    const { peers } = await this.getNetwork();
    if (peers.length === 0) {
      throw new Error('No acceptable peers for the operation');
    }
    return peers[Math.floor(Math.random() * peers.length)];
  }

  /**
   * Checks if we're syncing or not.
   */
  public get isSyncing(): boolean {
    return this.appState.get('loader.isSyncing') || false;
  }

  public async onPeersReady() {
    await this.syncTimer();
    // If transactions polling is not enabled, sync txs only on boot.
    if (this.loaded) {
      await this.doSync();
    }
  }

  public onBlockchainReady() {
    this.loaded = true;
  }

  public cleanup() {
    this.loaded = false;
    this.jobsQueue.unregister('loaderSyncTimer');
    return Promise.resolve();
  }

  /**
   * Checks mem tables:
   * - count blocks from `blocks` table
   * - get genesis block from `blocks` table
   * - count accounts from `mem_accounts` table by block id
   * - get rounds from `mem_round`
   * Matchs genesis block with database.
   * Verifies Snapshot mode.
   * Recreates memory tables when neccesary:
   *  - Calls logic.account to removeTables and createTables
   *  - Calls block to load block. When blockchain ready emits a bus message.
   * Detects orphaned blocks in `mem_accounts` and gets delegates.
   * Loads last block and emits a bus message blockchain is ready.
   */
  public async loadBlockChain(): Promise<void> {
    const limit = Number(this.config.loading.loadPerIteration) || 1000;
    // const verify   = Boolean(this.library.config.loading.verifyOnLoading);

    const blocksCount = await this.BlocksModel.count();
    this.logger.info(`Blocks ${blocksCount}`);

    if (blocksCount === 1) {
      // Load from start!
      return this.load(1, limit, null, true);
    }

    const genesisBlock = await this.BlocksModel.findOne({ where: { height: 1 } });
    // If there's a genesis in db lets check its validity against code version
    if (genesisBlock) {
      const matches = (
        genesisBlock.id === this.genesisBlock.id &&
        genesisBlock.payloadHash.equals(this.genesisBlock.payloadHash) &&
        genesisBlock.blockSignature.equals(this.genesisBlock.blockSignature)
      );
      if (!matches) {
        throw new Error('Failed to match genesis block with database');
      }
      this.logger.info('Genesis block matches with database');
    }

    // Check if we are in verifySnapshot mode.
    if (this.config.loading.snapshot) {
      await this.verifySnapshot(blocksCount, limit);
      process.exit(0);
    }

    try {
      await this.hookSystem.do_action('core/loader/performIntegrityChecks');
    } catch (e) {
      return this.load(blocksCount, limit, e.message, true);
    }

    const updatedAccountsInLastBlock = await this.AccountsModel
      .count({
        where: {
          blockId: { [Op.in]: sequelize.literal('(SELECT "id" from blocks ORDER BY "height" DESC LIMIT 1)') },
        },
      });

    if (updatedAccountsInLastBlock === 0) {
      return this.load(blocksCount, limit, 'Detected missed blocks in mem_accounts', true);
    }

    await this.hookSystem.do_action('core/loader/accounts/restoreUnconfirmedEntries');

    const orphanedMemAccounts = await this.AccountsModel.sequelize.query(
      sql.getOrphanedMemAccounts,
      { type: sequelize.QueryTypes.SELECT });

    if (orphanedMemAccounts.length > 0) {
      return this.load(blocksCount, limit, 'Detected orphaned blocks in mem_accounts', true);
    }

    try {
      this.lastblock = await this.blocksUtilsModule.loadLastBlock();
    } catch (err) {
      return this.load(blocksCount, limit, err.message || 'Failed to load last block');
    }

    try {
      await this.hookSystem.do_action('core/loader/loadBlockchain/checkIntegrity', blocksCount);
    } catch (e) {
      return this.load(blocksCount, limit, e.message);
    }

    this.logger.info('Blockchain ready');
    await this.hookSystem.do_action('core/loader/onBlockchainReady');
  }

  private async verifySnapshot(blocksCount: number, limit: number) {
    this.logger.info('Snapshot mode enabled');

    blocksCount = await this.hookSystem.apply_filters('core/loader/snapshot/blocksCount', blocksCount);

    this.config.loading.snapshot = blocksCount;
    this.appState.set('rounds.snapshot', blocksCount);

    this.logger.info(`Snapshotting to end of round: ${this.config.loading.snapshot}`, blocksCount);

    await this.load(
      blocksCount,
      limit,
      'Blocks Verification enabled',
      false
    );

    if (this.blocksModule.lastBlock.height !== blocksCount) {
      // tslint:disable-next-line max-line-length
      this.logger.error(`LastBlock height does not expected block. Expected: ${blocksCount} - Received: ${this.blocksModule.lastBlock.height}`);
      process.exit(1);
    }
  }

  public async load(count: number, limitPerIteration: number, message?: string, emitBlockchainReady = false) {
    let offset = 0;
    if (message) {
      this.logger.warn(message);
      this.logger.warn('Recreating memory tables');
    }

    await this.hookSystem.do_action(RecreateAccountsTables.name);
    // await this.accountLogic.removeTables();

    // await this.accountLogic.createTables();

    try {
      while (count >= offset) {
        if (count > 1) {
          this.logger.info('Rebuilding blockchain, current block height: ' + (offset + 1));
        }
        const lastBlock = await this.blocksProcessModule.loadBlocksOffset(
          Math.min(limitPerIteration, 1 + count - offset), // exclusive limit
          offset,
          true/*verify*/
        );
        offset          = offset + limitPerIteration;
        this.lastblock  = lastBlock;
      }
      if (emitBlockchainReady) {
        this.logger.info('Blockchain ready');
        await this.hookSystem.do_action(OnBlockchainReady.name);
      }
    } catch (err) {
      this.logger.error(err);
      if (err.block) {
        this.logger.error('Blockchain failed at: ' + err.block.height);
        await this.blocksChainModule.deleteAfterBlock(err.block.id);
        this.logger.error('Blockchain clipped');
        await this.hookSystem.do_action(OnBlockchainReady.name);
      } else {
        throw err;
      }
    }

  }

  /**
   * Given a list of peers (with associated blockchain height), we find a list
   * of good peers (likely to sync with), then perform a histogram cut, removing
   * peers far from the most common observed height. This is not as easy as it
   * sounds, since the histogram has likely been made accross several blocks,
   * therefore need to aggregate).
   * Gets the list of good peers.
   */
  private findGoodPeers(peers: Peer[]): {
    height: number, peers: Peer[]
  } {
    const lastBlockHeight: number = this.blocksModule.lastBlock.height;

    this.logger.trace('Good peers - received', { count: peers.length });

    // Removing unreachable peers or heights below last block height
    peers = peers.filter((p) => p !== null && p.height >= lastBlockHeight);

    this.logger.trace('Good peers - filtered', { count: peers.length });

    // No peers found
    if (peers.length === 0) {
      return { height: 0, peers: [] };
    } else {
      // Ordering the peers with descending height
      peers.sort((a, b) => b.height - a.height);

      const histogram = {};
      let max         = 0;
      let height;

      // Aggregating height by 2. TODO: To be changed if node latency increases?
      const aggregation = 2;

      // Histogram calculation, together with histogram maximum
      for (const peer of peers) {
        const val      = Math.floor(peer.height / aggregation) * aggregation;
        histogram[val] = (histogram[val] ? histogram[val] : 0) + 1;

        if (histogram[val] > max) {
          max    = histogram[val];
          height = val;
        }
      }

      // Performing histogram cut of peers too far from histogram maximum
      const peerObjs = peers
        .filter((peer) => peer && Math.abs(height - peer.height) < aggregation + 1);

      this.logger.trace('Good peers - accepted', { count: peerObjs.length });
      this.logger.debug('Good peers', peerObjs.map((p) => p.string));

      return { height, peers: peerObjs };
    }
  }

  /**
   * Cancels timers based on input parameter and private variable syncIntervalId
   * or Sync trigger by sending a socket signal with 'loader/sync' and setting
   * next sync with 1000 milliseconds.
   */
  private syncTrigger(turnOn: boolean) {
    if (turnOn === false && this.syncIntervalId) {
      this.logger.trace('Clearing sync interval');
      clearTimeout(this.syncIntervalId);
      this.syncIntervalId = null;
      this.appState.set('loader.isSyncing', false);
    }
    if (turnOn === true && !this.syncIntervalId) {
      this.logger.trace('Setting sync interval');
      this.syncIntervalId = setTimeout(() => {
        this.logger.trace('Sync trigger');
        this.hookSystem.do_action('pushapi/onNewMessage', 'loader/sync', {
          blocks: this.blocksToSync,
          height: this.blocksModule.lastBlock.height,
        });
      }, 1000);
      this.appState.set('loader.isSyncing', true);
    }
  }

  private async innerLoad() {
    let loaded = false;

    const randomPeer = await this.getRandomPeer();
    const lastBlock  = this.blocksModule.lastBlock;
    if (typeof(randomPeer) === 'undefined') {
      await wait(1000);
      // This could happen when we received a block but we did not get the updated peer list.
      throw new Error('No random peer');
    }

    if (lastBlock.height !== 1) {
      this.logger.info(`Looking for common block with: ${randomPeer.string}`);
      try {
        const commonBlock = await this.blocksProcessModule.getCommonBlock(randomPeer, lastBlock.height);
        if (!commonBlock) {
          throw new Error('Failed to find common block');
        }
      } catch (err) {
        this.logger.error(`Failed to find common block with: ${randomPeer.string}`);
        throw err;
      }
    }
    // Now that we know that peer is reliable we can sync blocks with him!!
    this.blocksToSync = randomPeer.height;
    try {
      const lastValidBlock: SignedBlockType = await this.blocksProcessModule.loadBlocksFromPeer(randomPeer);

      loaded = lastValidBlock.id === lastBlock.id;
      // update blocksmodule last receipt with last block timestamp!
      this.blocksModule.lastReceipt
        .update(Math.floor(this.constants.epochTime.getTime() / 1000 + lastValidBlock.timestamp));
    } catch (err) {
      this.logger.error(err.toString());
      this.logger.error('Failed to load blocks from: ' + randomPeer.string);
      throw err;
    }
    return loaded;
  }

  /**
   * Loads blocks from the network
   */
  private async loadBlocksFromNetwork() {
    let loaded = false;
    do {
      loaded = await promiseRetry(
        (retry) => this.innerLoad().catch(retry),
        { retries: 3, maxTimeout: 2000 }
      )
        .catch((e) => {
          this.logger.warn('Something went wrong when trying to sync block from network', e);
          return true;
        });
    } while (!loaded);

  }

  /**
   * - Undoes unconfirmed transactions.
   * - Establish broadhash consensus
   * - Syncs: loadBlocksFromNetwork, updateSystem
   * - Establish broadhash consensus
   * - Applies unconfirmed transactions
   */
  @WrapInDefaultSequence
  private async sync() {
    this.logger.info('Starting sync');
    await this.hookSystem.do_action('core/loader/onSyncBlocks.started');

    this.isActive = true;
    this.syncTrigger(true);

    // Logic block of "real work"
    {

      // Establish consensus. (internally)
      this.logger.debug('Establishing broadhash consensus before sync');
      await this.broadcasterLogic.getPeers({ limit: this.constants.maxPeers });

      await this.loadBlocksFromNetwork();
      await this.systemModule.update();

      this.logger.debug('Establishing broadhash consensus after sync');
      await this.broadcasterLogic.getPeers({ limit: this.constants.maxPeers });

    }

    this.isActive = false;
    this.syncTrigger(false);
    this.blocksToSync = 0;

    this.logger.info('Finished sync');
    await this.hookSystem.do_action('core/loader/onSyncBlocks.finished');

  }

  private async doSync() {
    const shouldSyncBlocks     = this.loaded && !this.isSyncing && (this.blocksModule.lastReceipt.isStale());
    const whatToSync: string[] = await this.hookSystem
      .apply_filters('core/loader/whatToSync', shouldSyncBlocks ? ['blocks', 'transactions'] : []);
    for (const what of whatToSync) {
      switch (what) {
        case 'blocks':
          await promiseRetry(async (retries) => {
            try {
              await this.sync();
            } catch (err) {
              this.logger.warn('Error syncing... Retrying... ', err);
              retries(err);
            }
          }, { retries: this.retries });
          break;
        case 'transactions':
          this.logger.info('Syncing transactions');
          await this.syncTransactions();
          break;
        default:
          this.logger.info(`Syncing ${what}`);
          await this.hookSystem.do_action('core/loader/onSyncRequested', what);
          break;
      }
    }
  }

  private async syncTimer() {
    this.logger.trace('Setting sync timer');
    this.jobsQueue.register('loaderSyncTimer', async () => {
        this.logger.trace('Sync timer trigger', {
          last_receipt: this.blocksModule.lastReceipt.get(),
          loaded      : this.loaded,
          syncing     : this.isSyncing,
        });
        await this.doSync();
      },
      Math.max(1000, this.constants.blockTime * (1000 / 50))
    );
  }

  /**
   * Tries loading transactions from peers for this.retries times or logs errors
   */
  private async syncTransactions() {
    try {
      await promiseRetry(async (retry) => {
        try {
          await this.loadTransactions();
        } catch (e) {
          this.logger.warn('Error loading transactions... Retrying... ', e);
          retry(e);
        }
      }, { retries: this.retries });
    } catch (e) {
      this.logger.log('Unconfirmed transactions loader error', e);
    }
  }

  /**
   * Load transactions from a random peer.
   * Validates each transaction from peer and eventually remove the peer if invalid.
   */
  private async loadTransactions() {
    // TODO: lerna Move me to core-transactions
    // const peer = await this.getRandomPeer();
    // this.logger.log(`Loading transactions from: ${peer.string}`);
    // const body = await peer.makeRequest<any>(this.gtFactory({ data: null }));
    //
    // if (!this.schema.validate(body, loaderSchema.loadTransactions)) {
    //   throw new Error('Cannot validate load transactions schema against peer');
    // }
    //
    // const { transactions }: { transactions: Array<ITransportTransaction<any>> } = body;
    //
    // const trans = transactions || [];
    // while (trans.length > 0) {
    //   try {
    //     await this.transportModule.receiveTransactions(trans.splice(0, 25), peer, false);
    //   } catch (err) {
    //     this.logger.warn(err);
    //   }
    // }
  }
}
