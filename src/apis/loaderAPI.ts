import { inject, injectable } from 'inversify';
import { Get, JsonController } from 'routing-controllers';
import { constants as constantsType } from '../helpers/';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { IAppState } from '../ioc/interfaces/logic';
import { IBlocksModule, ILoaderModule, ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { ResponseSchema, OpenAPI } from 'rc-openapi-gen';

@JsonController('/api/loader/status')
@IoCSymbol(Symbols.api.loader)
@injectable()
export class LoaderAPI {

  @inject(Symbols.logic.appState)
  private appState: IAppState;
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.loader)
  private loaderModule: ILoaderModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @Get('/')
  @OpenAPI({
    summary: "Get Loader Status",
    description: "Check to see if blockchain has been loaded by node"
  })
  @ResponseSchema('responses.loader.getStatus')
  public getStatus() {
    return {
      loaded: this.loaderModule.loaded,
    };
  }

  @Get('/sync')
  @OpenAPI({
    summary: "Get Loader Sync Status",
    description: "Retrieve current status of node's blockchain sync"
  })
  @ResponseSchema('responses.loader.getStatusSync')
  public getStatusSync() {
    return {
      broadhash: this.systemModule.broadhash,
      consensus: this.appState.get('node.consensus'),
      height   : this.blocksModule.lastBlock.height,
      syncing  : this.loaderModule.isSyncing,
    };
  }

  @Get('/ping')
  @OpenAPI({
    summary: "Ping",
    description: "Ping node to see if capable of syncing quickly enough (within two blocks)"
  })
  @ResponseSchema('responses.loader.ping')
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
