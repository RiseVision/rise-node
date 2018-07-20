import { BaseCoreModule } from '@risevision/core-launchpad';
import { AppConfig } from '@risevision/core-types';
import { Container } from 'inversify';
import { APISymbols, limitsMiddleware } from './helpers';
import { APIErrorHandler, PrivateApisGuard, SuccessInterceptor } from './utils';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = require('../schema/config.json');
  public constants    = {};

  // this.container.bind(Symbols.api.utils.forgingApisWatchGuard).to(ForgingApisWatchGuard).inSingletonScope();
  // this.container.bind(Symbols.api.utils.attachPeerHeaderToResponseObject).to(AttachPeerHeaders).inSingletonScope();
  public addElementsToContainer(container: Container, config: any) {
    container.bind(APISymbols.errorHandler).to(APIErrorHandler).inSingletonScope();
    container.bind(APISymbols.successInterceptor).to(SuccessInterceptor).inSingletonScope();
    container.bind(APISymbols.forgingApisWatchGuard).to(PrivateApisGuard).inSingletonScope();
    container.bind(APISymbols.applyLimitsMiddleware).toConstantValue(limitsMiddleware);
  }
}
