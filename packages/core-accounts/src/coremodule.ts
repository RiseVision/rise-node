import { APISymbols } from '@risevision/core-apis';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { AppConfig } from '@risevision/core-types';
import { AccountsAPI } from './apis';
import { AccountLogic } from './logic';
import { AccountsModel } from './models';
import { AccountsModule } from './modules';
import { AccountsSymbols } from './symbols';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = {};
  public constants    = {};

  public addElementsToContainer(): void {
    this.container.bind(AccountsSymbols.logic).to(AccountLogic).inSingletonScope();
    this.container.bind(ModelSymbols.model).toConstructor(AccountsModel)
      .whenTargetNamed(AccountsSymbols.model);
    this.container.bind(AccountsSymbols.module).to(AccountsModule).inSingletonScope();
    this.container.bind(APISymbols.api).to(AccountsAPI)
      .inSingletonScope()
      .whenTargetNamed(AccountsSymbols.api);
  }

  public initAppElements() {
    const accLogic = this.container.get<AccountLogic>(AccountsSymbols.logic);
    return accLogic.hookMethods();
  }

  public teardown() {
    const accLogic = this.container.get<AccountLogic>(AccountsSymbols.logic);
    return accLogic.unHook();
  }
}
