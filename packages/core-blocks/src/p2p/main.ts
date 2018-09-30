import { ILogger, ISystemModule, Symbols } from '@risevision/core-interfaces';
import { IBroadcasterLogic, p2pSymbols } from '@risevision/core-p2p';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { decorate, inject, injectable, named } from 'inversify';
import * as _ from 'lodash';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { BlocksSymbols } from '../blocksSymbols';
import { OnPostApplyBlock } from '../hooks';
import { PostBlockRequest } from './PostBlockRequest';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class BlocksP2P extends Extendable {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(p2pSymbols.logic.broadcaster)
  private broadcaster: IBroadcasterLogic;
  @inject(p2pSymbols.transportMethod)
  @named(BlocksSymbols.p2p.postBlock)
  private postBlockRequest: PostBlockRequest;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @OnPostApplyBlock()
  public async onNewBlock(block: SignedAndChainedBlockType & { relays?: number }, dbTx: any, broadcast: boolean) {
    if (broadcast) {
      const broadhash = this.systemModule.broadhash;
      block           = _.cloneDeep(block);
      block.relays    = block.relays || 0;
      if (block.relays < this.broadcaster.maxRelays()) {
        block.relays++;
        // We avoid awaiting the broadcast result as it could result in unnecessary peer removals.
        // Ex: Peer A, B, C
        // A broadcasts block to B which wants to rebroadcast to A (which is waiting for B to respond) =>
        // | - A will remove B as it will timeout and the same will happen to B
        this.broadcaster.broadcast({
          filters: { broadhash },
          options: {
            immediate: true,
            method   : this.postBlockRequest,
            payload: {
              body: { block },
            },
          },
        })
          .catch((err) => this.logger.warn('Error broadcasting block', err));
      }
    }
  }
}
