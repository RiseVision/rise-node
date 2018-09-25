import { OnPostApplyBlock } from '@risevision/core-blocks';
import { Symbols } from '@risevision/core-interfaces';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import * as sequelize from 'sequelize';
import { dPoSSymbols } from '../../helpers';
import { RoundsModule } from '../../modules';

@injectable()
export class BlockHooks extends WPHooksSubscriber(Object) {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;

  @inject(dPoSSymbols.modules.rounds)
  private module: RoundsModule;

  @OnPostApplyBlock()
  public onTxApply(block: SignedAndChainedBlockType, tx: sequelize.Transaction) {
    return this.module.tick(block, tx);
  }

}
