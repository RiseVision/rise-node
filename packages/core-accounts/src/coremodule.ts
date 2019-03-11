import { APISymbols } from '@risevision/core-apis';
import { ModelSymbols } from '@risevision/core-models';
import {
  AppConfig,
  BaseCoreModule,
  ConstantsType,
  Symbols,
} from '@risevision/core-types';
import * as z_schema from 'z-schema';
import { AccountsAPI } from './apis';
import { AccountsLoaderSubscriber } from './hooks/';
import { AccountLogic } from './logic';
import { AccountsModel } from './models';
import { AccountsModule } from './modules';
import { AccountsSymbols } from './symbols';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = {};
  public constants = {};

  public addElementsToContainer(): void {
    this.container
      .bind(AccountsSymbols.logic)
      .to(AccountLogic)
      .inSingletonScope();
    this.container
      .bind(ModelSymbols.model)
      .toConstructor(AccountsModel)
      .whenTargetNamed(AccountsSymbols.model);
    this.container
      .bind(AccountsSymbols.module)
      .to(AccountsModule)
      .inSingletonScope();
    this.container
      .bind(APISymbols.api)
      .toConstructor(AccountsAPI)
      .whenTargetNamed(AccountsSymbols.api);

    this.container
      .bind(AccountsSymbols.__internal.loaderHooks)
      .to(AccountsLoaderSubscriber)
      .inSingletonScope();
  }

  public async initAppElements() {
    await this.container
      .get<AccountsLoaderSubscriber>(AccountsSymbols.__internal.loaderHooks)
      .hookMethods();
  }

  public async teardown() {
    await this.container
      .get<AccountsLoaderSubscriber>(AccountsSymbols.__internal.loaderHooks)
      .unHook();
  }
}
