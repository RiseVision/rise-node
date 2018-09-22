import { APISymbols } from '@risevision/core-apis';
import { Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { AppConfig, ConstantsType } from '@risevision/core-types';
import * as z_schema from 'z-schema';
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
    z_schema.registerFormat('address', (str: string) => {
      // tslint:disable-next-line
      return new RegExp(`^[0-9]{1,20}${this.container.get<ConstantsType>(Symbols.generic.constants).addressSuffix}$`).test(str);
    });
    return accLogic.hookMethods();
  }

  public teardown() {
    const accLogic = this.container.get<AccountLogic>(AccountsSymbols.logic);
    return accLogic.unHook();
  }
}
