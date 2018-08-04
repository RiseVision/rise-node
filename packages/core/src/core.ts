import { BaseCoreModule } from '@risevision/core-launchpad';
import { constants } from './constants';
import { LoaderModule, SystemModule } from './modules';
import { CoreSymbols } from './symbols';
import { APISymbols } from '../../core-apis/src/helpers';

export class CoreModule extends BaseCoreModule<void> {
  public configSchema = {};
  public constants    = constants;

  public addElementsToContainer(): void {
    this.container.bind(CoreSymbols.modules.system).to(SystemModule).inSingletonScope();
    this.container.bind(CoreSymbols.modules.loader).to(LoaderModule).inSingletonScope();
    this.container.bind(APISymbols.api).to(LoaderModule)
      .whenTargetNamed(CoreSymbols.api.loader)
      .inSingletonScope();
  }

}
