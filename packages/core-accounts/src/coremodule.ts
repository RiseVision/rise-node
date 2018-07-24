import { APISymbols } from '@risevision/core-apis';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { AppConfig } from '@risevision/core-types';
import { Container } from 'inversify';
import { AccountsSymbols } from './symbols';
import { AccountsAPI } from './apis';
import { AccountLogic } from './logic';
import { AccountsModel } from './models';
import { AccountsModule } from './modules';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = {};
  public constants    = {};

  public addElementsToContainer(container: Container, appConfig: AppConfig): void {
    container.bind(AccountsSymbols.logic).to(AccountLogic).inSingletonScope();
    container.bind(ModelSymbols.model).toConstructor(AccountsModel)
      .whenTargetNamed(AccountsSymbols.model);
    container.bind(AccountsSymbols.module).to(AccountsModule).inSingletonScope();
    container.bind(APISymbols.api).to(AccountsAPI)
      .inSingletonScope()
      .whenTargetNamed(AccountsSymbols.api);

  }

  public initAppElements(container: Container, config: AppConfig): void {
    return void 0;
  }

}
