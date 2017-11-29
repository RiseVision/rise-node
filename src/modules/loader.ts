import { IDatabase } from 'pg-promise';
import * as promiseRetry from 'promise-retry';
import z_schema from 'z-schema';
import sql from '../../sql/loader';
import { Bus, cbToPromise, constants, emptyCB, ILogger, JobsQueue, Sequence } from '../helpers/';
import {
  AccountLogic, Peer, Peers, PeerType, SignedAndChainedBlockType, SignedBlockType,
  TransactionLogic
} from '../logic/';
import { IBaseTransaction } from '../logic/transactions/';
import loaderSchema from '../schema/loader';
import { AppConfig } from '../types/genericTypes';
import { BlocksModule } from './blocks';
import { PeersModule } from './peers';
import { RoundsModule } from './rounds';
import { TransactionsModule } from './transactions';
import { TransportModule } from './transport';
import Timer = NodeJS.Timer;

// tslint:disable-next-line
export type LoaderLibrary = {
  logger: ILogger;
  db: IDatabase<any>;
  io: SocketIO.Server;
  schema: z_schema;
  sequence: Sequence;
  bus: Bus;
  genesisblock: SignedAndChainedBlockType;
  balancesSequence: Sequence;
  logic: {
    transaction: TransactionLogic;
    account: AccountLogic;
    peers: Peers
  },
  config: AppConfig
};

export class LoaderModule {

  private network: { height: number, peers: Peer[] };
  private genesisBlock: SignedAndChainedBlockType = null;
  private lastblock: SignedAndChainedBlockType    = null;
  private syncIntervalId: Timer                   = null;
  private blocksToSync: number                    = 0;
  private loaded: boolean                         = false;
  private isActive: boolean                       = false;
  private retries: number                         = 5;
  private syncInterval                            = 1000;

  private modules: {
    blocks: BlocksModule,
    rounds: RoundsModule, system: any, transactions: TransactionsModule, transport: TransportModule,
    peers: PeersModule,
    multisignatures: any
  };

  constructor(public library: LoaderLibrary) {
    this.initialize();
    this.genesisBlock = this.library.genesisblock;
  }

  public async getNework() {
    if (!(
        this.network.height > 0 &&
        Math.abs(this.network.height - this.modules.blocks.lastBlock.height) === 1)
    ) {
      const {peers} = await this.modules.peers.list({});
      this.network  = this.findGoodPeers(peers);
    }
    return this.network;
  }

  public async gerRandomPeer(): Promise<Peer> {
    const {peers} = await this.getNework();
    return peers[Math.floor(Math.random() * peers.length)];
  }

  /**
   * Checks if we're syncing or not.
   */
  public get isSyncing(): boolean {
    return !!this.syncIntervalId;
  }

  public async onBind(modules: any) {
    this.modules = {
      blocks         : modules.blocks,
      multisignatures: modules.multisignatures,
      peers          : modules.peers,
      rounds         : modules.rounds,
      system         : modules.system,
      transactions   : modules.transactions,
      transport      : modules.transport,
    };
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
            retry(e);
          }
        }, {retries: this.retries});
      } catch (e) {
        this.library.logger.log('Unconfirmed transactions loader error', e);
      }

      // load multisignature transactions
      try {
        await promiseRetry(async (retry) => {
          try {
            await this.loadSignatures();
          } catch (e) {
            retry(e);
          }
        }, {retries: this.retries});
      } catch (e) {
        this.library.logger.log('Multisig pending transactions loader error', e);
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
  public async loadBlockChain() {
    const limit = Number(this.library.config.loading.loadPerIteration) || 1000;
    // const verify   = Boolean(this.library.config.loading.verifyOnLoading);

    // Check memory tables.
    const results = await this.library.db.task((t) => t.batch([
      t.one(sql.countBlocks),
      t.query(sql.getGenesisBlock),
      t.one(sql.countMemAccounts),
      t.query(sql.getMemRounds),
      t.query(sql.countDuplicatedDelegates),
    ]));

    const blocksCount = results[0].count;
    this.library.logger.info(`Blocks ${blocksCount}`);

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
      this.library.logger.info('Genesis block matches with database');
    }

    const round = this.modules.rounds.calcRound(blocksCount);

    // Check if we are in verifySnapshot mode.
    if (this.library.config.loading.snapshot) {
      this.library.logger.info('Snapshot mode enabled');
      if (this.library.config.loading.snapshot >= round) {
        this.library.config.loading.snapshot = round;
        if ((blocksCount === 1) || (blocksCount % constants.activeDelegates > 0)) {
          // Normalize to previous round if we
          this.library.config.loading.snapshot = (round > 1) ? (round - 1) : 1;
        }
        this.modules.rounds.setSnapshotRounds(this.library.config.loading.snapshot);
      }
      this.library.logger.info(`Snapshotting to end of round: ${this.library.config.loading.snapshot}`);
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
      this.library.logger.error('Delegates table corrupted with duplicated entries');
      return process.emit('exit', 1);
    }

    const res = await this.library.db.task((t) => t.batch([
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
      this.lastblock = await this.modules.blocks.utils.loadLastBlock();
      this.library.logger.info('Blockchain ready');
      await this.library.bus.message('blockchainReady');
    } catch (err) {
      return this.load(blocksCount, err.message || 'Failed to load last block');
    }
  }

  private async load(count: number, limitPerIteration: number, message?: string) {
    let offset = 0;
    if (message) {
      this.library.logger.warn(message);
      this.library.logger.warn('Recreating memory tables');
    }

    await this.library.logic.account.removeTables(emptyCB);

    await this.library.logic.account.createTables(emptyCB);

    try {
      while (count >= offset) {
        if (count > 1) {
          this.library.logger.info('Rebuilding blockchain, current block height: ' + (offset + 1));
        }
        const lastBlock = await this.modules.blocks.process.loadBlocksOffset(limitPerIteration, offset, true/*verify*/);
        offset          = offset + limitPerIteration;
        this.lastblock  = lastBlock;
      }
      this.library.logger.info('Blockchain ready');
      await this.library.bus.message('blockchainReady');
    } catch (err) {
      this.library.logger.error(err);
      if (err.block) {
        this.library.logger.error('Blockchain failed at: ' + err.block.height);
        await this.modules.blocks.chain.deleteAfterBlock(err.block.id);
        this.library.logger.error('Blockchain clipped');
        await this.library.bus.message('blockchainReady');
      }
    }

  }

  private initialize() {
    this.network = {
      height: 0,
      peers : [],
    };
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
    height: number, peers: Peer[]
  } {
    const lastBlockHeight: number = this.modules.blocks.lastBlock.height;

    this.library.logger.trace('Good peers - received', {count: peers.length});

    // Removing unreachable peers or heights below last block height
    peers = peers.filter((p) => p !== null && p.height >= lastBlockHeight);

    this.library.logger.trace('Good peers - filtered', {count: peers.length});

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
        .map((peer) => this.library.logic.peers.create(peer));

      this.library.logger.trace('Good peers - accepted', {count: peerObjs.length});
      this.library.logger.debug('Good peers', peerObjs);

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
      this.library.logger.trace('Clearing sync interval');
      clearTimeout(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (turnOn === true && !this.syncIntervalId) {
      this.library.logger.trace('Setting sync interval');
      this.syncIntervalId = setTimeout(() => {
        this.library.logger.trace('Sync trigger');
        this.library.io.sockets.emit('loader/sync', {
          blocks: this.blocksToSync,
          height: this.modules.blocks.lastBlock.height,
        });
      }, 1000);
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
        const lastBlock: SignedBlockType = this.modules.blocks.lastBlock;

        if (lastBlock.height !== 1) {
          this.library.logger.info('Looking for common block with: ' + randomPeer.string);
          try {
            const commonBlock = await this.modules.blocks.process.getCommonBlock(randomPeer, lastBlock.height);
            if (!commonBlock) {
              this.library.logger.error(`Failed to find common block with: ${randomPeer.string}`);
              return retry(new Error('Failed to find common block'));
            }
          } catch (err) {
            this.library.logger.error(`Failed to find common block with: ${randomPeer.string}`);
            this.library.logger.error(err.toString());
            return retry(err);
          }
        }

        // Now that we know that peer is reliable we can sync blocks with him!!
        this.blocksToSync = randomPeer.height;
        try {
          const lastValidBlock: SignedBlockType = await this.modules.blocks.process.loadBlocksFromPeer(randomPeer);

          loaded = lastValidBlock.id === lastBlock.id;
        } catch (err) {
          this.library.logger.error(err.toString());
          this.library.logger.error('Failed to load blocks from: ' + randomPeer.string);
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
    this.library.logger.info('Starting sync');
    await this.library.bus.message('syncStarted');

    this.isActive = true;
    this.syncTrigger(true);

    // undo unconfirmedList
    this.library.logger.debug('Undoing unconfirmed transactions before sync');
    await this.modules.transactions.undoUnconfirmedList();

    // Establish consensus. (internally)
    this.library.logger.debug('Establishing broadhash consensus before sync');
    this.modules.transport.getPeers({limit: constants.maxPeers});

    await this.loadBlocksFromNetwork();
  }

  private async syncTimer() {
    this.library.logger.trace('Setting sync timer');

    JobsQueue.register('loaderSyncTimer', async (cb) => {
      this.library.logger.trace('Sync timer trigger', {
        last_receipt: this.modules.blocks.lastReceipt.get(),
        loaded      : this.loaded,
        syncing     : this.isSyncing,
      });

      if (this.loaded && !this.isSyncing && this.modules.blocks.lastReceipt.isStale()) {
        await this.library.sequence.addAndPromise(() => promiseRetry(async (retries) => {
          try {
            await this.sync();
          } catch (err) {
            retries(err);
          }
        }, {retries: this.retries}));
      }
      return setImmediate(cb);
    }, this.syncInterval);
  }

  /**
   * Loads pending multisignature transactions
   */
  private async loadSignatures() {
    const randomPeer = await this.gerRandomPeer();
    this.library.logger.log(`Loading signatures from: ${randomPeer.string}`);
    const res = await this.modules.transport.getFromPeer<any>(
      randomPeer,
      {
        api   : '/signatures',
        method: 'GET',
      });

    if (!this.library.schema.validate(res.body, loaderSchema.loadSignatures)) {
      throw new Error('Failed to validate /signatures schema');
    }

    // FIXME: signatures array
    const {signatures}: { signatures: any[] } = res.body;

    // Process multisignature transactions and validate signatures in sequence
    await
      this.library.sequence.addAndPromise(async () => {
        for (const multiSigTX of signatures) {
          for (const signature of  multiSigTX.signatures) {
            try {
              await cbToPromise((cb) => this.modules.multisignatures.processSignature({
                signature,
                transaction: multiSigTX.transaction,
              }, cb));
            } catch (err) {
              this.library.logger.warn(`Cannot process multisig signature for ${multiSigTX.transaction} `, err);
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
    this.library.logger.log(`Loading transactions from: ${peer.string}`);
    const res = await this.modules.transport.getFromPeer<any>(peer, {
      api   : '/transactions',
      method: 'GET',
    });

    if (!this.library.schema.validate(res.body, loaderSchema.loadTransactions)) {
      throw new Error('Cannot validate load transactions schema against peer');
    }

    const {transactions}: { transactions: Array<IBaseTransaction<any>> } = res.body;
    for (const tx of transactions) {
      try {
        // Perform validation and throw if error
        this.library.logic.transaction.objectNormalize(tx);
      } catch (e) {
        this.library.logger.debug('Transaction normalization failed', {err: e.toString(), module: 'loader', tx});

        this.library.logger.warn(['Transaction', tx.id, 'is not valid, peer removed'].join(' '), peer.string);

        // Remove invalid peer as a mechanism to discourage invalid processing.
        this.modules.peers.remove(peer.ip, peer.port);
        throw e;
      }
    }

    // Process unconfirmed transaction
    for (const tx of transactions) {
      await
        this.library.balancesSequence.addAndPromise(async () => {
          try {
            await this.modules.transactions.processUnconfirmedTransaction(tx, false, true);
          } catch (err) {
            this.library.logger.debug(err);
          }
        });
    }

  }
}
