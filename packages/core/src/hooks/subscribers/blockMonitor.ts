import { OnBlockApplied, OnDestroyBlock } from '@risevision/core-blocks';
import { IPeersModule } from '@risevision/core-p2p';
import {
  IBlocksModule,
  ISystemModule,
  SignedAndChainedBlockType,
  Symbols,
} from '@risevision/core-types';
import { decorate, inject, injectable } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { OnBlockchainReady } from '../actions';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class BlockMonitor extends Extendable {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;

  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  @OnBlockchainReady()
  public async onBlockchainReady() {
    return this.onNewBlock(this.blocksModule.lastBlock, false);
  }

  @OnBlockApplied()
  public async onNewBlock(
    block: SignedAndChainedBlockType,
    broadcast: boolean
  ) {
    await this.systemModule.update(block);
    this.peersModule.updateConsensus();
  }

  @OnDestroyBlock(100)
  public async onDestroyBlock(
    ignored: SignedAndChainedBlockType,
    newLastBlock: SignedAndChainedBlockType
  ) {
    await this.systemModule.update(newLastBlock);
    this.peersModule.updateConsensus();
  }
}
