import * as findPkg from 'find-pkg';
import * as path from 'path';
import { ICoreModule } from './module';

export function fetchCoreModuleImplementations(modules: string[]): ICoreModule[] {
  const allModules: ICoreModule[] = [];
  for (const m of modules) {
    try {
      const modulePath              = require.resolve(m, {paths: require.main.paths});
      const packageJsonPath         = findPkg.sync(modulePath);
      const packageJson             = require(packageJsonPath);
      if (!packageJson.rise_vision || !packageJson.rise_vision.module ) {
        // module is not a dependency.
        continue;
      }
      const CoreModule = require(modulePath).CoreModule;
      const moduleImpl: ICoreModule = new CoreModule();

      if (!moduleImpl.version) {
        moduleImpl.version = packageJson.version;
      }
      if (!moduleImpl.directory) {
        moduleImpl.directory = path.dirname(packageJsonPath);
      }
      moduleImpl.name = m;
      allModules.push(moduleImpl);
    } catch (e) {
      console.log(e);
      throw new Error(`Cannot import module ${m} - ${e.message}`);
    }
  }
  return allModules;
}