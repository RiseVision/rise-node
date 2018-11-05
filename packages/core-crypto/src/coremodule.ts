import { BaseCoreModule } from '@risevision/core-launchpad';
import { AppConfig } from '@risevision/core-types';
import { Crypto } from './crypto_sodium_native';
import { CryptoSymbols } from './cryptoSymbols';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = {};
  public constants = {};

  public addElementsToContainer(): void {
    this.container.bind(CryptoSymbols.crypto).toConstantValue(new Crypto());
  }
}
