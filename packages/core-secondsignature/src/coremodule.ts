import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols, utils } from '@risevision/core-models';
import { Symbols } from '@risevision/core-interfaces';
import { AccountsModelWith2ndSign } from './AccountsModelWith2ndSign';
import { SignaturesModel } from './SignaturesModel';
import { SigSymbols } from './symbols';
import { TXSymbols } from '@risevision/core-transactions';
import { SecondSignatureTransaction } from './secondSignature';
import { APISymbols } from '@risevision/core-apis';
import { SignaturesAPI } from './signatureAPI';

export class CoreModule extends BaseCoreModule {
  public configSchema = {};
  public constants    = {};

  public addElementsToContainer() {
    this.container.bind(ModelSymbols.model)
      .toConstructor(SignaturesModel)
      .whenTargetNamed(SigSymbols.model);

    this.container.bind(TXSymbols.transaction)
      .to(SecondSignatureTransaction)
      .inSingletonScope()
      .whenTargetNamed(SigSymbols.transaction);

    this.container.bind(APISymbols.api)
      .to(SignaturesAPI)
      .inSingletonScope()
      .whenTargetNamed(SigSymbols.api);

  }

  public initAppElements() {
    utils.mergeModels(
      AccountsModelWith2ndSign,
      this.container
        .getNamed(ModelSymbols.model, Symbols.models.accounts)
    );
  }
}
