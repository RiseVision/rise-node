import {
  BlocksConstantsType,
  BlocksModuleChain,
  BlocksModuleProcess,
  BlocksSymbols,
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
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { BroadcasterLogic, IPeersModule, Peer } from '@risevision/core-p2p';
import { AppConfig, SignedAndChainedBlockType } from '@risevision/core-types';
import { logOnly } from '@risevision/core-utils';
import { inject, injectable, named, postConstruct } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import SocketIO from 'socket.io';
import z_schema from 'z-schema';
import {
  OnBlockchainReady,
  OnCheckIntegrity,
  OnSyncRequested,
  RecreateAccountsTables,
  RestoreUnconfirmedEntries,
  WhatToSync,
} from '../hooks';

@injectable()
export class LoaderModule implements ILoaderModule {
  /**
   * Checks if we're syncing or not.
   */
  public get isSyncing(): boolean {
    return this.appState.get('loader.isSyncing') || false;
  }
  // tslint:disable-next-line member-ordering
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.defaultSequence)
  public defaultSequence: ISequence;
  private network: { height: number; peers: Peer[] };

  // Generic
  @inject(Symbols.generic.appConfig)
  private config: AppConfig;
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  @inject(Symbols.generic.hookSystem)
  private hookSystem: WordPressHookSystem;

  @inject(BlocksSymbols.constants)
  private constants: BlocksConstantsType;
  @inject(Symbols.helpers.jobsQueue)
  private jobsQueue: IJobsQueue;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.generic.zschema)
  private schema: z_schema;

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
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  // Models
  @inject(ModelSymbols.model)
  @named(Symbols.models.accounts)
  private AccountsModel: typeof IAccountsModel;
  @inject(ModelSymbols.model)
  @named(Symbols.models.blocks)
  private BlocksModel: typeof IBlocksModel;

  @postConstruct()
  public initialize() {
    this.network = {
      height: 0,
      peers: [],
    };
  }

  public getNetwork() {
    if (
      !(
        this.network.height > 0 &&
        Math.abs(this.network.height - this.blocksModule.lastBlock.height) === 1
      )
    ) {
      const peers = this.peersModule.getPeers({});
      this.network = this.peersModule.findGoodPeers(peers);
    }
    return this.network;
  }

  public getRandomPeer(): Peer {
    const { peers } = this.getNetwork();
    if (peers.length === 0) {
      throw new Error('No acceptable peers for the operation');
    }
    return peers[Math.floor(Math.random() * peers.length)];
  }

  public cleanup() {
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

    const genesisBlock = await this.BlocksModel.findOne({
      where: { height: 1 },
    });
    // If there's a genesis in db lets check its validity against code version
    if (genesisBlock) {
      const matches =
        genesisBlock.id === this.genesisBlock.id &&
        genesisBlock.payloadHash.equals(this.genesisBlock.payloadHash) &&
        genesisBlock.blockSignature.equals(this.genesisBlock.blockSignature);
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

    await this.hookSystem.do_action(RestoreUnconfirmedEntries.name);

    try {
      await this.hookSystem.do_action(OnCheckIntegrity.name, blocksCount);
    } catch (e) {
      return this.load(blocksCount, limit, e.message, true);
    }

    this.blocksModule.lastBlock = await this.BlocksModel.findOne({
      limit: 1,
      order: [['height', 'desc']],
    });

    this.logger.info('Blockchain ready');
    await this.hookSystem.do_action(OnBlockchainReady.name);
    this.syncTimer();
  }

  public async load(
    count: number,
    limitPerIteration: number,
    message?: string,
    emitBlockchainReady = false,
    offset: number = 0
  ) {
    if (message) {
      this.logger.warn(message);
      this.logger.warn('Recreating memory tables');
    }

    if (offset > 0) {
      this.blocksModule.lastBlock = await this.BlocksModel.findOne({
        where: {
          height: offset,
        },
      });
      offset += 1;
    } else {
      await this.hookSystem.do_action(RecreateAccountsTables.name);
    }
    while (count >= offset) {
      if (count > 1) {
        this.logger.info(
          'Rebuilding blockchain, current block height: ' + offset
        );
      }
      await this.blocksProcessModule.loadBlocksOffset(
        Math.min(limitPerIteration, 1 + count - offset), // exclusive limit
        offset,
        true /*verify*/
      );
      offset = offset + limitPerIteration;
    }
    if (emitBlockchainReady) {
      this.logger.info('Blockchain ready');
      await this.hookSystem.do_action(OnBlockchainReady.name);
      this.syncTimer();
    }
  }

  private async verifySnapshot(blocksCount: number, limit: number) {
    this.logger.info('Snapshot mode enabled');

    blocksCount = await this.hookSystem.apply_filters(
      'core/loader/snapshot/blocksCount',
      blocksCount
    );

    this.config.loading.snapshot = blocksCount;
    this.appState.set('rounds.snapshot', blocksCount);

    this.logger.info(
      `Snapshotting to end of round: ${this.config.loading.snapshot}`,
      blocksCount
    );

    await this.load(
      blocksCount,
      limit,
      'Blocks Verification enabled',
      false,
      process.env.OFFSET ? parseInt(process.env.OFFSET, 10) : 0
    );

    if (this.blocksModule.lastBlock.height !== blocksCount) {
      // tslint:disable-next-line max-line-length
      this.logger.error(
        `LastBlock height does not expected block. Expected: ${blocksCount} - Received: ${
          this.blocksModule.lastBlock.height
        }`
      );
      process.exit(1);
    }

    // Clip blockchain
    await this.blocksChainModule.deleteAfterBlock(
      this.blocksModule.lastBlock.height
    );
  }

  private async doSync() {
    const whatToSync: string[] = await this.hookSystem.apply_filters(
      WhatToSync.name,
      []
    );
    for (const what of whatToSync) {
      this.logger.info(`Syncing ${what}`);
      await this.hookSystem.do_action(OnSyncRequested.name, what, () =>
        this.getRandomPeer()
      );
    }
  }

  private syncTimer() {
    this.logger.trace('Setting sync timer');
    this.jobsQueue.register(
      'loaderSyncTimer',
      async () => {
        this.logger.trace('Sync timer trigger', {
          syncing: this.isSyncing,
        });
        this.appState.set('loader.isSyncing', true);
        await this.doSync().catch(logOnly(this.logger));
        this.appState.set('loader.isSyncing', false);
      },
      Math.max(1000, this.constants.targetTime * (1000 / 50))
    );
  }
}
