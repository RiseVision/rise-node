import { HelpersSymbols } from '@risevision/core-helpers';
import { IBaseModel, IJobsQueue, Symbols } from '@risevision/core-interfaces';
import * as activeHandles from 'active-handles';
import * as fs from 'fs';
import { Container, interfaces } from 'inversify';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import * as path from 'path';
import { Models, Sequelize } from 'sequelize';
import { IBlockLogic } from '../../../../core-interfaces/src/logic';
import { ModelSymbols } from '../../../../core-models/src/helpers';
import { SignedAndChainedBlockType } from '../../../../core-types/dist';
import { z_schema } from '../../../../core-utils';
import { LoggerStub } from '../../../../core-utils/tests/unit/stubs';
import { ICoreModule, LaunchpadSymbols } from '../../../src';
import {
  loadCoreSortedModules,
  resolveModule,
} from '../../../src/modulesLoader';

activeHandles.hookSetInterval();

const curContainer: Container = new Container();

curContainer.snapshot();
curContainer
  .bind<Array<ICoreModule<any>>>('__test__modules')
  .toConstantValue([]);

export async function createContainer(
  modules: string[] = [
    'core',
    'core-accounts',
    'core-blocks',
    'core-p2p',
    'core-helpers',
    'core-crypto',
    'core-crypto',
    'core-transactions',
    'core-accounts',
  ],
  config: any = JSON.parse(
    fs.readFileSync(`${__dirname}/../assets/config.json`, 'utf8')
  ),
  block: SignedAndChainedBlockType = JSON.parse(
    fs.readFileSync(`${__dirname}/../assets/genesisBlock.json`, 'utf8')
  )
): Promise<Container> {
  await tearDownContainer();
  // global.gc();
  const container = curContainer;
  const allDeps = {};
  for (const m of modules) {
    allDeps[`@risevision/${m}`] = resolveModule(
      path.resolve(`${__dirname}/../../../../${m}`),
      allDeps
    );
  }
  const sortedModules = loadCoreSortedModules(allDeps);
  for (const sortedModule of sortedModules) {
    sortedModule.config = config;
    sortedModule.container = container;
    sortedModule.sortedModules = sortedModules;
    sortedModule.addElementsToContainer();
  }

  container.bind(Symbols.generic.genesisBlock).toConstantValue(block);
  container.bind(Symbols.generic.appConfig).toConstantValue(config);
  container.bind(Symbols.generic.nonce).toConstantValue('nonce');
  container.bind(Symbols.generic.versionBuild).toConstantValue('test');
  // container.bind(Symbols.generic.zschema).toConstantValue(new z_schema({}));
  container
    .bind(Symbols.generic.hookSystem)
    .toConstantValue(new WordPressHookSystem(new InMemoryFilterModel()));
  container.rebind(Symbols.helpers.logger).toConstantValue(new LoggerStub());
  container.bind(LaunchpadSymbols.coremodules).toConstantValue(sortedModules);
  container.rebind(HelpersSymbols.migrator).toConstantValue({
    init() {
      return Promise.resolve();
    },
  });

  container.rebind(Symbols.generic.constants).toConstantValue(
    require(`${__dirname}/../assets/constants.json`)
  );
  // container.get<any>(Symbols.generic.constants).addressSuffix = 'R';
  // const infoModel = container.getNamed<IBaseModel>(ModelSymbols.model, ModelSymbols.names.info);
  for (const sm of sortedModules) {
    if (sm.name === '@risevision/core') {
      // @ts-ignore
      sm.onPostInitModels = () => null;
    }
  }
  const s = container.get<Sequelize>(ModelSymbols.sequelize);
  s.query = (...args) => {
    return Promise.resolve(null) as any;
  };
  for (const sortedModule of sortedModules) {
    await sortedModule.initAppElements();
  }

  if (sortedModules.some((m) => m.name.indexOf('core-blocks') !== -1)) {
    block.previousBlock = '1'; // exception for genesisblock
    block.transactions = [];
    container.get<IBlockLogic>(Symbols.logic.block).objectNormalize(block);
    block.previousBlock = null;
  }

  container.bind('__test__modules').toConstantValue(sortedModules);
  // curContainer = container;
  return container;
}

const firstRun = true;

export async function tearDownContainer() {
  const container = curContainer;
  const modules = container.get<Array<ICoreModule<any>>>('__test__modules');
  for (const m of modules) {
    try {
      await m.teardown();
    } catch (e) {
      // tslint:disable-next-line
      console.log(e);
    }
  }

  // @ts-ignore
  const bd = container._bindingDictionary as interfaces.Lookup<
    interfaces.Binding<any>
  >;
  // console.log(modules.map((m) => m.directory));
  bd.traverse((key, value) => {
    // console.log(key);
    if (
      key === ModelSymbols.sequelize ||
      key === ModelSymbols.sequelizeNamespace ||
      key === ModelSymbols.model
    ) {
      return;
    }
    value.forEach((v) => {
      if (v.type === 'Constructor') {
        return;
      } else if (v.type === 'ConstantValue') {
        return;
      }
      if (v.cache === null) {
        // console.log(key, 'is NULL');
        return;
      }
      if (typeof v.cache !== 'object' || Array.isArray(v.cache)) {
        // console.log(key, 'is not an object', typeof(v.cache));
        return;
      }
      // console.log(Object.keys(v.cache));
      Object.keys(v.cache).forEach((k) => (v.cache[k] = null));
    });
  });
  // if (!firstRun) {
  //   process.exit(0);
  // }
  // firstRun = false;
  container.unbindAll();
  container.restore();
  container.snapshot();
}
