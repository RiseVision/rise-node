import { ILogger, Symbols } from '@risevision/core-interfaces';
import { AppConfig, SignedAndChainedBlockType } from '@risevision/core-types';
import { Container } from 'inversify';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import * as pg from 'pg';
import 'reflect-metadata';
import { OnFinishBoot, OnInitContainer } from './hooks';
import { LaunchpadSymbols } from './launchpadSymbols';
import { ICoreModule } from './module';

export class AppManager {
  public container: Container = new Container();
  public hookSystem: WordPressHookSystem = new WordPressHookSystem(new InMemoryFilterModel());
  private isCleaning       = false;

  constructor(private appConfig: AppConfig,
              private logger: ILogger,
              private versionBuild: string,
              private genesisBlock: SignedAndChainedBlockType,
              private modules: Array<ICoreModule<any>>) {
    this.appConfig.nethash = genesisBlock.payloadHash.toString('hex');
    // this.container.applyMiddleware(theLogger);
    // Sets the int8 (64bit integer) to be parsed as int instead of being returned as text
    pg.types.setTypeParser(20, 'text', parseInt);
  }

  /**
   * Starts the application
   */
  public async boot() {
    this.logger.info('Booting');
    await this.initAppElements();
    this.finishBoot(); // This promise is intentionally not awaited.
  }

  /**
   * Method to tear down the application
   */
  public async tearDown() {
    if (this.isCleaning) {
      return;
    }
    this.isCleaning = true;
    this.logger.info('Cleaning up...');

    try {
      await Promise.all(this.modules.map((m) => m.teardown()));
      this.logger.info('Cleaned up successfully');
    } catch (err) {
      this.logger.error(err);
    }
  }

  /**
   * Initialize all app dependencies into the IoC container.
   */
  public async initAppElements() {
    this.modules.forEach((m) => {
      m.config = this.appConfig;
      m.container = this.container;
      m.sortedModules = this.modules;
    });

    this.container.bind(LaunchpadSymbols.coremodules).toConstantValue(this.modules);
    this.container.bind(Symbols.generic.appConfig).toConstantValue(this.appConfig);
    this.container.bind(Symbols.generic.versionBuild).toConstantValue(this.versionBuild);
    this.container.bind(Symbols.generic.genesisBlock).toConstantValue(this.genesisBlock);
    this.container.bind(Symbols.generic.hookSystem).toConstantValue(this.hookSystem);

    for (const m of this.modules) {
      await m.addElementsToContainer();
    }

    for (const m of this.modules) {
      await m.initAppElements();
    }

    // hooks
    await this.hookSystem.do_action(OnInitContainer.name, this.container);
  }

  public async finishBoot() {
    for (const module of this.modules) {
      console.log(`Booting ${module.name}`);
      await module.boot();
    }
    await this.hookSystem.do_action(OnFinishBoot.name);

    this.logger.info('App Booted');
  }

}
