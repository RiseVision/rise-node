import { constants as constantsType } from '../helpers/';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { Symbols } from '../ioc/symbols';
import { inject, injectable } from 'inversify';
import { Get, JsonController } from 'routing-controllers';
import { IBlocksModule, ILoaderModule, ISystemModule } from '../ioc/interfaces/modules';
import { IAppState } from '../ioc/interfaces/logic';

@JsonController('/api/loader/status')
@IoCSymbol(Symbols.api.loader)
@injectable()
export class LoaderAPI {

  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  @inject(Symbols.logic.appState)
  private appState: IAppState;

  @inject(Symbols.modules.loader)
  private loaderModule: ILoaderModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
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
      status = secondsAgo < this.constants.blockReceiptTimeOut;
    }

    return { success: status };
  }
}
