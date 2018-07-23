import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { Container } from 'inversify';
import { ExceptionsManager } from './exceptionManager';
import { ExceptionSymbols } from './symbols';
import { ExceptionModel } from './ExceptionModel';

export class CoreModule extends BaseCoreModule<any> {
  public configSchema = {};
  public constants    = {};

  public addElementsToContainer(container: Container): void {
    container.bind(ExceptionSymbols.manager).to(ExceptionsManager).inSingletonScope();
    container.bind(ModelSymbols.model).toConstructor(ExceptionModel)
      .whenTargetNamed(ExceptionSymbols.model);
  }

  public initAppElements(): void {
    return void 0;
  }
}
