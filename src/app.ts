import * as exitHook from 'async-exit-hook';
import * as program from 'commander';
import * as fs from 'fs';
import { AppManager } from './AppManager';
import { allExceptionCreator } from './exceptions';
import {
  config as configCreator, constants as constantsType, getLastCommit, loggerCreator,
  promiseToCB,
} from './helpers/';
import { SignedAndChainedBlockType } from './logic/';

declare const gc; // garbage collection if exposed.

// tslint:disable-next-line
const genesisBlock: SignedAndChainedBlockType = require('../genesisBlock.json');
// tslint:disable-next-line
const packageJson                             = require('../package.json');
const versionBuild: string                    = fs.readFileSync(`${__dirname}/../build`, 'utf8');

// if gc is exposed call it every minute
if (typeof(gc) !== 'undefined') {
  setInterval(gc, 60000);
}

program
  .version(packageJson)
  .option('-c, --config <path>', 'config file path')
  .option('-p, --port <port>', 'listening port number')
  .option('-a, --address <ip>', 'listening host name or ip')
  .option('-x, --peers [peers...]', 'peers list')
  .option('-l, --log <level>', 'log level')
  .option('-s, --snapshot <round>', 'verify snapshot')
  .parse(process.argv);

const appConfig = configCreator(program.config);
if (program.port) {
  appConfig.port = program.port;
}
if (program.address) {
  appConfig.address = program.address;
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
  appConfig.loading.snapshot = Math.abs(Math.floor(program.snapshot));
}

const logger = loggerCreator({
  echo      : appConfig.consoleLogLevel,
  errorLevel: appConfig.fileLogLevel,
  filename  : appConfig.logFileName,
});

let lastCommit: string;
try {
  lastCommit = getLastCommit();
} catch (err) {
  logger.debug('Cannot get last git commit', err.message);
}

/**
 * Takes care of bootstrapping the application
 * Returns cleanup function
 */
async function boot(constants: typeof constantsType): Promise<AppManager> {
  const manager = new AppManager(
    appConfig,
    logger,
    lastCommit,
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
    logger.fatal('Error when instantiating', err);
    process.exit(1);
    return Promise.reject(err);
  })
  .then((manager) => {
    exitHook((cb) => promiseToCB(manager.tearDown(), cb));
  });
