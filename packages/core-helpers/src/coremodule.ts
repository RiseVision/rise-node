import { BaseCoreModule } from '@risevision/core-launchpad';
import { AppConfig } from '@risevision/core-types';
import { loggerCreator, Symbols as UtilsSymbols } from '@risevision/core-utils';
import { CommanderStatic } from 'commander';
import { Container } from 'inversify';
import { HelpersSymbols } from './helpersSymbols';
import { JobsQueue } from './jobsQueue';
import { Migrator } from './migrator';
import { Sequence } from './sequence';

export class CoreModule extends BaseCoreModule<AppConfig> {
  public configSchema = {};
  public constants    = {};

  public addElementsToContainer(): void {
    this.container.bind(HelpersSymbols.crypto).toConstantValue(new Crypto());
    this.container.bind(HelpersSymbols.jobsQueue).to(JobsQueue).inSingletonScope();
    const logger = loggerCreator({
      echo      : this.config.consoleLogLevel,
      errorLevel: this.config.fileLogLevel,
      filename  : this.config.logFileName,
    });
    this.container.bind(UtilsSymbols.logger).toConstantValue(logger);
    this.container.bind(HelpersSymbols.migrator).to(Migrator).inSingletonScope();
    [
      HelpersSymbols.names.balancesSequence,
      HelpersSymbols.names.dbSequence,
      HelpersSymbols.names.defaultSequence,
    ].forEach((s) => {
      this.container.bind(HelpersSymbols.sequence)
        .toConstantValue(new Sequence(s, {
          onWarning: (current) => {
            logger.warn(`${s.toString()} queue`, current);
          },
        }))
        .whenTargetNamed(s);
    });
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
