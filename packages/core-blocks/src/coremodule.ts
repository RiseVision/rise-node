import { APISymbols } from '@risevision/core-apis';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { p2pSymbols } from '@risevision/core-p2p';
import { AppConfig } from '@risevision/core-types';
import { BlocksAPI } from './apis/blocksAPI';
import { BlocksSymbols } from './blocksSymbols';
import { BlockLogic, BlockRewardLogic } from './logic/';
import { BlocksModel } from './models/BlocksModel';
import { BlocksModule, BlocksModuleChain, BlocksModuleProcess, BlocksModuleUtils, BlocksModuleVerify } from './modules';
import { CommonBlockRequest, GetBlocksRequest, HeightRequest, PostBlockRequest } from './p2p';
import { BlocksP2P } from './p2p/';

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
      .whenTargetNamed(BlocksSymbols.api.api);

    // Adding request factories
    this.container.bind(p2pSymbols.transportMethod)
      .to(CommonBlockRequest)
      .inSingletonScope()
      .whenTargetNamed(BlocksSymbols.p2p.commonBlocks);
    this.container.bind(p2pSymbols.transportMethod)
      .to(GetBlocksRequest)
      .inSingletonScope()
      .whenTargetNamed(BlocksSymbols.p2p.getBlocks);
    this.container.bind(p2pSymbols.transportMethod)
      .to(PostBlockRequest)
      .inSingletonScope()
      .whenTargetNamed(BlocksSymbols.p2p.postBlock);
    this.container.bind(p2pSymbols.transportMethod)
      .to(HeightRequest)
      .inSingletonScope()
      .whenTargetNamed(BlocksSymbols.p2p.getHeight);

    this.container.bind(BlocksSymbols.__internals.mainP2P).to(BlocksP2P).inSingletonScope();
  }

  public teardown(): Promise<void> {
    return this.container.get<BlocksP2P>(BlocksSymbols.__internals.mainP2P).unHook();
  }

  public initAppElements(): Promise<void> {
    return this.container.get<BlocksP2P>(BlocksSymbols.__internals.mainP2P).hookMethods();
  }
}
