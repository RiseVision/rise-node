import * as exitHook from 'async-exit-hook';
import * as program from 'commander';
import * as extend from 'extend';
import * as fs from 'fs';
import * as jp from 'jsonpath';
import 'source-map-support/register';
import { AppManager } from './AppManager';
import { allExceptionCreator } from './exceptions';
import {
  config as configCreator, constants as constantsType, loggerCreator,
  promiseToCB,
} from './helpers/';
import { SignedAndChainedBlockType } from './logic/';

declare const gc; // garbage collection if exposed.

// tslint:disable-next-line
const packageJson          = require('../package.json');
const versionBuild: string = fs.readFileSync(`${__dirname}/../build`, 'utf8');

// if gc is exposed call it every minute
if (typeof(gc) !== 'undefined') {
  setInterval(gc, 60000);
}

program
  .version(packageJson)
  .option('-n, --net <network>', 'network: mainnet, testnet', 'mainnet')
  .option('-p, --port <port>', 'listening port number')
  .option('-a, --address <ip>', 'listening host name or ip')
  .option('-x, --peers [peers...]', 'peers list')
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
  })
  .parse(process.argv);

// tslint:disable-next-line
const genesisBlock: SignedAndChainedBlockType = require(`../etc/${program.net}/genesisBlock.json`);

let extraConfig = {};
if (program.extraConfig) {
  // tslint:disable-next-line no-var-requires
  extraConfig = require(program.extraConfig);
}

const appConfig = extend(
  true,
  {},
  configCreator(program.config ? program.config : `./etc/${program.net}/config.json`),
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

if (program.peers) {
  if (typeof (program.peers) === 'string') {
    appConfig.peers.list = program.peers.split(',')
      .map((peer) => {
        const [ip, port] = peer.split(':');
        return { ip, port: port || appConfig.port };
      });
  } else {
    appConfig.peers.list = [];
  }
}

if (program.log) {
  appConfig.consoleLogLevel = program.log;
}

if (program.snapshot) {
  if (typeof(program.snapshot) === 'number') {
    appConfig.loading.snapshot = Math.abs(Math.floor(program.snapshot));
  } else {
    appConfig.loading.snapshot = true;
  }
}

const logger = loggerCreator({
  echo      : appConfig.consoleLogLevel,
  errorLevel: appConfig.fileLogLevel,
  filename  : appConfig.logFileName,
});

/**
 * Takes care of bootstrapping the application
 * Returns cleanup function
 */
async function boot(constants: typeof constantsType): Promise<AppManager> {
  const manager = new AppManager(
    appConfig,
    logger,
    versionBuild,
    genesisBlock,
    constants,
    allExceptionCreator
  );
  await manager.boot();
  return manager;
}

exitHook.forceExitTimeout(15000);
exitHook.unhandledRejectionHandler((err) => {
  logger.fatal('Unhandled Promise rejection', { message: err.message, stack: err.stack });
});

boot(constantsType)
  .catch((err) => {
    logger.fatal('Error when instantiating');
    logger.fatal(err);
    process.exit(1);
    return Promise.reject(err);
  })
  .then((manager) => {
    exitHook((cb) => promiseToCB(manager.tearDown(), cb));
  });
