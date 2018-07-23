import { BaseCoreModule } from '@risevision/core-launchpad';
import { AppConfig } from '@risevision/core-types';
import { CommanderStatic } from 'commander';
import { Container } from 'inversify';
import { Bus } from './bus';
import { constants } from './constants';
import { ExceptionsManager } from './exceptionManager';
import { JobsQueue } from './jobsQueue';
import loggerCreator from './logger';
import { Migrator } from './migrator';
import { Symbols } from './symbols';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = {};
  public constants    = {};

  public addElementsToContainer(container: Container, appConfig: AppConfig): void {
    container.bind(Symbols.helpers.bus).toConstantValue(new Bus());
    container.bind(Symbols.helpers.constants).toConstantValue(constants);
    container.bind(Symbols.helpers.crypto).toConstantValue(new Crypto());
    container.bind(Symbols.helpers.exceptionsManager).to(ExceptionsManager).inSingletonScope();
    container.bind(Symbols.helpers.jobsQueue).to(JobsQueue).inSingletonScope();
    container.bind(Symbols.helpers.logger).toConstantValue(loggerCreator({
      echo      : appConfig.consoleLogLevel,
      errorLevel: appConfig.fileLogLevel,
      filename  : appConfig.logFileName,
    }));
    container.bind(Symbols.helpers.migrator).to(Migrator).inSingletonScope();
  }

  public initAppElements(container: Container, config: AppConfig): void {
    return void 0;
  }

  public extendCommander(program: CommanderStatic): void {
    program.option('-l, --log <level>', 'log level');

  }

  public patchConfigWithCLIParams<T extends AppConfig>(program: CommanderStatic, appConfig: T) {
    if (program.log) {
      appConfig.consoleLogLevel = program.log;
    }
    return appConfig;
  }
}