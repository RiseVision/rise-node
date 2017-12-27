import { inject, injectable, postConstruct, tagged } from 'inversify';
import { IDatabase } from 'pg-promise';
import * as promiseRetry from 'promise-retry';
import z_schema from 'z-schema';
import { Bus, constants as constantsType, ILogger, JobsQueue, Sequence } from '../helpers/';
import {
  IAccountLogic, IAppState, IBroadcasterLogic, IPeerLogic, IPeersLogic, IRoundsLogic,
  ITransactionLogic
} from '../ioc/interfaces/logic';

import {
  IBlocksModule, IBlocksModuleChain, IBlocksModuleProcess, IBlocksModuleUtils, IBlocksModuleVerify, ILoaderModule,
  IMultisignaturesModule,
  IPeersModule,
  ISystemModule,
  ITransactionsModule, ITransportModule
} from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import {
  PeerType,
  SignedAndChainedBlockType,
  SignedBlockType,
} from '../logic/';
import { IBaseTransaction } from '../logic/transactions/';
import loaderSchema from '../schema/loader';
import sql from '../sql/loader';
import { AppConfig } from '../types/genericTypes';
import Timer = NodeJS.Timer;

@injectable()
export class LoaderModule implements ILoaderModule {

  private network: { height: number, peers: IPeerLogic[] };
  private lastblock: SignedAndChainedBlockType = null;
  private syncIntervalId: Timer                = null;
  private blocksToSync: number                 = 0;
  private loaded: boolean                      = false;
  private isActive: boolean                    = false;
  private retries: number                      = 5;
  private syncInterval                         = 1000;

  // Modules
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.blocksSubModules.chain)
  private blocksChainModule: IBlocksModuleChain;
  @inject(Symbols.modules.blocksSubModules.process)
  private blocksProcessModule: IBlocksModuleProcess;
  @inject(Symbols.modules.blocksSubModules.utils)
  private blocksUtilsModule: IBlocksModuleUtils;
  @inject(Symbols.modules.blocksSubModules.verify)
  private blocksVerifyModule: IBlocksModuleVerify;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.modules.transport)
  private transportModule: ITransportModule;
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.multisignatures)
  private multisigModule: IMultisignaturesModule;

  // Helpers and generics
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  @inject(Symbols.generic.zschema)
  private schema: z_schema;
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.defaultSequence)
  private sequence: Sequence;
  @inject(Symbols.helpers.sequence)
  @tagged(Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence)
  private balancesSequence: Sequence;
  @inject(Symbols.helpers.bus)
  private bus: Bus;
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;
  @inject(Symbols.generic.appConfig)
  private config: AppConfig;
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;

  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;
  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: IBroadcasterLogic;
  @inject(Symbols.logic.peers)
  private peersLogic: IPeersLogic;
  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;

  @postConstruct()
  public initialize() {
    this.network = {
      height: 0,
      peers : [],
    };
  }

  public async getNework() {
    if (!(
        this.network.height > 0 &&
        Math.abs(this.network.height - this.blocksModule.lastBlock.height) === 1)
    ) {
      const {peers} = await this.peersModule.list({});
      this.network  = this.findGoodPeers(peers);
    }
    return this.network;
  }

  public async gerRandomPeer(): Promise<IPeerLogic> {
    const {peers} = await this.getNework();
    return peers[Math.floor(Math.random() * peers.length)];
  }

  /**
   * Checks if we're syncing or not.
   */
  private get isSyncing(): boolean {
    return this.appState.get('loader.isSyncing') || false;
  }

  public async onPeersReady() {
    await this.syncTimer();
    if (this.loaded) {
      // Load transactions.
      try {
        await promiseRetry(async (retry) => {
          try {
            await this.loadTransactions();
          } catch (e) {
            this.logger.warn('Error loading transactions... Retrying... ', e);
            retry(e);
          }
        }, {retries: this.retries});
      } catch (e) {
        this.logger.log('Unconfirmed transactions loader error', e);
      }

      // load multisignature transactions
      try {
        await promiseRetry(async (retry) => {
          try {
            await this.loadSignatures();
          } catch (e) {
            this.logger.warn('Error loading transactions... Retrying... ', e);
            retry(e);
          }
        }, {retries: this.retries});
      } catch (e) {
        this.logger.log('Multisig pending transactions loader error', e);
      }
    }

  }

  public onBlockchainReady() {
    this.loaded = true;
  }

  public cleanup() {
    this.loaded = false;
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

    // Check memory tables.
    const results = await this.db.task((t) => t.batch([
      t.one(sql.countBlocks),
      t.query(sql.getGenesisBlock),
      t.one(sql.countMemAccounts),
      t.query(sql.getMemRounds),
      t.query(sql.countDuplicatedDelegates),
    ]));

    const blocksCount = results[0].count;
    this.logger.info(`Blocks ${blocksCount}`);

    if (blocksCount === 1) {
      // Load from start!
      return this.load(1, limit);
    }

    const genesisBlock = results[1][0];
    // If there's a genesis in db lets check its validity against code version
    if (genesisBlock) {
      const matches = (
        genesisBlock.id === this.genesisBlock.id &&
        genesisBlock.payloadHash.toString('hex') === this.genesisBlock.payloadHash &&
        genesisBlock.blockSignature.toString('hex') === this.genesisBlock.blockSignature
      );
      if (!matches) {
        throw new Error('Failed to match genesis block with database');
      }
      this.logger.info('Genesis block matches with database');
    }

    const round = this.roundsLogic.calcRound(blocksCount);

    // Check if we are in verifySnapshot mode.
    if (this.config.loading.snapshot) {
      this.logger.info('Snapshot mode enabled');
      if (this.config.loading.snapshot >= round) {
        this.config.loading.snapshot = round;
        if ((blocksCount === 1) || (blocksCount % this.constants.activeDelegates > 0)) {
          // Normalize to previous round if we
          this.config.loading.snapshot = (round > 1) ? (round - 1) : 1;
        }
        this.appState.set('rounds.snapshot', this.config.loading.snapshot);
      }
      this.logger.info(`Snapshotting to end of round: ${this.config.loading.snapshot}`);
      return this.load(blocksCount, limit, 'Blocks Verification enabled');
    }

    const missedBlocksInMemAccounts = !(results[2].count);

    if (missedBlocksInMemAccounts) {
      return this.load(blocksCount, limit, 'Detected missed blocks in mem_accounts');
    }

    const unapplied = results[3].filter((r) => r.round !== String(round));
    if (unapplied.length > 0) {
      // round is not applied.
      return this.load(blocksCount, limit, 'Detected unapplied rounds in mem_round');
    }

    const duplicatedDelegates = results[4][0].count > 0;
    if (duplicatedDelegates) {
      this.logger.error('Delegates table corrupted with duplicated entries');
      process.emit('exit', 1);
      return;
    }

    const res = await this.db.task((t) => t.batch([
      t.none(sql.updateMemAccounts),
      t.query(sql.getOrphanedMemAccounts),
      t.query(sql.getDelegates),
    ]));

    if (res[1].length > 0) {
      return this.load(blocksCount, limit, 'Detected orphaned blocks in mem_accounts');
    }

    if (res[2].length === 0) {
      return this.load(blocksCount, limit, 'No delegates found');
    }
    try {
      this.lastblock = await this.blocksUtilsModule.loadLastBlock();
      this.logger.info('Blockchain ready');
      await this.bus.message('blockchainReady');
    } catch (err) {
      return this.load(blocksCount, err.message || 'Failed to load last block');
    }
  }

  public async load(count: number, limitPerIteration: number, message?: string) {
    let offset = 0;
    if (message) {
      this.logger.warn(message);
      this.logger.warn('Recreating memory tables');
    }

    await this.accountLogic.removeTables();

    await this.accountLogic.createTables();

    try {
      while (count >= offset) {
        if (count > 1) {
          this.logger.info('Rebuilding blockchain, current block height: ' + (offset + 1));
        }
        const lastBlock = await this.blocksProcessModule.loadBlocksOffset(limitPerIteration, offset, true/*verify*/);
        offset          = offset + limitPerIteration;
        this.lastblock  = lastBlock;
      }
      this.logger.info('Blockchain ready');
      await this.bus.message('blockchainReady');
    } catch (err) {
      this.logger.error(err);
      if (err.block) {
        this.logger.error('Blockchain failed at: ' + err.block.height);
        await this.blocksChainModule.deleteAfterBlock(err.block.id);
        this.logger.error('Blockchain clipped');
        await this.bus.message('blockchainReady');
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
  private findGoodPeers(peers: PeerType[]): {
    height: number, peers: IPeerLogic[]
  } {
    const lastBlockHeight: number = this.blocksModule.lastBlock.height;

    this.logger.trace('Good peers - received', {count: peers.length});

    // Removing unreachable peers or heights below last block height
    peers = peers.filter((p) => p !== null && p.height >= lastBlockHeight);

    this.logger.trace('Good peers - filtered', {count: peers.length});

    // No peers found
    if (peers.length === 0) {
      return {height: 0, peers: []};
    } else {
      // Ordering the peers with descending height
      peers = peers.sort((a, b) => b.height - a.height);

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
        .filter((peer) => peer && Math.abs(height - peer.height) < aggregation + 1)
        .map((peer) => this.peersLogic.create(peer));

      this.logger.trace('Good peers - accepted', {count: peerObjs.length});
      this.logger.debug('Good peers', peerObjs);

      return {height, peers: peerObjs};
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
        this.io.sockets.emit('loader/sync', {
          blocks: this.blocksToSync,
          height: this.blocksModule.lastBlock.height,
        });
      }, 1000);
      this.appState.set('loader.isSyncing', true);
    }
  }

  /**
   * Loads blocks from the network
   */
  private async loadBlocksFromNetwork() {
    let loaded = false;

    do {
      await promiseRetry(async (retry) => {
        const randomPeer                 = await this.gerRandomPeer();
        const lastBlock: SignedBlockType = this.blocksModule.lastBlock;

        if (lastBlock.height !== 1) {
          this.logger.info('Looking for common block with: ' + randomPeer.string);
          try {
            const commonBlock = await this.blocksProcessModule.getCommonBlock(randomPeer, lastBlock.height);
            if (!commonBlock) {
              this.logger.error(`Failed to find common block with: ${randomPeer.string}`);
              return retry(new Error('Failed to find common block'));
            }
          } catch (err) {
            this.logger.error(`Failed to find common block with: ${randomPeer.string}`);
            this.logger.error(err.toString());
            return retry(err);
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
          return retry(err);
        }
      });
    } while (!loaded) ;
  }

  /**
   * - Undoes unconfirmed transactions.
   * - Establish broadhash consensus
   * - Syncs: loadBlocksFromNetwork, updateSystem
   * - Establish broadhash consensus
   * - Applies unconfirmed transactions
   */
  private async sync() {
    this.logger.info('Starting sync');
    await this.bus.message('syncStarted');

    this.isActive = true;
    this.syncTrigger(true);

    // Logic block of "real work"
    {
      // undo unconfirmedList
      this.logger.debug('Undoing unconfirmed transactions before sync');
      await this.transactionsModule.undoUnconfirmedList();

      // Establish consensus. (internally)
      this.logger.debug('Establishing broadhash consensus before sync');
      await this.broadcasterLogic.getPeers({ limit: this.constants.maxPeers });

      await this.loadBlocksFromNetwork();
      await this.systemModule.update();

      this.logger.debug('Establishing broadhash consensus after sync');
      await this.broadcasterLogic.getPeers({ limit: this.constants.maxPeers });

      await this.transactionsModule.applyUnconfirmedList();
    }

    this.isActive = false;
    this.syncTrigger(false);
    this.blocksToSync = 0;

    this.logger.info('Finished sync');
    await this.bus.message('syncFinished');
  }

  private async syncTimer() {
    this.logger.trace('Setting sync timer');

    JobsQueue.register('loaderSyncTimer', async () => {
      this.logger.trace('Sync timer trigger', {
        last_receipt: this.blocksModule.lastReceipt.get(),
        loaded      : this.loaded,
        syncing     : this.isSyncing,
      });

      if (this.loaded && !this.isSyncing && this.blocksModule.lastReceipt.isStale()) {
        await this.sequence.addAndPromise(() => promiseRetry(async (retries) => {
          try {
            await this.sync();
          } catch (err) {
            this.logger.warn('Error syncing... Retrying... ', err);
            retries(err);
          }
        }, {retries: this.retries}));
      }
    }, this.syncInterval);
  }

  /**
   * Loads pending multisignature transactions
   */
  private async loadSignatures() {
    const randomPeer = await this.gerRandomPeer();
    this.logger.log(`Loading signatures from: ${randomPeer.string}`);
    const res = await this.transportModule.getFromPeer<any>(
      randomPeer,
      {
        api   : '/signatures',
        method: 'GET',
      });

    if (!this.schema.validate(res.body, loaderSchema.loadSignatures)) {
      throw new Error('Failed to validate /signatures schema');
    }

    // FIXME: signatures array
    const {signatures}: { signatures: any[] } = res.body;

    // Process multisignature transactions and validate signatures in sequence
    await this.sequence.addAndPromise(async () => {
      for (const multiSigTX of signatures) {
        for (const signature of  multiSigTX.signatures) {
          try {
            await this.multisigModule.processSignature({
              signature,
              transaction: multiSigTX.transaction,
            });
          } catch (err) {
            this.logger.warn(`Cannot process multisig signature for ${multiSigTX.transaction} `, err);
          }
        }
      }
      return void 0;
    });
  }

  /**
   * Load transactions from a random peer.
   * Validates each transaction from peer and eventually remove the peer if invalid.
   */
  private async loadTransactions() {
    const peer = await this.gerRandomPeer();
    this.logger.log(`Loading transactions from: ${peer.string}`);
    const res = await this.transportModule.getFromPeer<any>(peer, {
      api   : '/transactions',
      method: 'GET',
    });

    if (!this.schema.validate(res.body, loaderSchema.loadTransactions)) {
      throw new Error('Cannot validate load transactions schema against peer');
    }

    const {transactions}: { transactions: Array<IBaseTransaction<any>> } = res.body;
    for (const tx of transactions) {
      try {
        // Perform validation and throw if error
        this.transactionLogic.objectNormalize(tx);
      } catch (e) {
        this.logger.debug('Transaction normalization failed', {err: e.toString(), module: 'loader', tx});

        this.logger.warn(['Transaction', tx.id, 'is not valid, peer removed'].join(' '), peer.string);

        // Remove invalid peer as a mechanism to discourage invalid processing.
        this.peersModule.remove(peer.ip, peer.port);
        throw e;
      }
    }

    // Process unconfirmed transaction
    for (const tx of transactions) {
      await
        this.balancesSequence.addAndPromise(async () => {
          try {
            await this.transactionsModule.processUnconfirmedTransaction(tx, false, true);
          } catch (err) {
            this.logger.debug(err);
          }
        });
    }

  }
}
