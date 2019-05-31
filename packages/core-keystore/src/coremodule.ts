import { APISymbols } from '@risevision/core-apis';
import { ModelSymbols } from '@risevision/core-models';
import { TXSymbols } from '@risevision/core-transactions';
import { BaseCoreModule, ISystemModule, Symbols } from '@risevision/core-types';
import { KeystoreAPI } from './apis';
import { constants } from './constants';
import { KeystoreModel } from './models';
import { KeystoreModule } from './modules';
import { KeystoreTxSymbols } from './symbols';
import { KeystoreTransaction } from './transaction';

export class CoreModule extends BaseCoreModule {
  public configSchema = {};
  public constants = constants;

  public addElementsToContainer(): void {
    // API endpoint registration
    this.container
      .bind(APISymbols.api)
      .toConstructor(KeystoreAPI)
      .whenTargetNamed(KeystoreTxSymbols.api);

    // Model registration
    this.container
      .bind(ModelSymbols.model)
      .toConstructor(KeystoreModel)
      .whenTargetNamed(KeystoreTxSymbols.model);

    // Register the module
    this.container
      .bind(KeystoreTxSymbols.module)
      .to(KeystoreModule)
      .inSingletonScope();

    // Register our transaction
    this.container
      .bind(TXSymbols.transaction)
      .to(KeystoreTransaction)
      .inSingletonScope()
      .whenTargetNamed(KeystoreTxSymbols.transaction);

    this.container
      .bind(KeystoreTxSymbols.constants)
      .toConstantValue(this.constants);
  }

  public async boot(): Promise<void> {
    const curFees = this.container
      .get<ISystemModule>(Symbols.modules.system)
      .getFees();
    if (
      typeof curFees.fees.keystore === 'undefined' ||
      typeof curFees.fees.keystoreMultiplier === 'undefined'
    ) {
      throw new Error('No fees defined for keystore');
    }
  }
}
