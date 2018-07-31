import { Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { p2pSymbols } from '@risevision/core-p2p';
import { AppConfig } from '@risevision/core-types';
import { APISymbols, limitsMiddleware } from './helpers';
import { APIErrorHandler, PrivateApisGuard, SuccessInterceptor } from './utils';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = require('../schema/config.json');
  public constants    = {};

  public addElementsToContainer() {
    this.container.bind(p2pSymbols.middleware).to(APIErrorHandler)
      .inSingletonScope()
      .whenTargetNamed(APISymbols.errorHandler);

    this.container.bind(Symbols.class)
      .to(SuccessInterceptor).inSingletonScope().whenTargetNamed(APISymbols.successInterceptor);
    this.container
      .bind(Symbols.class)
      .to(PrivateApisGuard).inSingletonScope().whenTargetNamed(APISymbols.privateApiGuard);
    this.container
      .bind(Symbols.class)
      .toConstantValue(limitsMiddleware).whenTargetNamed(APISymbols.applyLimitsMiddleware);
  }

}
