import { Container } from 'inversify';
import { loadCoreSortedModules, resolveModule } from '../../src/modulesLoader';
import { Symbols } from '../../../core-interfaces/dist';
import { z_schema } from '../../../core-utils';
import { WordPressHookSystem, InMemoryFilterModel } from 'mangiafuoco';
import { LoggerStub } from '../../../core-utils/test/stubs';
import { SignedAndChainedBlockType } from '../../../core-types/dist';
import { CoreSymbols } from '../../../core/dist';
import { ModelSymbols } from '../../../core-models/dist';
import { Model } from 'sequelize-typescript';
import * as path from 'path';

export function createContainer(modules: string[],
                                config: any = require('../assets/config.json'),
                                block: SignedAndChainedBlockType = require('../assets/genesisBlock.json')): Container {
  const container = new Container();
  const allDeps = {};
  for (const m of modules) {
    allDeps[`@risevision/${m}`] = resolveModule(path.resolve(`${__dirname}/../../../${m}`), allDeps);
  }
  const sortedModules = loadCoreSortedModules(allDeps);
  // , (m) => {
  //   const toRet = `${path.join(m.rootDirectory, 'src', 'index.ts')}`;
  //   console.log('requesting ',m.name, m.modulePath, toRet);
  //   return toRet;
  // });
  for (const sortedModule of sortedModules) {
    sortedModule.config = config;
    sortedModule.container = container;
    sortedModule.addElementsToContainer();
  }

  container.bind(Symbols.generic.genesisBlock).toConstantValue(block);
  container.bind(Symbols.generic.appConfig).toConstantValue(config);
  container.bind(Symbols.generic.nonce).toConstantValue('nonce');
  container.bind(Symbols.generic.versionBuild).toConstantValue('test');
  container.bind(Symbols.generic.zschema).toConstantValue(new z_schema({}));
  container.bind(Symbols.generic.hookSystem).toConstantValue(new WordPressHookSystem(new InMemoryFilterModel()));
  // container.bind(Symbols.helpers.logger).toConstantValue(new LoggerStub());

  for (const sortedModule of sortedModules) {
    sortedModule.initAppElements();
  }

  return container;
}