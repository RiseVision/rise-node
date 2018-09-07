import { APISymbols } from '@risevision/core-apis';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { requestFactory } from '@risevision/core-p2p';
import { AppConfig } from '@risevision/core-types';
import { BlocksAPI } from './apis/blocksAPI';
import { BlocksSymbols } from './blocksSymbols';
import { BlockLogic, BlockRewardLogic } from './logic/';
import { BlocksModel } from './models/BlocksModel';
import { BlocksModule, BlocksModuleChain, BlocksModuleProcess, BlocksModuleUtils, BlocksModuleVerify } from './modules';
import { CommonBlockRequest } from './p2p/CommonBlockRequest';
import { GetBlocksRequest } from './p2p/GetBlocksRequest';
import { PostBlockRequest } from './p2p/PostBlockRequest';
import { BlocksTransportV2API } from './apis/transportAPI';

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

    this.container.bind(APISymbols.api)
      .to(BlocksTransportV2API)
      .inSingletonScope()
      .whenTargetNamed(BlocksSymbols.api.transport);

    // Adding request factories
    this.container.bind(BlocksSymbols.p2p.commonBlocks).toFactory(requestFactory(CommonBlockRequest));
    this.container.bind(BlocksSymbols.p2p.getBlocks).toFactory(requestFactory(GetBlocksRequest));
    this.container.bind(BlocksSymbols.p2p.postBlocks).toFactory(requestFactory(PostBlockRequest));
  }

}
