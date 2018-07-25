import { IAppState, IBlocksModule, ILoaderModule, ISystemModule, Symbols } from '@risevision/core-interfaces';
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
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(CoreSymbols.modules.loader)
  private loaderModule: ILoaderModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @Get('/')
  public getStatus() {
    return {
      loaded: this.loaderModule.loaded,
    };
  }

  @Get('/sync')
  public getStatusSync() {
    return {
      broadhash: this.systemModule.broadhash,
      consensus: this.appState.get('node.consensus'),
      height   : this.blocksModule.lastBlock.height,
      syncing  : this.loaderModule.isSyncing,
    };
  }

  @Get('/ping')
  public ping() {
    let status = false;
    if (this.blocksModule.lastBlock) {
      const secondsAgo = Math.floor(Date.now() / 1000) -
        (Math.floor(this.constants.epochTime.getTime() / 1000) + this.blocksModule.lastBlock.timestamp);
      status           = secondsAgo < this.constants.blockReceiptTimeOut;
    }

    return { success: status };
  }
}
