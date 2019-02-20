import { APISymbols } from '@risevision/core-apis';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { p2pSymbols } from '@risevision/core-p2p';
import {
  AppConfig,
  SignedAndChainedBlockType,
  Symbols,
} from '@risevision/core-types';
import { BlocksAPI } from './apis/blocksAPI';
import { BlocksConstantsType, constants } from './blocksConstants';
import { BlocksSymbols } from './blocksSymbols';
import { BlockLoader } from './hooks/';
import { BlockLogic, BlockRewardLogic } from './logic/';
import { BlockBytes } from './logic/blockBytes';
import { BlocksModel } from './models/BlocksModel';
import {
  BlocksModule,
  BlocksModuleChain,
  BlocksModuleProcess,
  BlocksModuleUtils,
  BlocksModuleVerify,
} from './modules';
import {
  CommonBlockRequest,
  GetBlocksRequest,
  HeightRequest,
  PostBlockRequest,
} from './p2p';
import { BlocksP2P } from './p2p/';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = {};
  public constants: BlocksConstantsType = constants;

  public addElementsToContainer(): void {
    this.container
      .bind(BlocksSymbols.modules.chain)
      .to(BlocksModuleChain)
      .inSingletonScope();
    this.container
      .bind(BlocksSymbols.modules.utils)
      .to(BlocksModuleUtils)
      .inSingletonScope();
    this.container
      .bind(BlocksSymbols.modules.process)
      .to(BlocksModuleProcess)
      .inSingletonScope();
    this.container
      .bind(BlocksSymbols.modules.verify)
      .to(BlocksModuleVerify)
      .inSingletonScope();
    this.container
      .bind(BlocksSymbols.modules.blocks)
      .to(BlocksModule)
      .inSingletonScope();

    this.container
      .bind(ModelSymbols.model)
      .toConstructor(BlocksModel)
      .whenTargetNamed(BlocksSymbols.model);

    this.container
      .bind(BlocksSymbols.logic.block)
      .to(BlockLogic)
      .inSingletonScope();
    this.container
      .bind(BlocksSymbols.logic.blockReward)
      .to(BlockRewardLogic)
      .inSingletonScope();

    this.container
      .bind(APISymbols.api)
      .toConstructor(BlocksAPI)
      .whenTargetNamed(BlocksSymbols.api.api);

    // Adding request factories
    this.container
      .bind(p2pSymbols.transportMethod)
      .to(CommonBlockRequest)
      .inSingletonScope()
      .whenTargetNamed(BlocksSymbols.p2p.commonBlocks);
    this.container
      .bind(p2pSymbols.transportMethod)
      .to(GetBlocksRequest)
      .inSingletonScope()
      .whenTargetNamed(BlocksSymbols.p2p.getBlocks);
    this.container
      .bind(p2pSymbols.transportMethod)
      .to(PostBlockRequest)
      .inSingletonScope()
      .whenTargetNamed(BlocksSymbols.p2p.postBlock);
    this.container
      .bind(p2pSymbols.transportMethod)
      .to(HeightRequest)
      .inSingletonScope()
      .whenTargetNamed(BlocksSymbols.p2p.getHeight);

    this.container
      .bind(BlocksSymbols.logic.blockBytes)
      .to(BlockBytes)
      .inSingletonScope();

    this.container
      .bind(BlocksSymbols.__internals.mainP2P)
      .to(BlocksP2P)
      .inSingletonScope();
    this.container
      .bind(BlocksSymbols.__internals.loader)
      .to(BlockLoader)
      .inSingletonScope();

    this.container
      .bind(BlocksSymbols.constants)
      .toConstantValue(this.constants);
  }

  public async initAppElements(): Promise<void> {
    await this.container
      .get<BlocksP2P>(BlocksSymbols.__internals.mainP2P)
      .hookMethods();
    await this.container
      .get<BlockLoader>(BlocksSymbols.__internals.loader)
      .hookMethods();
    await this.container
      .get<BlocksModuleVerify>(BlocksSymbols.modules.verify)
      .hookMethods();
  }

  public async teardown(): Promise<void> {
    await this.container
      .get<BlocksP2P>(BlocksSymbols.__internals.mainP2P)
      .unHook();
    await this.container
      .get<BlockLoader>(BlocksSymbols.__internals.loader)
      .unHook();
    await this.container
      .get<BlocksModuleVerify>(BlocksSymbols.modules.verify)
      .unHook();
  }

  public async boot() {
    // Move the genesis from string signatures to buffer signatures
    const genesis = this.container.get<SignedAndChainedBlockType>(
      Symbols.generic.genesisBlock
    );
    genesis.previousBlock = '1'; // exception for genesisblock
    this.container
      .get<BlockLogic>(BlocksSymbols.logic.block)
      .objectNormalize(genesis);
    genesis.previousBlock = null;

    const blocksChainModule = this.container.get<BlocksModuleChain>(
      BlocksSymbols.modules.chain
    );
    await blocksChainModule.saveGenesisBlock();
  }
}
