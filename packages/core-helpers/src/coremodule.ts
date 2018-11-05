import { Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ICoreModuleWithModels } from '@risevision/core-models';
import { AppConfig } from '@risevision/core-types';
import { loggerCreator, z_schema } from '@risevision/core-utils';
import { CommanderStatic } from 'commander';
import { AppState } from './appState';
import { HelpersSymbols } from './helpersSymbols';
import { JobsQueue } from './jobsQueue';
import { Migrator } from './migrator';
import { Sequence } from './sequence';

export class CoreModule extends BaseCoreModule<AppConfig>
  implements ICoreModuleWithModels {
  public configSchema = {};
  public constants = {};

  public addElementsToContainer(): void {
    this.container
      .bind(HelpersSymbols.appState)
      .to(AppState)
      .inSingletonScope();
    this.container
      .bind(HelpersSymbols.jobsQueue)
      .to(JobsQueue)
      .inSingletonScope();
    let logger;
    try {
      logger = this.container.get(Symbols.helpers.logger);
    } catch (e) {
      // ignore
    }
    if (!logger) {
      logger = loggerCreator({
        echo: this.config.consoleLogLevel,
        errorLevel: this.config.fileLogLevel,
        filename: this.config.logFileName,
      });
      this.container.bind(Symbols.helpers.logger).toConstantValue(logger);
    }

    this.container
      .bind(Symbols.generic.zschema)
      .toConstantValue(new z_schema({}));
    this.container
      .bind(HelpersSymbols.migrator)
      .to(Migrator)
      .inSingletonScope();
    [
      HelpersSymbols.names.balancesSequence,
      HelpersSymbols.names.dbSequence,
      HelpersSymbols.names.defaultSequence,
    ].forEach((s) => {
      this.container
        .bind(HelpersSymbols.sequence)
        .toConstantValue(
          new Sequence(s, {
            onWarning: (current) => {
              logger.warn(`${s.toString()} queue`, current);
            },
          })
        )
        .whenTargetNamed(s);
    });
  }

  public onPostInitModels() {
    return this.container.get<Migrator>(HelpersSymbols.migrator).init();
  }

  public extendCommander(program: CommanderStatic): void {
    program.option('-l, --log <level>', 'log level');
  }

  public patchConfigWithCLIParams<T extends AppConfig>(
    program: CommanderStatic,
    appConfig: T
  ) {
    if (program.log) {
      appConfig.consoleLogLevel = program.log;
    }
    return appConfig;
  }
}
