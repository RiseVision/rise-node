import { BaseCoreModule } from '@risevision/core-launchpad';
import { allExceptionCreator } from './exceptions/mainnet';
import { ExceptionsManager, ExceptionSymbols } from '@risevision/core-exceptions';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { Symbols } from '@risevision/core-interfaces';
import { ICoreModuleWithModels, InfoModel, ModelSymbols } from '@risevision/core-models';

export class CoreModule extends BaseCoreModule<any> implements ICoreModuleWithModels {
  public configSchema = {};
  public constants    = {addressSuffix: 'R'};

  public async initAppElements(): Promise<void> {
    const manager = this.container.get<ExceptionsManager>(ExceptionSymbols.manager);
    await Promise.all(allExceptionCreator.map((e) => e(manager)));
  }
}
