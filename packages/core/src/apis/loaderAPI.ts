import { BlocksConstantsType, BlocksSymbols } from '@risevision/core-blocks';
import {
  ConstantsType,
  IAppState,
  IBlocksModule,
  ILoaderModule,
  ISystemModule,
  Symbols,
} from '@risevision/core-types';
import { IoCSymbol } from '@risevision/core-utils';
import { inject, injectable } from 'inversify';
import { Get, JsonController } from 'routing-controllers';
import { CoreSymbols } from '../symbols';

@JsonController('/api/loader/status')
@IoCSymbol(CoreSymbols.api.loader)
@injectable()
export class LoaderAPI {
  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(BlocksSymbols.constants)
  private blocksConstants: BlocksConstantsType;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(CoreSymbols.modules.loader)
  private loaderModule: ILoaderModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @Get('/sync')
  public getStatusSync() {
    return {
      broadhash: this.systemModule.broadhash,
      consensus: this.appState.get('node.consensus'),
      height: this.blocksModule.lastBlock.height,
      isStale: this.blocksModule.isStale(),
      syncing: this.loaderModule.isSyncing,
    };
  }

  @Get('/ping')
  public async ping() {
    return {};
  }
}
