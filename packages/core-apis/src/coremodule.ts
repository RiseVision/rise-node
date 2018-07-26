import { BaseCoreModule } from '@risevision/core-launchpad';
import { AppConfig } from '@risevision/core-types';
import { APISymbols, limitsMiddleware } from './helpers';
import { APIErrorHandler, PrivateApisGuard, SuccessInterceptor } from './utils';
import { P2PSymbols } from '@risevision/core-p2p';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = require('../schema/config.json');
  public constants    = {};

  // this.container.bind(Symbols.api.utils.forgingApisWatchGuard).to(ForgingApisWatchGuard).inSingletonScope();
  // this.container.bind(Symbols.api.utils.attachPeerHeaderToResponseObject).to(AttachPeerHeaders).inSingletonScope();
  public addElementsToContainer() {
    this.container.bind(P2PSymbols.middleware).to(APIErrorHandler).inSingletonScope();
    this.container.bind(APISymbols.successInterceptor).to(SuccessInterceptor).inSingletonScope();
    this.container.bind(APISymbols.privateApiGuard).to(PrivateApisGuard).inSingletonScope();
    this.container.bind(APISymbols.applyLimitsMiddleware).toConstantValue(limitsMiddleware);
  }

  public initAppElements() {

  }
}
