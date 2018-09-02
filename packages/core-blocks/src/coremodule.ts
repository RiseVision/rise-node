import { APISymbols } from '@risevision/core-apis';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { AppConfig } from '@risevision/core-types';
import { BlocksAPI } from './apis/blocksAPI';
import { BlocksSymbols } from './blocksSymbols';
import { BlockLogic, BlockRewardLogic } from './logic/';
import { BlocksModel } from './models/BlocksModel';
import { BlocksModule, BlocksModuleChain, BlocksModuleProcess, BlocksModuleUtils, BlocksModuleVerify } from './modules';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = {};
  public constants    = {};

  public addElementsToContainer(): void {
    this.container.bind(BlocksSymbols.modules.chain).to(BlocksModuleChain).inSingletonScope();
    this.container.bind(BlocksSymbols.modules.utils).to(BlocksModuleUtils).inSingletonScope();
    this.container.bind(BlocksSymbols.modules.process).to(BlocksModuleProcess).inSingletonScope();
    this.container.bind(BlocksSymbols.modules.verify).to(BlocksModuleVerify).inSingletonScope();
    this.container.bind(BlocksSymbols.modules.blocks).to(BlocksModule).inSingletonScope();

    this.container.bind(ModelSymbols.model).toConstructor(BlocksModel)
      .whenTargetNamed(BlocksSymbols.model);

    this.container.bind(BlocksSymbols.logic.block).to(BlockLogic).inSingletonScope();
    this.container.bind(BlocksSymbols.logic.blockReward).to(BlockRewardLogic).inSingletonScope();

    this.container.bind(APISymbols.api)
      .to(BlocksAPI)
      .inSingletonScope()
      .whenTargetNamed(BlocksSymbols.api);

  }

}
