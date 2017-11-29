declare const gc; // garbage collection if exposed.

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

import {
  applyExpressLimits,
  Bus,
  cache,
  cbToPromise,
  config as configCreator,
  Database,
  Ed,
  getLastCommit,
  loggerCreator,
  middleware,
  promiseToCB,
  Sequence,
  z_schema,
} from './helpers/';

import { AccountLogic, BlockLogic, Peers, SignedAndChainedBlockType, TransactionLogic, } from './logic/';

import {
  AccountsModule,
  BlocksModule,
  BlocksSubModules,
  Cache,
  DelegatesModule,
  LoaderModule,
  PeersModule,
  RoundsModule,
  ServerModule,
  SignaturesModule,
  SystemModule,
  TransactionsModule,
  TransportModule
} from './modules/';

// tslint:disable-next-line
const genesisBlock: SignedAndChainedBlockType = require('../genesisBlock.json');
// tslint:disable-next-line
const packageJson                             = require('../package.json');
const versionBuild                            = fs.readFileSync(`${__dirname}/../build`, 'utf8');

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
        return {ip, port: port || appConfig.port};
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
async function boot(): Promise<() => Promise<void>> {
  logger.info('Booting...');
  appConfig.nethash = genesisBlock.payloadHash;
  const schema      = new z_schema({});

  // create express app
  const app = express();

  const server = http.createServer(app);
  const io     = socketIO(server);

  const dbSequence = new Sequence({
    onWarning(current, limit) {
      logger.warn('DB queue', current);
    },
  });

  const mainSequence = new Sequence({
    onWarning(current, limit) {
      logger.warn('Main queue', current);
    },
  });

  const balancesSequence = new Sequence({
    onWarning(current, limit) {
      logger.warn('Balance queue', current);
    },
  });

  const nonce = uuid.v4();

  applyExpressLimits(app, appConfig);

  app.use(compression({level: 9}));
  app.use(cors());
  app.options('*', cors());

  app.use(express.static(`${__dirname}/public`));
  app.use(bodyParser.raw({limit: '2mb'}));
  app.use(bodyParser.urlencoded({extended: true, limit: '2mb', parameterLimit: 5000}));
  app.use(bodyParser.json({limit: '2mb'}));
  app.use(methodOverride());

  app.use(middleware.logClientConnections(logger));
  // Disallow inclusion in iframe.
  app.use(middleware.attachResponseHeader('X-Frame-Options', 'DENY'));

  /* Set Content-Security-Policy headers.
   *
   * frame-ancestors - Defines valid sources for <frame>, <iframe>, <object>, <embed> or <applet>.
   *
   * W3C Candidate Recommendation -> https://www.w3.org/TR/CSP/
   */
  app.use(middleware.attachResponseHeader('Content-Security-Policy', 'frame-ancestors \'none\''));

  app.use(middleware.applyAPIAccessRules(appConfig));

  const ed = new Ed();

  const bus = new Bus();

  const db = await Database.connect(appConfig.db, logger);

  const theCache = await cache.connect(
    appConfig.cacheEnabled,
    appConfig.redis,
    logger
  );

  // Logic loading.
  const accountLogic     = new AccountLogic({db, logger, schema});
  const transactionLogic = new TransactionLogic({
    account     : accountLogic,
    db,
    ed,
    genesisblock: genesisBlock,
    logger,
    schema,
  });

  const blockLogic = new BlockLogic({ed, schema, transaction: transactionLogic});

  const peersLogic = new Peers(logger);

  const logic = {
    account    : accountLogic,
    peers      : peersLogic,
    transaction: transactionLogic,
  };
  // modules.

  const modules = {
    accounts: new AccountsModule({ed, balancesSequence, logger, schema, logic}),
    blocks  : new BlocksModule({logger}),

    blocksChain: new BlocksSubModules.BlocksModuleChain({
      balancesSequence,
      bus,
      db,
      genesisblock: genesisBlock,
      logger,
      logic       : {
        block      : blockLogic,
        transaction: transactionLogic,
      },
    }),

    blocksProcess: new BlocksSubModules.BlocksModuleProcess({
      db,
      dbSequence,
      genesisblock: genesisBlock,
      logger,
      logic       : {
        block      : blockLogic,
        peers      : peersLogic,
        transaction: transactionLogic,
      },
      schema,
      sequence    : mainSequence,
    }),
    blocksUtils  : new BlocksSubModules.BlocksModuleUtils({
      db,
      dbSequence,
      genesisblock: genesisBlock,
      logger,
      logic       : {
        block      : blockLogic,
        transaction: transactionLogic,
      },
    }),
    blocksVerify : new BlocksSubModules.BlocksModuleVerify({
      db,
      logger,
      logic: {
        block      : blockLogic,
        transaction: transactionLogic,
      },
    }),
    cache        : new Cache({logger}, theCache.client, theCache.cacheEnabled),
    delegates    : new DelegatesModule({
      balancesSequence,
      config          : appConfig,
      db, ed, io, logger, logic,
      schema, sequence: mainSequence,
    }),
    loader       : new LoaderModule({
      balancesSequence,
      bus,
      config      : appConfig,
      db,
      genesisblock: genesisBlock,
      io,
      logger,
      logic,
      schema,
      sequence    : mainSequence,
    }),
    peers        : new PeersModule({
      build : versionBuild,
      bus,
      config: appConfig,
      db,
      lastCommit,
      logger,
      logic : {peers: peersLogic},
      nonce,
      schema,
    }),
    rounds       : new RoundsModule({
      bus,
      config: appConfig,
      db,
      io,
      logger,
    }),
    server       : new ServerModule(),
    signatures   : new SignaturesModule({
      balancesSequence,
      ed,
      logger,
      logic: {transaction: transactionLogic},
      schema,
    }),
    system       : new SystemModule({db, config: appConfig, logger, nonce}),
    transactions : new TransactionsModule({
      balancesSequence,
      bus,
      config      : appConfig,
      db,
      ed,
      genesisblock: genesisBlock,
      logger,
      logic       : {transaction: transactionLogic},
      schema,
    }),
    transport    : new TransportModule({
      balancesSequence, bus,
      config: appConfig,
      db, io, logger,
      logic : {
        block      : blockLogic,
        peers      : peersLogic,
        transaction: transactionLogic,
      },
      schema,
    }),
  };

  // apis.
  // TODO: APIS

  // save genesis
  await modules.blocksChain.saveGenesisBlock();
  // bind modules
  bus.modules = modules;
  await bus.message('bind', modules);

  transactionLogic.bindModules(modules);
  peersLogic.bindModules(modules);

  // listen http
  await cbToPromise((cb) => server.listen(appConfig.port, appConfig.address, cb));
  logger.info(`Server started: ${appConfig.address}:${appConfig.port}`);

  logger.info('Modules ready and launched');

  // load blockchain
  let cleaning  = false;
  const cleanup = async () => {
    if (cleaning) {
      return;
    }
    cleaning = true;
    logger.info('Cleaning up...');
    const moduleKeys = Object.keys(modules);
    try {
      await Promise.all(moduleKeys
        .filter((k) => typeof(modules[k].cleanup) === 'function')
        .map((k) => modules[k].cleanup()));
      logger.info('Cleaned up successfully');
    } catch (err) {
      logger.error(err);
    }
  };

  modules.loader.loadBlockChain()
    .catch((err) => {
      logger.warn('Cannot load blockchain', err.message || err);
      return Promise.reject(err);
    });

  return cleanup;
}

boot()
  .then((cleanupFN) => {
    exitHook.forceExitTimeout(15000);
    exitHook((cb) => promiseToCB(cleanupFN(), cb));
    // exitHook.uncaughtExceptionHandler((err) => {
    //  logger.fatal('System error', {message: err.message, stack: err.stack});
    // });
    exitHook.unhandledRejectionHandler((err) => {
      logger.fatal('Unhandled Promise rejection', {message: err.message, stack: err.stack});
    });
  });
