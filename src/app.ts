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

  // Generics
  container.bind(Symbols.generic.appConfig).toConstantValue(appConfig);
  container.bind(Symbols.generic.db).toConstantValue(db);
  container.bind(Symbols.generic.genesisBlock).toConstantValue(genesisBlock);
  container.bind(Symbols.generic.lastCommit).toConstantValue(lastCommit);
  container.bind(Symbols.generic.nonce).toConstantValue(nonce);
  container.bind(Symbols.generic.redisClient).toConstantValue(theCache.client);
  container.bind(Symbols.generic.socketIO).toConstantValue(io);
  container.bind(Symbols.generic.versionBuild).toConstantValue(versionBuild);
  container.bind(Symbols.generic.zschema).toConstantValue(schema);

  // Helpers
  container.bind(Symbols.helpers.bus).toConstantValue(bus);
  container.bind(Symbols.helpers.constants).toConstantValue(constants);
  container.bind(Symbols.helpers.ed).toConstantValue(ed);
  container.bind(Symbols.helpers.logger).toConstantValue(logger);
  // container.bind(Symbols.helpers.sequence).toConstantValue();
  [Symbols.tags.helpers.dbSequence, Symbols.tags.helpers.defaultSequence, Symbols.tags.helpers.balancesSequence]
    .forEach((sequenceTag) => {
      container.bind(Symbols.helpers.sequence)
        .toConstantValue(new Sequence({
          onWarning(current) {
            logger.warn(`${sequenceTag} queue`, current);
          },
        }))
        .whenTargetTagged(Symbols.helpers.sequence, sequenceTag);
    });
  container.bind(Symbols.helpers.slots).to(Slots).inSingletonScope();

  // Logic
  container.bind(Symbols.logic.account).to(AccountLogic).inSingletonScope();
  container.bind(Symbols.logic.appState).to(AppState).inSingletonScope();
  container.bind(Symbols.logic.block).to(BlockLogic).inSingletonScope();
  container.bind(Symbols.logic.blockReward).to(BlockRewardLogic).inSingletonScope();
  container.bind(Symbols.logic.broadcaster).to(BroadcasterLogic).inSingletonScope();
  container.bind(Symbols.logic.peer).to(PeerLogic).inSingletonScope();
  container.bind(Symbols.logic.peers).to(PeersLogic).inSingletonScope();
  // container.bind(Symbols.logic.round).to(RoundLogic).inSingletonScope();
  container.bind(Symbols.logic.rounds).to(RoundsLogic).inSingletonScope();
  container.bind(Symbols.logic.transaction).to(TransactionLogic).inSingletonScope();
  container.bind(Symbols.logic.transactionPool).to(TransactionPool).inSingletonScope();
  container.bind(Symbols.logic.transactions.send).to(SendTransaction).inSingletonScope();
  container.bind(Symbols.logic.transactions.vote).to(VoteTransaction).inSingletonScope();
  container.bind(Symbols.logic.transactions.createmultisig).to(MultiSignatureTransaction).inSingletonScope();
  container.bind(Symbols.logic.transactions.delegate).to(RegisterDelegateTransaction).inSingletonScope();
  container.bind(Symbols.logic.transactions.secondSignature).to(SecondSignatureTransaction).inSingletonScope();


  console.log(container.get<BlockRewardLogic>(Symbols.logic.blockReward));

  // applyExpressLimits(app, appConfig);
  //
  // app.use(compression({ level: 9 }));
  // app.use(cors());
  // app.options('*', cors());
  //
  // app.use(express.static(`${__dirname}/public`));
  // app.use(bodyParser.raw({ limit: '2mb' }));
  // app.use(bodyParser.urlencoded({ extended: true, limit: '2mb', parameterLimit: 5000 }));
  // app.use(bodyParser.json({ limit: '2mb' }));
  // app.use(methodOverride());
  //
  // app.use(middleware.logClientConnections(logger));
  // // Disallow inclusion in iframe.
  // app.use(middleware.attachResponseHeader('X-Frame-Options', 'DENY'));
  //
  // /* Set Content-Security-Policy headers.
  //  *
  //  * frame-ancestors - Defines valid sources for <frame>, <iframe>, <object>, <embed> or <applet>.
  //  *
  //  * W3C Candidate Recommendation -> https://www.w3.org/TR/CSP/
  //  */
  // app.use(middleware.attachResponseHeader('Content-Security-Policy', 'frame-ancestors \'none\''));
  //
  // app.use(middleware.applyAPIAccessRules(appConfig));
  //
  //
  // // Logic loading.
  // const roundsLogic      = new RoundsLogic(Slots);
  // const appState         = new AppState();
  // const accountLogic     = new AccountLogic({ db, logger, schema });
  // const transactionLogic = new TransactionLogic({
  //   account     : accountLogic,
  //   db,
  //   ed,
  //   genesisblock: genesisBlock,
  //   logger,
  //   rounds      : roundsLogic,
  //   schema,
  // });
  // const transactionPool  = new TransactionPool(
  //   transactionLogic,
  //   appState,
  //   bus,
  //   logger,
  //   appConfig
  // );
  //
  // const blockLogic = new BlockLogic({ ed, schema, transaction: transactionLogic });
  //
  // const peersLogic = new PeersLogic(logger);
  //
  // const broadcasterLogic = new BroadcasterLogic({
  //   config: appConfig,
  //   logger,
  //   logic : {
  //     appState,
  //     peers       : peersLogic,
  //     transactions: transactionLogic,
  //   },
  // });
  // const logic            = {
  //   account    : accountLogic,
  //   appState,
  //   broadcaster: broadcasterLogic,
  //   peers      : peersLogic,
  //   rounds     : roundsLogic,
  //   transaction: transactionLogic,
  // };
  // // modules.
  //
  // const modules = {
  //   accounts: new AccountsModule({ ed, balancesSequence, logger, schema, logic }),
  //   blocks  : new BlocksModule({ logger }),
  //
  //   blocksChain: new BlocksSubModules.BlocksModuleChain({
  //     balancesSequence,
  //     bus,
  //     db,
  //     genesisblock: genesisBlock,
  //     logger,
  //     logic       : {
  //       block      : blockLogic,
  //       transaction: transactionLogic,
  //     },
  //   }),
  //
  //   blocksProcess  : new BlocksSubModules.BlocksModuleProcess({
  //     db,
  //     dbSequence,
  //     genesisblock: genesisBlock,
  //     logger,
  //     logic       : {
  //       appState,
  //       block      : blockLogic,
  //       peers      : peersLogic,
  //       rounds     : roundsLogic,
  //       transaction: transactionLogic,
  //     },
  //     schema,
  //     sequence    : mainSequence,
  //   }),
  //   blocksUtils    : new BlocksSubModules.BlocksModuleUtils({
  //     db,
  //     dbSequence,
  //     genesisblock: genesisBlock,
  //     logger,
  //     logic       : {
  //       block      : blockLogic,
  //       transaction: transactionLogic,
  //     },
  //   }),
  //   blocksVerify   : new BlocksSubModules.BlocksModuleVerify({
  //     db,
  //     logger,
  //     logic: {
  //       block      : blockLogic,
  //       transaction: transactionLogic,
  //     },
  //   }),
  //   cache          : new Cache({ logger }, theCache.client, theCache.cacheEnabled),
  //   delegates      : new DelegatesModule({
  //     balancesSequence,
  //     config          : appConfig,
  //     db, ed, io, logger, logic,
  //     schema, sequence: mainSequence,
  //   }),
  //   forge          : new ForgeModule({
  //     config  : appConfig,
  //     ed, logger, logic,
  //     sequence: mainSequence,
  //   }),
  //   loader         : new LoaderModule({
  //     balancesSequence,
  //     bus,
  //     config      : appConfig,
  //     db,
  //     genesisblock: genesisBlock,
  //     io,
  //     logger,
  //     logic,
  //     schema,
  //     sequence    : mainSequence,
  //   }),
  //   multisignatures: new MultisignaturesModule({
  //     balancesSequence,
  //     bus,
  //     db,
  //     ed,
  //     genesisblock: genesisBlock,
  //     io,
  //     logger,
  //     logic       : { account: accountLogic, transaction: transactionLogic },
  //     schema,
  //   }),
  //   peers          : new PeersModule({
  //     build : versionBuild,
  //     bus,
  //     config: appConfig,
  //     db,
  //     lastCommit,
  //     logger,
  //     logic : { peers: peersLogic },
  //     nonce,
  //     schema,
  //   }),
  //   rounds         : new RoundsModule({
  //     bus,
  //     config: appConfig,
  //     db,
  //     io,
  //     logger,
  //     logic,
  //   }),
  //   system         : new SystemModule({ db, config: appConfig, logger, nonce }),
  //   transactions   : new TransactionsModule({
  //     balancesSequence,
  //     bus,
  //     config      : appConfig,
  //     db,
  //     ed,
  //     genesisblock: genesisBlock,
  //     logger,
  //     logic       : { rounds: roundsLogic, transaction: transactionLogic, transactionPool },
  //     schema,
  //   }),
  //   transport      : new TransportModule({
  //     balancesSequence, bus,
  //     config: appConfig,
  //     db, io, logger,
  //     logic : {
  //       appState,
  //       block      : blockLogic,
  //       broadcaster: broadcasterLogic,
  //       peers      : peersLogic,
  //       transaction: transactionLogic,
  //     },
  //     schema,
  //   }),
  // };
  //
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
