import { BlocksConstantsType, BlocksSymbols } from '@risevision/core-blocks';
import {
  IAppState,
  IBlocksModule,
  ILoaderModule,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ConstantsType } from '@risevision/core-types';
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

  @Get('/')
  public getStatus() {
    // To remove? useless.
    return {
      loaded: true,
    };
  }

  @Get('/sync')
  public getStatusSync() {
    return {
      broadhash: this.systemModule.broadhash,
      consensus: this.appState.get('node.consensus'),
      height: this.blocksModule.lastBlock.height,
      syncing: this.loaderModule.isSyncing,
    };
  }

  @Get('/ping')
  public async ping() {
    const isStale = await this.blocksModule.isStale();
    return { success: !isStale };
  }
}
