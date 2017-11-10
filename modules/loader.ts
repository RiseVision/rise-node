import {ITask} from 'pg-promise';
import promiseRetry from 'promise-retry';
import constants from '../helpers/constants';
import jobsQueue from '../helpers/jobsQueue';
import {ILogger} from '../logger';
import {IBus} from '../types/bus';
import {TransactionLogic} from '../logic/transaction';
import {AccountLogic} from '../logic/account';
import {Peers} from '../logic/peers';
import {Peer, PeerType} from '../logic/peer';
import {BlockType, SignedBlockType} from '../logic/block';
import Sequence from '../helpers/sequence';
import {cbToPromise} from '../helpers/promiseToCback';
import {PeersModule} from './peers';
import Timer = NodeJS.Timer;

export type LoaderLibrary = {
  logger: ILogger;
  db: ITask<any>;
  network: any;
  schema: any;
  sequence: Sequence;
  bus: IBus;
  genesisblock: BlockType;
  balancesSequence: any;
  logic: {
    transaction: TransactionLogic;
    account: AccountLogic;
    peers: Peers
  },
  config: {
    loading: {
      verifyOnLoading: boolean;
      snapshot: boolean;
    }
  }
}

export class LoaderModule {

  private network: { height: number, peers: Peer[] };
  private genesisBlock: BlockType = null;
  private lastblock: BlockType    = null;
  private syncIntervalId: Timer   = null;
  private blocksToSync: number    = 0;
  private loaded: boolean         = false;
  private isActive: boolean       = false;

  private modules: { blocks: any, transactions: any, transport: any, peers: PeersModule };

  constructor(public library: LoaderLibrary) {
    this.initialize();
    this.genesisBlock = this.lastblock || this.library.genesisblock;
  }

  public async getNework() {
    if (this.network.height > 0 && Math.abs(this.network.height - this.modules.blocks.lastBlock.get().height) === 1) {
      return this.network;
    }
    const { peers, consensus } = await this.modules.peers.list({});

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
  private findGoodPeers(peers: PeerType[]): { height: number, peers: Peer[] } {
    const lastBlockHeight: number = this.modules.blocks.lastBlock.get().height;
    this.library.logger.trace('Good peers - received', { count: peers.length });

    // Removing unreachable peers or heights below last block height
    peers = peers.filter((p) => p !== null && p.height >= lastBlockHeight);

    this.library.logger.trace('Good peers - filtered', { count: peers.length });

    // No peers found
    if (peers.length === 0) {
      return { height: 0, peers: [] };
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

      this.library.logger.trace('Good peers - accepted', { count: peerObjs.length });
      this.library.logger.debug('Good peers', peerObjs);

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
      this.library.logger.trace('Clearing sync interval');
      clearTimeout(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (turnOn === true && !this.syncIntervalId) {
      this.library.logger.trace('Setting sync interval');
      this.syncIntervalId = setTimeout(() => {
        this.library.logger.trace('Sync trigger');
        this.library.network.io.sockets.emit('loader/sync', {
          blocks: this.blocksToSync,
          height: this.modules.blocks.lastBlock.get().height,
        });
      }, 1000);
    }
  }

  private async loadBlocksFromNetwork() {
    const network = await this.getNework();
    let loaded    = false;
    do {
      await promiseRetry(async (retry) => {
        const randomPeer                 = this.network.peers[Math.floor(Math.random() * this.network.peers.length)];
        const lastBlock: SignedBlockType = this.modules.blocks.lastBlock.get();

        if (lastBlock.height !== 1) {
          this.library.logger.info('Looking for common block with: ' + randomPeer.string);
          try {
            const commonBlock = await cbToPromise((cb) => this.modules
              .blocks.process.getCommonBlock(randomPeer, lastBlock.height, cb));
            if (!commonBlock) {
              this.library.logger.error(`Failed to find common block with: ${randomPeer.string}`);
              return retry(new Error('Failed to fined common block'));
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
          const lastValidBlock: SignedBlockType = await cbToPromise<any>(
            (cb) => this.modules.blocks.process.loadBlocksFromPeer(randomPeer, cb)
          );

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
    this.library.bus.message('syncStarted');

    this.isActive = true;
    this.syncTrigger(true);

    // undo unconfirmedList
    this.library.logger.debug('Undoing unconfirmed transactions before sync');
    await cbToPromise((cb) => this.modules.transactions.undoUnconfirmedList(cb));

    // Establish consensus. (internally)
    this.library.logger.debug('Establishing broadhash consensus before sync');
    await cbToPromise((cb) => this.modules.transport.getPeers({ limit: constants.maxPeers }, cb));

    await this.loadBlocksFromNetwork();
  }

  private async

  syncTimer() {
    this.library.logger.trace('Setting sync timer');

    jobsQueue.register('loaderSyncTimer', async (cb) => {
      this.library.logger.trace('Sync timer trigger', {
        last_receipt: this.modules.blocks.lastReceipt.get(),
        loaded      : this.loaded,
        syncing     : this.syncing(),
      });

      if (this.loaded && !self.syncing() && modules.blocks.lastReceipt.isStale()) {
        await this.library.sequence.addAndPromise(async () => {

        })
        this.library.sequence.addAn(function (sequenceCb) {
          async.retry(this.retries, this.sync, sequenceCb);
        }, function (err) {
          if (err) {
            library.logger.error('Sync timer', err);
            __private.initialize();
          }
          return setImmediate(cb);
        });
      } else {
        return setImmediate(cb);
      }
    }, __private.syncInterval);
  }
}