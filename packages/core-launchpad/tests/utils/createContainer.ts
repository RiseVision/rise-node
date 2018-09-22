import { Container, interfaces } from 'inversify';
import { loadCoreSortedModules, resolveModule } from '../../src/modulesLoader';
import { z_schemaBuilder } from '../../../core-utils';
import { WordPressHookSystem, InMemoryFilterModel } from 'mangiafuoco';
import { LoggerStub } from '../../../core-utils/tests/stubs';
import { SignedAndChainedBlockType } from '../../../core-types/dist';
import * as path from 'path';
import { ICoreModule, LaunchpadSymbols } from '../../src';
import { IBlockLogic } from '../../../core-interfaces/src/logic';
import { ModelSymbols } from '../../../core-models/src/helpers';
import { Symbols, IJobsQueue } from '@risevision/core-interfaces';
import * as activeHandles from 'active-handles';
import * as fs from 'fs';
activeHandles.hookSetInterval();

let curContainer: Container = new Container();

curContainer.snapshot();
curContainer.bind<Array<ICoreModule<any>>>('__test__modules').toConstantValue([]);
export async function createContainer(modules: string[] = ['core', 'core-accounts', 'core-blocks', 'core-p2p', 'core-helpers', 'core-transactions', 'core-accounts'],
                                      config: any                      = JSON.parse(fs.readFileSync(`${__dirname}/../assets/config.json`, 'utf8')),
                                      block: SignedAndChainedBlockType = JSON.parse(fs.readFileSync(`${__dirname}/../assets/genesisBlock.json`, 'utf8'))): Promise<Container> {

  await tearDownContainer();
  // global.gc();
  const container = curContainer;
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
  container.bind(Symbols.generic.zschema).toConstantValue(z_schemaBuilder(container.get(Symbols.generic.constants)));
  container.bind(Symbols.generic.hookSystem).toConstantValue(new WordPressHookSystem(new InMemoryFilterModel()));
  container.rebind(Symbols.helpers.logger).toConstantValue(new LoggerStub());
  container.bind(LaunchpadSymbols.coremodules).toConstantValue(sortedModules);

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
let firstRun = true;
export async function tearDownContainer() {
  const container = curContainer;
  const modules = container.get<Array<ICoreModule<any>>>('__test__modules');
  for (const m of modules) {
    try {
      await m.teardown();
    } catch (e) {
      console.log(e);
    }
  }

  const bd = container['_bindingDictionary'] as interfaces.Lookup<interfaces.Binding<any>>;
  // console.log(modules.map((m) => m.directory));
  bd.traverse((key, value) => {
    // console.log(key);
    if (key === ModelSymbols.sequelize || key === ModelSymbols.sequelizeNamespace || key === ModelSymbols.model) {
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
      if (typeof (v.cache) !== 'object' || Array.isArray(v.cache)) {
        // console.log(key, 'is not an object', typeof(v.cache));
        return;
      }
      // console.log(Object.keys(v.cache));
      Object.keys(v.cache).forEach((k) => v.cache[k] = null);
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

const Memwatch = require('memwatch-next');
const Util = require('util');
/**
 * Check for memory leaks
 */
let hd = null;
Memwatch.on('leak', (info) => {
  console.log('memwatch::leak');
  console.error(info);
  // if (!hd) {
  //   hd = new Memwatch.HeapDiff();
  // }
  // else {console.log('ciao');
  //   const diff = hd.end();
  //   console.error(Util.inspect(diff, true, null));
  //   console.log('memwatch::leak', {
  //     HeapDiff: hd
  //   });
  //   hd = null;
  // }
});

// Memwatch.on('stats', (stats) => {
//   console.log('memwatch::stats');
//   console.error(Util.inspect(stats, true, null));
//   console.log('memwatch::stats', {
//     Stats: stats
//   });
// });



