import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols, utils } from '@risevision/core-models';
import { Symbols } from '@risevision/core-interfaces';
import { AccountsModelWith2ndSign } from './AccountsModelWith2ndSign';

export class CoreModule extends BaseCoreModule {
  public configSchema = {};
  public constants    = {};

  public initAppElements() {
    utils.mergeModels(
      AccountsModelWith2ndSign,
      this.container
        .getNamed(ModelSymbols.model, Symbols.models.accounts)
    );
  }
}
