import { Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols, utils } from '@risevision/core-models';
import { constants } from './helpers';
import { AccountsModelWithMultisig } from './models/AccountsModelWithMultisig';

export class CoreModule extends BaseCoreModule {
  public configSchema = {};
  public constants    = constants;


  public initAppElements() {
    utils.mergeModels(
      AccountsModelWithMultisig,
      this.container.getNamed(ModelSymbols.model, Symbols.models.accounts)
    );
  }
}
