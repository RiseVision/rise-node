import { APISymbols } from '@risevision/core-apis';
import { Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { constants } from './constants';
import { TimeToEpoch } from './helpers';
import { ForkModule, LoaderModule, SystemModule } from './modules';
import { CoreSymbols } from './symbols';
import { LoaderAPI } from './apis';

export class CoreModule extends BaseCoreModule<void> {
  public configSchema = {};
  public constants    = constants;

  public addElementsToContainer(): void {
    this.container.bind(Symbols.helpers.timeToEpoch).to(TimeToEpoch).inSingletonScope();
    this.container.bind(CoreSymbols.constants).toConstantValue(this.constants);
    this.container.bind(CoreSymbols.modules.fork).to(ForkModule).inSingletonScope();
    this.container.bind(CoreSymbols.modules.system).to(SystemModule).inSingletonScope();
    this.container.bind(CoreSymbols.modules.loader).to(LoaderModule).inSingletonScope();
    this.container.bind(APISymbols.api).to(LoaderAPI)
      .inSingletonScope()
      .whenTargetNamed(CoreSymbols.api.loader);
  }

}
