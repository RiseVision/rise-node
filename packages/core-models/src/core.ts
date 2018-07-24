import { BaseCoreModule } from '@risevision/core-launchpad';
import * as cls from 'cls-hooked';
import { Container } from 'inversify';
import { Model, Sequelize } from 'sequelize-typescript';
import { DbAppConfig, DBHelper, ModelSymbols } from './helpers/';
import {
  ForksStatsModel,
  InfoModel,
  MigrationsModel,
} from './models';

export class CoreModule extends BaseCoreModule<DbAppConfig> {
  public configSchema = require('../schema/config.json');
  public constants    = {};
  private appConfig: DbAppConfig;
  private sequelize: Sequelize;

  public addElementsToContainer(container: Container): void {
    const namespace = cls.createNamespace('sequelize-namespace');

    (Sequelize as any).__proto__.useCLS(namespace);

    this.sequelize = new Sequelize({
      database: this.appConfig.db.database,
      dialect : 'postgres',
      host    : this.appConfig.db.host,
      logging : false,
      password: this.appConfig.db.password,
      pool    : {
        idle: this.appConfig.db.poolIdleTimeout,
        max : this.appConfig.db.poolSize,
      },
      port    : this.appConfig.db.port,
      username: this.appConfig.db.user,
    });

    container.bind(ModelSymbols.sequelize).toConstantValue(this.sequelize);
    container.bind(ModelSymbols.sequelizeNamespace).toConstantValue(namespace);
    container.bind(ModelSymbols.helpers.db).to(DBHelper).inSingletonScope();


    container.bind(ModelSymbols.model).toConstructor(ForksStatsModel)
      .whenTargetNamed(ModelSymbols.names.forkStats);
    container.bind(ModelSymbols.model).toConstructor(InfoModel)
      .whenTargetNamed(ModelSymbols.names.info);
    container.bind(ModelSymbols.model).toConstructor(MigrationsModel)
      .whenTargetNamed(ModelSymbols.names.migrations);
    // container.bind(ModelSymbols.model).toConstructor(PeersModel)
    //   .whenTargetNamed(ModelSymbols.names.peers); TODO:
    // container.bind(ModelSymbols.model).toConstructor(TransactionsModel)
    //   .whenTargetNamed(ModelSymbols.names.transactions);
  }

  public initAppElements(container: Container) {
    const models = container.getAll<typeof Model>(ModelSymbols.model);
    this.sequelize.addModels(models);
  }

  public afterConfigValidation<T extends DbAppConfig>(config: T): T {
    this.appConfig = config;
    return config;
  }
}
