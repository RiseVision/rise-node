import {
  IAppState,
  IBlocksModule,
  ILogger,
  ISequence,
  ITimeToEpoch,
  Symbols,
} from '@risevision/core-interfaces';
import { IPeersModule, p2pSymbols, Peer } from '@risevision/core-p2p';
import { wait, WrapInDefaultSequence } from '@risevision/core-utils';
import { decorate, inject, injectable, named } from 'inversify';
import {
  OnWPAction,
  OnWPFilter,
  WordPressHookSystem,
  WPHooksSubscriber,
} from 'mangiafuoco';
import * as promiseRetry from 'promise-retry';
import { BlocksSymbols } from '../../blocksSymbols';
import {
  BlocksModuleChain,
  BlocksModuleProcess,
  BlocksModuleUtils,
} from '../../modules';
import { GetBlocksRequest } from '../../p2p';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class BlockLoader extends Extendable {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.defaultSequence)
  public defaultSequence: ISequence;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.logic.appState)
  private appStateLogic: IAppState;
  @inject(p2pSymbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(BlocksSymbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(BlocksSymbols.modules.chain)
  private blocksChainModule: BlocksModuleChain;

  @inject(BlocksSymbols.modules.process)
  private blocksModuleProcess: BlocksModuleProcess;

  @inject(BlocksSymbols.modules.utils)
  private blocksModuleUtils: BlocksModuleUtils;

  @inject(p2pSymbols.transportMethod)
  @named(BlocksSymbols.p2p.getBlocks)
  private getBlocksRequest: GetBlocksRequest;

  @inject(Symbols.helpers.timeToEpoch)
  private timeToEpoch: ITimeToEpoch;

  @OnWPAction('core/loader/loadBlockchain/checkIntegrity')
  public async checkBlocksIntegrity(totalBlocks: number) {
    await this.blocksModuleUtils.loadLastBlock();
  }

  @OnWPFilter('core/loader/whatToSync')
  public async whatToSync(toSync: string[]) {
    if (this.blocksModule.isStale()) {
      return toSync.concat('blocks');
    }
    return toSync;
  }

  @OnWPAction('core/loader/onSyncRequested')
  public async onSyncRequested(
    what: string,
    peerProvider: () => Promise<Peer>
  ) {
    if (what !== 'blocks') {
      return;
    }
    await this.sync(peerProvider);
  }

  /**
   * - Undoes unconfirmed transactions.
   * - Establish broadhash consensus
   * - Syncs: loadBlocksFromNetwork, updateSystem
   * - Establish broadhash consensus
   * - Applies unconfirmed transactions
   */
  @WrapInDefaultSequence
  private async sync(peerProvider: () => Promise<Peer>) {
    this.logger.info('Starting block sync');

    await this.syncWithNetwork(peerProvider);
  }

  /**
   * Loads blocks from the network
   */
  private async syncWithNetwork(
    peerProvider: () => Promise<Peer>
  ): Promise<void> {
    try {
      let inSyncWithNetwork;
      do {
        inSyncWithNetwork = await promiseRetry(
          (retry) => this.syncWithPeer(peerProvider).catch(retry),
          { retries: 3, maxTimeout: 50000 }
        );
      } while (!inSyncWithNetwork);
    } catch (err) {
      this.logger.warn(
        'Something went wrong when trying to sync with network',
        err
      );
    }
  }

  private async syncWithPeer(
    peerProvider: () => Promise<Peer>
  ): Promise<boolean> {
    const syncPeer = await peerProvider();
    let lastBlock = this.blocksModule.lastBlock;

    if (typeof syncPeer === 'undefined') {
      await wait(1000);
      // This could happen when we received a block but we did not get the updated peer list.
      throw new Error('No random peer to sync with');
    }

    if (lastBlock.height !== 1) {
      this.logger.info(`Looking for common block with: ${syncPeer.string}`);
      let commonBlock;
      try {
        commonBlock = await this.blocksModuleProcess.getCommonBlock(
          syncPeer,
          lastBlock.height
        );
      } catch (err) {
        this.logger.error(
          `Failed to find common block with: ${syncPeer.string}`
        );
        throw err;
      }
      // Rollback local chain to last common block with peer if we appear to be on a fork
      if (
        syncPeer.height > lastBlock.height &&
        lastBlock.height > commonBlock.height
      ) {
        try {
          while (lastBlock.height > commonBlock.height) {
            lastBlock = await this.blocksChainModule.deleteLastBlock();
          }
          this.logger.error('Rollback complete, new last block', lastBlock.id);
        } catch (err) {
          this.logger.error('Rollback failed', err);
          throw err;
        }
      }
    }

    // Fetch new blocks from peer
    const prevBlock = lastBlock;
    try {
      await this.blocksModuleProcess.loadBlocksFromPeer(syncPeer);
    } catch (err) {
      this.logger.error(err.toString());
      this.logger.error('Failed to load blocks from: ' + syncPeer.string);
      throw err;
    }
    lastBlock = this.blocksModule.lastBlock;
    const inSyncWithPeer =
      lastBlock.height >= syncPeer.height || prevBlock.id === lastBlock.id;
    return inSyncWithPeer;
  }
}
