import { Container } from 'inversify';
import { loadCoreSortedModules, resolveModule } from '../../src/modulesLoader';
import { Symbols } from '../../../core-interfaces/dist';
import { z_schema } from '../../../core-utils';
import { WordPressHookSystem, InMemoryFilterModel } from 'mangiafuoco';
import { LoggerStub } from '../../../core-utils/tests/stubs';
import { SignedAndChainedBlockType } from '../../../core-types/dist';
import { CoreSymbols } from '../../../core/dist';
import * as path from 'path';
import { ICoreModule } from '../../src';
import { IBlockLogic } from '../../../core-interfaces/src/logic';

let curContainer: Container;

export async function createContainer(modules: string[],
                                      config: any                      = require('../assets/config.json'),
                                      block: SignedAndChainedBlockType = require('../assets/genesisBlock.json')): Promise<Container> {
  if (curContainer) {
    await tearDownContainer(curContainer);
  }
  const container = new Container();
  const allDeps   = {};
  for (const m of modules) {
    allDeps[`@risevision/${m}`] = resolveModule(path.resolve(`${__dirname}/../../../${m}`), allDeps);
  }
  const sortedModules = loadCoreSortedModules(allDeps);
  for (const sortedModule of sortedModules) {
    sortedModule.config    = config;
    sortedModule.container = container;
    sortedModule.sortedModules = sortedModules;
    sortedModule.addElementsToContainer();
  }

  container.bind(Symbols.generic.genesisBlock).toConstantValue(block);
  container.bind(Symbols.generic.appConfig).toConstantValue(config);
  container.bind(Symbols.generic.nonce).toConstantValue('nonce');
  container.bind(Symbols.generic.versionBuild).toConstantValue('test');
  container.bind(Symbols.generic.zschema).toConstantValue(new z_schema({}));
  container.bind(Symbols.generic.hookSystem).toConstantValue(new WordPressHookSystem(new InMemoryFilterModel()));
  container.rebind(Symbols.helpers.logger).toConstantValue(new LoggerStub());

  for (const sortedModule of sortedModules) {
    await sortedModule.initAppElements();
  }

  block.previousBlock = '1'; // exception for genesisblock
  block.transactions = [];
  container.get<IBlockLogic>(Symbols.logic.block).objectNormalize(block);
  block.previousBlock = null;

  container.bind('__test__modules').toConstantValue(sortedModules);
  curContainer = container;
  return container;
}

export async function tearDownContainer(container: Container) {
  const modules = container.get<Array<ICoreModule<any>>>('__test__modules');
  for (const m of modules) {
    try {
      await m.teardown();
    } catch (e) {
      console.log(e);
    }
  }
}
