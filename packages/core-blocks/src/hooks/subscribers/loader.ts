import {
  IBlocksModule,
  ILogger,
  ISequence,
  ITimeToEpoch,
  Symbols
} from '@risevision/core-interfaces';
import { IPeersModule, p2pSymbols, Peer } from '@risevision/core-p2p';
import { wait, WrapInDefaultSequence } from '@risevision/core-utils';
import { decorate, inject, injectable, named } from 'inversify';
import { OnWPAction, OnWPFilter, WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import * as promiseRetry from 'promise-retry';
import { BlocksSymbols } from '../../blocksSymbols';
import { BlocksModuleProcess, BlocksModuleUtils } from '../../modules';
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
  @inject(p2pSymbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(BlocksSymbols.modules.blocks)
  private blocksModule: IBlocksModule;

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
    if (this.blocksModule.lastReceipt.isStale()) {
      return toSync.concat('blocks');
    }
    return toSync;
  }

  @OnWPAction('core/loader/onSyncRequested')
  public async onSyncRequested(what: string, peerProvider: () => Promise<Peer>) {
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

    // Establish consensus. (internally)
    this.logger.debug('Establishing broadhash consensus before sync');
    await this.peersModule.updateConsensus();

    await this.loadBlocksFromNetwork(peerProvider);

    this.logger.debug('Establishing broadhash consensus after sync');
    await this.peersModule.updateConsensus();
  }

  /**
   * Loads blocks from the network
   */
  private async loadBlocksFromNetwork(peerProvider: () => Promise<Peer>) {
    let loaded = false;
    do {
      loaded = await promiseRetry(
        (retry) => this.innerLoad(peerProvider).catch(retry),
        { retries: 3, maxTimeout: 50000 }
      )
        .catch((e) => {
          this.logger.warn('Something went wrong when trying to sync block from network', e);
          return true;
        });
    } while (!loaded);

  }

  private async innerLoad(peerProvider: () => Promise<Peer>) {
    let loaded = false;

    const randomPeer = await peerProvider();
    const lastBlock  = this.blocksModule.lastBlock;
    if (typeof(randomPeer) === 'undefined') {
      await wait(1000);
      // This could happen when we received a block but we did not get the updated peer list.
      throw new Error('No random peer');
    }

    if (lastBlock.height !== 1) {
      this.logger.info(`Looking for common block with: ${randomPeer.string}`);
      try {
        const commonBlock = await this.blocksModuleProcess.getCommonBlock(randomPeer, lastBlock.height);
        if (!commonBlock) {
          throw new Error('Failed to find common block');
        }
      } catch (err) {
        this.logger.error(`Failed to find common block with: ${randomPeer.string}`);
        throw err;
      }
    }
    // Now that we know that peer is reliable we can sync blocks with him!!
    // this.blocksToSync = randomPeer.height;
    try {
      const lastValidBlock = await this.blocksModuleProcess.loadBlocksFromPeer(randomPeer);

      loaded = lastValidBlock.id === lastBlock.id;
      // update blocksmodule last receipt with last block timestamp!
      this.blocksModule.lastReceipt
        .update(Math.floor(this.timeToEpoch.fromTimeStamp(lastValidBlock.timestamp)));
    } catch (err) {
      this.logger.error(err.toString());
      this.logger.error('Failed to load blocks from: ' + randomPeer.string);
      throw err;
    }
    return loaded;
  }

}
