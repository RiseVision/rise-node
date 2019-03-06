import { IPeersModule, p2pSymbols, Peer } from '@risevision/core-p2p';
import {
  IAccountsModule,
  IAppState,
  IBlocksModule,
  ILogger,
  ISequence,
  ITimeToEpoch,
  SignedAndChainedBlockType,
  Symbols,
} from '@risevision/core-types';
import { WrapInDefaultSequence } from '@risevision/core-utils';
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
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
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

  // Alias promiseRetry so it could be stubbed out in tests
  private promiseRetry = promiseRetry;

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
    const chainBackup: SignedAndChainedBlockType[] = [];

    try {
      const retryOpts = {
        maxTimeout: 50000,
        retries: 3,
      };

      let inSyncWithNetwork = false;
      while (!inSyncWithNetwork) {
        inSyncWithNetwork = await this.promiseRetry(async (retry) => {
          const syncPeer = await peerProvider();
          if (typeof syncPeer === 'undefined') {
            // This could happen when we received a block but we did not get the updated peer list.
            return retry(new Error('No random peer to sync with'));
          }

          return this.syncWithPeer(syncPeer, chainBackup).catch(retry);
        }, retryOpts);
      }
    } catch (err) {
      this.logger.warn(
        'Something went wrong when trying to sync with network',
        err
      );
    }

    // Restore chain from the backup if we ended up on a shorter fork or the sync process failed
    if (
      chainBackup.length > 0 &&
      this.blocksModule.lastBlock.height < chainBackup[0].height
    ) {
      let lastBlock = this.blocksModule.lastBlock;
      this.logger.info('Starting to restore local chain before sync', {
        backupTopHeight: chainBackup[0].height,
        backupTopId: chainBackup[0].id,
        postSyncTopHeight: lastBlock.height,
        postSyncTopId: lastBlock.id,
      });
      try {
        // Rollback chain until we find a common block to backup from
        let restoreFromIdx = -1;
        while (restoreFromIdx < 0) {
          restoreFromIdx = chainBackup.findIndex(
            (blk) =>
              blk.previousBlock === lastBlock.id &&
              blk.height - 1 === lastBlock.height
          );
          if (restoreFromIdx < 0) {
            lastBlock = await this.blocksChainModule.deleteLastBlock();
          }
        }

        // Apply backed up blocks (skipping verification)
        chainBackup.splice(restoreFromIdx + 1);
        while (chainBackup.length > 0) {
          const block = chainBackup.pop();
          const accountsMap = await this.accountsModule.txAccounts(
            block.transactions
          );
          await this.blocksChainModule.applyBlock(
            block,
            false,
            true,
            accountsMap
          );
        }

        this.logger.info('Successfully restored local chain to pre-sync state');
      } catch (err) {
        this.logger.error('Failed to restore local chain from backup', err);
      }
    }
  }

  private async syncWithPeer(
    syncPeer: Peer,
    chainBackup: SignedAndChainedBlockType[]
  ): Promise<boolean> {
    let lastBlock = this.blocksModule.lastBlock;

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
            // Backup the local chain from the start of the sync process, avoid backing up blocks
            // from different forks if we're unlucky enough to have to rollback multiple times
            // per sync pass.
            if (
              chainBackup.length === 0 ||
              chainBackup[chainBackup.length - 1].previousBlock === lastBlock.id
            ) {
              chainBackup.push(lastBlock);
            }
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
