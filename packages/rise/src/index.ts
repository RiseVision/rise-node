import {
  ExceptionsManager,
  ExceptionSymbols,
} from '@risevision/core-exceptions';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { registerExceptions } from './exceptions/mainnet';

export class CoreModule extends BaseCoreModule<any> {
  public configSchema = {};
  public constants = { addressSuffix: 'R' };

  public async initAppElements(): Promise<void> {
    const manager = this.container.get<ExceptionsManager>(
      ExceptionSymbols.manager
    );
    await registerExceptions(manager, this.container);
  }
}
