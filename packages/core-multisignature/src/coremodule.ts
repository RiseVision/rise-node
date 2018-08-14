import { APISymbols } from '@risevision/core-apis';
import { ITransactionLogic, Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ICoreModuleWithModels, ModelSymbols, utils } from '@risevision/core-models';
import { TXSymbols } from '@risevision/core-transactions';
import { constants, MultisigSymbols } from './helpers';
import { Accounts2MultisignaturesModel, Accounts2U_MultisignaturesModel, MultiSignaturesModel } from './models';
import { AccountsModelWithMultisig } from './models/AccountsModelWithMultisig';
import { MultisignaturesModule } from './multisignatures';
import { MultiSignaturesApi } from './multiSignaturesApi';
import { MultiSignatureTransaction } from './transaction';
import { MultisigTransportModule } from './transport';
import { MultisigHooksListener } from './hooks/hooksListener';
import { MultiSigUtils } from './utils';

export class CoreModule extends BaseCoreModule implements ICoreModuleWithModels {
  public configSchema = {};
  public constants    = constants;

  public addElementsToContainer(): void {
    this.container.bind(ModelSymbols.model)
      .toConstructor(Accounts2MultisignaturesModel)
      .whenTargetNamed(MultisigSymbols.models.accounts2Multi);
    this.container.bind(ModelSymbols.model)
      .toConstructor(Accounts2U_MultisignaturesModel)
      .whenTargetNamed(MultisigSymbols.models.accounts2U_Multi);
    this.container.bind(ModelSymbols.model)
      .toConstructor(MultiSignaturesModel)
      .whenTargetNamed(MultisigSymbols.models.model);

    this.container.bind(TXSymbols.transaction)
      .to(MultiSignatureTransaction)
      .inSingletonScope()
      .whenTargetNamed(MultisigSymbols.tx);

    this.container.bind(APISymbols.api)
      .to(MultiSignaturesApi)
      .inSingletonScope()
      .whenTargetNamed(MultisigSymbols.api);

    this.container.bind(MultisigSymbols.multiSigTransport)
      .to(MultisigTransportModule)
      .inSingletonScope();

    this.container.bind(MultisigSymbols.multisigConstants)
      .toConstantValue(this.constants);

    this.container.bind(MultisigSymbols.module)
      .to(MultisignaturesModule)
      .inSingletonScope();

    this.container.bind(MultisigSymbols.hooksListener)
      .to(MultisigHooksListener)
      .inSingletonScope();

    this.container.bind(MultisigSymbols.utils)
      .to(MultiSigUtils)
      .inSingletonScope();
  }

  public onPreInitModels() {
    utils.mergeModels(
      AccountsModelWithMultisig,
      this.container.getNamed(ModelSymbols.model, Symbols.models.accounts)
    );
  }

  public async initAppElements() {
    await this.container.get<MultisigHooksListener>(MultisigSymbols.hooksListener).hookMethods();
  }

  public async teardown() {
    await this.container.get<MultisigHooksListener>(MultisigSymbols.hooksListener).unHook();
  }
}
