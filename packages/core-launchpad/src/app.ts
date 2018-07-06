
import * as exitHook from 'async-exit-hook';
import * as program from 'commander';
import * as extend from 'extend';
import * as appModulePath from 'app-module-path';
import * as fs from 'fs';
import * as jp from 'jsonpath';
import 'source-map-support/register';
// import { AppManager } from './AppManager';
// import { allExceptionCreator } from './exceptions';
import { AppConfig } from '@risevision/core-types';
import { fetchCoreModuleImplementations } from './modulesLoader';
import { configCreator } from './loadConfigs';
// import {
//   config as configCreator, constants as constantsType, ExceptionType, loggerCreator,
//   promiseToCB,
// } from './helpers/';

const packageJSONFile = `${process.env.PWD}/package.json`;
if (!fs.existsSync(packageJSONFile)) {
  console.error('Error: package.json does not exist in current directory');
  process.exit(1);
}

appModulePath.addPath(`${process.env.PWD}/node_modules`);

declare const gc; // garbage collection if exposed.

// tslint:disable-next-line

// if gc is exposed call it every minute
if (typeof(gc) !== 'undefined') {
  setInterval(gc, 60000);
}

const callingPackageJSON = require(packageJSONFile);

const modules = fetchCoreModuleImplementations(Object.keys(callingPackageJSON.dependencies));

program
  .version(callingPackageJSON.version)
  .option('-p, --port <port>', 'listening port number')
  .option('-a, --address <ip>', 'listening host name or ip')
  .option('--net <net>', 'Network to run on', 'mainnet')
  .option('-l, --log <level>', 'log level')
  .option('-s, --snapshot [round]', 'verify snapshot')
  .option('-c, --config <path>', 'custom config path')
  .option('-e, --extra-config <path>', 'partial override config path')
  .option('-o, --override-config <item>', 'Override single config item', (opt, opts) => {
    if (typeof(opts) === 'undefined') {
      opts = [];
    }
    const [path, val] = opt.split('=');
    if (typeof(path) === 'undefined' || typeof(val) === 'undefined') {
      // tslint:disable-next-line
      console.warn('Invalid format for invalid config. Correct is -> jsonpath=value');
      return opts;
    }
    try {
      jp.parse(path);
    } catch (e) {
      // tslint:disable-next-line
      console.warn('JSONPath is invalid', e);
    }
    opts.push({ path, val });
    return opts;
  });

// Ask modules to extend commander.
modules.forEach((m) => m.extendCommander(program));

program.parse(process.argv);

// tslint:disable-next-line
// const genesisBlock = require(`../etc/${program.net}/genesisBlock.json`);

let extraConfig = {};
if (program.extraConfig) {
  // tslint:disable-next-line no-var-requires
  extraConfig = require(program.extraConfig);
}
let appConfig: AppConfig = extend(
  true,
  {},
  configCreator(program.config ? program.config : `${process.env.PWD}/etc/${program.net}/config.json`, modules),
  extraConfig
);

if (program.port) {
  appConfig.port = program.port;
}
if (program.address) {
  appConfig.address = program.address;
}

if (program.overrideConfig) {
  for (const item of program.overrideConfig as Array<{ path: string, val: string }>) {
    const oldValue = jp.value(appConfig, item.path);

    if (typeof(oldValue) === 'number') {
      jp.value(appConfig, item.path, parseFloat(item.val));
    } else {
      jp.value(appConfig, item.path, item.val);
    }
    // tslint:disable-next-line
    console.warn(`Replaced config ${item.path}: ${oldValue} -> ${item.val}`);
  }
}

if (program.log) {
  appConfig.consoleLogLevel = program.log;
}

if (program.snapshot) {
  if (typeof(program.snapshot) === 'string') {
    appConfig.loading.snapshot = Math.abs(Math.floor(parseInt(program.snapshot, 10)));
  } else {
    appConfig.loading.snapshot = true;
  }
}

// Let submodules patch config through params provided on the CLI.
for (const m of modules) {
 if (typeof(m.afterConfigValidation) === 'function') {
   appConfig = m.patchConfigWithCLIParams(program, appConfig);
 }
}

//
// const logger = loggerCreator({
//   echo      : appConfig.consoleLogLevel,
//   errorLevel: appConfig.fileLogLevel,
//   filename  : appConfig.logFileName,
// });

/**
 * Takes care of bootstrapping the application
 * Returns cleanup function
 */
// async function boot(constants: typeof constantsType): Promise<AppManager> {
//   const manager = new AppManager(
//     appConfig,
//     logger,
//     versionBuild,
//     genesisBlock,
//     constants,
//     allExceptionCreator
//   );
//   await manager.boot();
//   return manager;
// }
//
// exitHook.forceExitTimeout(15000);
// exitHook.unhandledRejectionHandler((err) => {
//   logger.fatal('Unhandled Promise rejection', err);
// });
//
// boot(constantsType)
//   .catch((err) => {
//     logger.fatal('Error when instantiating');
//     logger.fatal(err);
//     process.exit(1);
//     return Promise.reject(err);
//   })
//   .then((manager) => {
//     exitHook((cb) => promiseToCB(manager.tearDown(), cb));
//   });
