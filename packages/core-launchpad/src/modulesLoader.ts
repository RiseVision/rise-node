import * as findPkg from 'find-pkg';
import * as path from 'path';
import { ICoreModule } from './module';

export function fetchCoreModuleImplementations(modules: string[]): ICoreModule[] {
  const allModules: ICoreModule[] = [];
  for (const m of modules) {
    try {
      const modulePath              = require.resolve(m);
      const moduleImpl: ICoreModule = require(m).Module;
      const packageJsonPath         = findPkg.sync(modulePath);
      const packageJson             = require(packageJsonPath);
      if (!moduleImpl.version) {
        moduleImpl.version = packageJson.version;
      }
      if (!moduleImpl.directory) {
        moduleImpl.directory = path.dirname(packageJsonPath);
      }
      moduleImpl.name = m;
      allModules.push(moduleImpl);
    } catch (e) {
      throw new Error(`Cannot import module ${m} - ${e.message}`);
    }
  }
  return allModules;
}

const r = fetchCoreModuleImplementations(['@risevision/core-types']);
console.log(r);