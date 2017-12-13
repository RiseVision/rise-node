import * as exitHook from 'async-exit-hook';
import * as bodyParser from 'body-parser';
import * as program from 'commander';
import * as compression from 'compression';
import * as cors from 'cors';
import * as express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as methodOverride from 'method-override';
import * as socketIO from 'socket.io';
import * as uuid from 'uuid';
import container from './ioc/container';
import { Symbols } from './ioc/symbols';

import {
  applyExpressLimits, Bus,  cache, cbToPromise, config as configCreator, constants as constantsType, Database, Ed, getLastCommit,
  loggerCreator, middleware, promiseToCB, Sequence, Slots, z_schema,
} from './helpers/';

import {
  AccountLogic, AppState, BlockLogic, BlockRewardLogic, BroadcasterLogic, PeerLogic, PeersLogic, RoundsLogic,
  SignedAndChainedBlockType,
  TransactionLogic, TransactionPool
} from './logic/';
import * as TXs from './logic/transactions';

import {
  AccountsModule, BlocksModule, BlocksSubModules, Cache, DelegatesModule, ForgeModule, LoaderModule,
  MultisignaturesModule, PeersModule, RoundsModule, SystemModule, TransactionsModule, TransportModule
} from './modules/';
import {
  MultiSignatureTransaction, RegisterDelegateTransaction, SecondSignatureTransaction, SendTransaction,
  VoteTransaction
} from './logic/transactions';
import { BlocksModuleChain, BlocksModuleProcess, BlocksModuleUtils, BlocksModuleVerify } from './modules/blocks';
import { ForkModule } from './modules/fork';

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
async function boot(constants: typeof constantsType): Promise<() => Promise<void>> {
  logger.info('Booting...');
  appConfig.nethash = genesisBlock.payloadHash;
  const schema      = new z_schema({});

  // create express app
  const app = express();
  const server = http.createServer(app);
  const io     = socketIO(server);

  const nonce = uuid.v4();
  const ed = new Ed();
  const bus = new Bus();
  const db = await Database.connect(appConfig.db, logger);
  const theCache = await cache.connect(
    appConfig.cacheEnabled,
    appConfig.redis,
    logger
  );


  // HTTP APIs

  console.log(container.get<BlockRewardLogic>(Symbols.logic.blockReward));


  // // apis.
  // // TODO: APIS
  //
  // // save genesis
  // await modules.blocksChain.saveGenesisBlock();
  // // bind modules
  // bus.modules = modules;
  // await bus.message('bind', modules);
  //
  // // transactionLogic.bindModules(modules);
  // peersLogic.bindModules(modules);
  // broadcasterLogic.bind(
  //   modules.peers,
  //   modules.transport,
  //   modules.transactions
  // );
  // transactionPool.bind(modules.accounts, modules.transactions);
  //
  // // Register and create txtypes.
  // const txTypes = [
  //   new TXs.SendTransaction({
  //     modules: {
  //       accounts: modules.accounts,
  //       system  : modules.system,
  //     },
  //     rounds : logic.rounds,
  //   }),
  //   new TXs.VoteTransaction({
  //     account: logic.account,
  //     logger,
  //     modules: {
  //       delegates: modules.delegates,
  //       system   : modules.system,
  //     },
  //     rounds : logic.rounds,
  //     schema,
  //   }),
  //   new TXs.SecondSignatureTransaction({
  //     logger,
  //     modules: {
  //       accounts: modules.accounts,
  //       system  : modules.system,
  //     },
  //     schema,
  //   }),
  //   new TXs.RegisterDelegateTransaction({
  //     modules: {
  //       accounts: modules.accounts,
  //       system  : modules.system,
  //     },
  //     schema,
  //   }),
  //   new TXs.MultiSignatureTransaction({
  //     account    : logic.account,
  //     io,
  //     logger,
  //     modules    : {
  //       accounts: modules.accounts,
  //       system  : modules.system,
  //     },
  //     roundsLogic: logic.rounds,
  //     schema,
  //     transaction: logic.transaction,
  //   }),
  // ];
  // // Register them.
  // txTypes.forEach((txType) => logic.transaction.attachAssetType(txType as any));
  //
  // // listen http
  // await cbToPromise((cb) => server.listen(appConfig.port, appConfig.address, cb));
  // logger.info(`Server started: ${appConfig.address}:${appConfig.port}`);
  //
  // logger.info('Modules ready and launched');
  //
  // // load blockchain
  // let cleaning  = false;
  // const cleanup = async () => {
  //   if (cleaning) {
  //     return;
  //   }
  //   cleaning = true;
  //   logger.info('Cleaning up...');
  //   const moduleKeys = Object.keys(modules);
  //   try {
  //     await Promise.all(moduleKeys
  //       .filter((k) => typeof(modules[k].cleanup) === 'function')
  //       .map((k) => modules[k].cleanup()));
  //     logger.info('Cleaned up successfully');
  //   } catch (err) {
  //     logger.error(err);
  //   }
  // };
  //
  // modules.loader.loadBlockChain()
  //   .catch((err) => {
  //     logger.warn('Cannot load blockchain', err.message || err);
  //     return Promise.reject(err);
  //   });
  //
  // return cleanup;
  return null;
}

boot(constantsType)
  .then((cleanupFN) => {
    exitHook.forceExitTimeout(15000);
    exitHook((cb) => promiseToCB(cleanupFN(), cb));
    // exitHook.uncaughtExceptionHandler((err) => {
    //  logger.fatal('System error', {message: err.message, stack: err.stack});
    // });
    exitHook.unhandledRejectionHandler((err) => {
      logger.fatal('Unhandled Promise rejection', { message: err.message, stack: err.stack });
    });
  })
  .catch((err) => {
    logger.fatal('Error when instantiating', err);
  });
