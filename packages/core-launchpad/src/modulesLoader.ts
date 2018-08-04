import DAG from 'dag-map';
import * as findPkg from 'find-pkg';
import * as path from 'path';
import { ICoreModule } from './module';

export function checkIsModule(packageJSONPath: string) {
  const packageJson = require(packageJSONPath);
  if (!packageJson.rise_vision || !packageJson.rise_vision.module) {
    // not a rise module
    return false;
  }
  return true;
}

// tslint:disable-next-line
type ModuleInfo = {
  name: string,
  modulePath: string,
  packageJSON: any,
  rootDirectory: any,
  subDeps: { [k: string]: ModuleInfo }
};

export function resolveModule(modulePath: string, allDependencies: any): ModuleInfo {
  const sourceModuleRootDirectory = path.dirname(findPkg.sync(modulePath));
  const packageJSON               = require(`${sourceModuleRootDirectory}/package.json`);
  const name                      = packageJSON.name;
  if (allDependencies[name]) {
    if (allDependencies[name].rootDirectory !== sourceModuleRootDirectory) {
      throw new Error(`Requiring a different version for ${name} ${allDependencies[name].rootDirectory} - ${sourceModuleRootDirectory}`);
    }
    return allDependencies[name];
  }
  const dependencies = packageJSON.dependencies;
  const depHandles   = Object.keys(dependencies);
  const subModules   = {};
  for (const depHandle of depHandles) {
    const subModulePath   = require.resolve(depHandle, {
      paths: [
        `${sourceModuleRootDirectory}/node_modules`,
        ...require.main.paths,
      ],
    });
    const packageJSONPath = findPkg.sync(subModulePath);
    if (checkIsModule(packageJSONPath)) {
      subModules[depHandle] = resolveModule(subModulePath, allDependencies);
    }

  }
  Object.keys(subModules)
    .forEach((k) => allDependencies[k] = subModules[k]);

  return {
    modulePath,
    name,
    packageJSON,
    rootDirectory: sourceModuleRootDirectory,
    subDeps      : subModules,
  };

}

export function fetchCoreModuleImplementations(appPath: string): Array<ICoreModule<any>> {
  const dag                                     = new DAG<ICoreModule<any>>();
  const allModules: { [k: string]: ModuleInfo } = {};
  resolveModule(appPath, allModules);

  for (const moduleName in allModules) {
    const moduleInfo                   = allModules[moduleName];
    console.log(moduleInfo.name, moduleInfo.modulePath)
    const CoreModule                   = require(moduleInfo.modulePath).CoreModule;
    const moduleImpl: ICoreModule<any> = new CoreModule();

    if (!moduleImpl.version) {
      moduleImpl.version = moduleInfo.packageJSON.version;
    }
    if (!moduleImpl.directory) {
      moduleImpl.directory = moduleInfo.rootDirectory;
    }
    moduleImpl.name = moduleInfo.name;
    dag.add(moduleImpl.name, moduleImpl, [], Object.keys(moduleInfo.subDeps));
  }

  const sortedModules: Array<ICoreModule<any>> = [];
  dag.each((k, item) => sortedModules.push(item));

  return sortedModules;
}
