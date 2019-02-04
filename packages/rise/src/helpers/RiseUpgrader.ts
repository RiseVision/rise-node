import { OnBlockchainReady } from '@risevision/core';
import { Container, decorate, inject, injectable, interfaces } from 'inversify';
import { WPHooksSubscriber, WordPressHookSystem } from 'mangiafuoco';
import { BlocksModule, BlocksSymbols, OnDestroyBlock, OnPostApplyBlock } from '@risevision/core-blocks';
import { Symbols } from '@risevision/core-interfaces';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { dPoSSymbols, RoundChanges } from '@risevision/core-consensus-dpos';
import { RiseV2RoundChanges } from './RiseV2RoundChanges';
import Newable = interfaces.Newable;
import { RISESymbols } from '../symbols';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class RiseUpgrader extends Extendable {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;

  @inject(RISESymbols.helpers.constants)
  private riseContants: { '@risevision/rise': { dposFeesSwitchHeight: number }};

  @inject(BlocksSymbols.modules.blocks)
  private blocksModule: BlocksModule;

  private container: Container;

  private initializedDpos: boolean = false;;

  public setContainer(c: Container) {
    this.container = c;
  }

  @OnBlockchainReady()
  public async init() {
    this.switchDposFees(this.blocksModule.lastBlock.height);
  }

  @OnPostApplyBlock()
  public onPostApplyBlock(block: SignedAndChainedBlockType) {
    const cur = block.height;
    const dposFeesSwitchHeight = this.riseContants['@risevision/rise'].dposFeesSwitchHeight;
    if (dposFeesSwitchHeight === cur || !this.initializedDpos) {
      this.switchDposFees(cur);
    }
    return null;
  }

  @OnDestroyBlock()
  public onDestroyBlock(block: SignedAndChainedBlockType) {
    const prev = block.height;

    const dposFeesSwitchHeight = this.riseContants['@risevision/rise'].dposFeesSwitchHeight;
    if (dposFeesSwitchHeight === prev || !this.initializedDpos) {
      this.switchDposFees(prev - 1);
    }
    return null;
  }

  public switchDposFees(curHeight: number) {
    this.initializedDpos = true;
    const dposFeesSwitchHeight = this.riseContants['@risevision/rise'].dposFeesSwitchHeight;
    let clazz: Newable<any> = RoundChanges;
    if (curHeight < dposFeesSwitchHeight) {
      clazz = RiseV2RoundChanges;
    }
    this.container.rebind(dPoSSymbols.helpers.roundChanges)
      .toConstructor(clazz);

    // manually install to RoundsModule. not the perfect way.
    const RoundsModule: any = this.container.get(dPoSSymbols.modules.rounds);
    RoundsModule.RoundChanges = clazz;
  }

}
