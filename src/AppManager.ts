import * as bodyParser from 'body-parser';
import * as compression from 'compression';
import * as cors from 'cors';
import * as express from 'express';
import * as http from 'http';
import { Container } from 'inversify';
import * as methodOverride from 'method-override';
import 'reflect-metadata';
import { useContainer as useContainerForHTTP, useExpressServer } from 'routing-controllers';
import * as socketIO from 'socket.io';
import * as uuid from 'uuid';
import { allControllers, APIErrorHandler } from './apis';
import { SuccessInterceptor } from './apis/utils/successInterceptor';
import { ValidatePeerHeaders } from './apis/utils/validatePeerHeaders';
import {
  applyExpressLimits, Bus, cache, catchToLoggerAndRemapError, cbToPromise, constants as constantsType, Database, Ed,
  ExceptionsManager, ILogger, middleware, Sequence, Slots, z_schema,
} from './helpers/';
import { IPeerLogic, ITransactionLogic } from './ioc/interfaces/logic';
import { IBlocksModuleChain } from './ioc/interfaces/modules';
import { Symbols } from './ioc/symbols';
import {
  AccountLogic, AppState, BasePeerType, BlockLogic, BlockRewardLogic, BroadcasterLogic, PeerLogic, PeersLogic,
  RoundsLogic,
  SignedAndChainedBlockType, TransactionLogic, TransactionPool
} from './logic/';
import {
  BaseTransactionType, MultiSignatureTransaction, RegisterDelegateTransaction, SecondSignatureTransaction,
  SendTransaction, VoteTransaction
} from './logic/transactions';

import {
  AccountsModule, BlocksModule, Cache, DelegatesModule, ForgeModule, LoaderModule, MultisignaturesModule,
  PeersModule, RoundsModule, SystemModule, TransactionsModule, TransportModule
} from './modules/';
import { BlocksModuleChain, BlocksModuleProcess, BlocksModuleUtils, BlocksModuleVerify } from './modules/blocks/';
import { ForkModule } from './modules/fork';
import { AppConfig } from './types/genericTypes';

// import {makeLoggerMiddleware} from 'inversify-logger-middleware';
// const theLogger = makeLoggerMiddleware();

export class AppManager {
  public container: Container = new Container();

  private nonce: string    = uuid.v4();
  private schema: z_schema = new z_schema({});
  private isCleaning       = false;
  private server: http.Server;
  private expressApp: express.Express;

  constructor(private appConfig: AppConfig,
              private logger: ILogger,
              private lastCommit: string,
              private versionBuild: string,
              private genesisBlock: SignedAndChainedBlockType,
              private constants: typeof constantsType,
              private excCreators: Array<(ex: ExceptionsManager) => void>) {
    this.appConfig.nethash = genesisBlock.payloadHash;
    // this.container.applyMiddleware(theLogger);
  }

  /**
   * Starts the application
   */
  public async boot() {
    this.logger.info('Booting');
    await this.initAppElements();
    await this.initExpress();
    this.finishBoot(); // This promise is intentionally not awaited.
  }

  /**
   * Method to tear down the application
   */
  public async tearDown() {
    if (this.isCleaning) {
      return;
    }
    this.isCleaning = true;
    this.logger.info('Cleaning up...');

    const modules = this.getModules();

    try {
      await Promise.all(modules
        .filter((module) => typeof(module.cleanup) === 'function')
        .map((module) => module.cleanup()));
      this.logger.info('Cleaned up successfully');
    } catch (err) {
      this.logger.error(err);
    }
  }

  /**
   * Initialize http endpoints.
   */
  private async initExpress() {
    const app = this.container.get<express.Application>(Symbols.generic.expressApp);
    applyExpressLimits(app, this.appConfig);

    app.use(compression({level: 9}));
    app.use(cors());
    app.options('*', cors());

    app.use(express.static(`${__dirname}/../public`));
    app.use(bodyParser.raw({limit: '2mb'}));
    app.use(bodyParser.urlencoded({extended: true, limit: '2mb', parameterLimit: 5000}));
    app.use(bodyParser.json({limit: '2mb'}));
    app.use(methodOverride());

    app.use(middleware.logClientConnections(this.logger));
    // Disallow inclusion in iframe.
    app.use(middleware.attachResponseHeader('X-Frame-Options', 'DENY'));

    /* Set Content-Security-Policy headers.
     *
     * frame-ancestors - Defines valid sources for <frame>, <iframe>, <object>, <embed> or <applet>.
     *
     * W3C Candidate Recommendation -> https://www.w3.org/TR/CSP/
     */
    app.use(middleware.attachResponseHeader('Content-Security-Policy', 'frame-ancestors \'none\''));

    app.use(middleware.applyAPIAccessRules(this.appConfig));

    // Init HTTP Apis
    const container = this.container;
    useContainerForHTTP({
        get(clz: any) {
          const symbol = Reflect.getMetadata(Symbols.__others.metadata.classSymbol, clz);
          if (symbol == null) {
            throw new Error(`ERROR instantiating for HTTP ${symbol}`);
          }
          return container
            .get(symbol);
        },
      }
    );
    useExpressServer(
      this.expressApp,
      {
        controllers        : allControllers,
        defaultErrorHandler: false,
        middlewares        : [APIErrorHandler],
      }
    );

  }

  /**
   * Initialize all app dependencies into the IoC container.
   */
  private async initAppElements() {
    this.expressApp = express();

    this.server    = http.createServer(this.expressApp);
    const io       = socketIO(this.server);
    const db       = await Database.connect(this.appConfig.db, this.logger);
    const theCache = await cache.connect(
      this.appConfig.cacheEnabled,
      this.appConfig.redis,
      this.logger
    );
    const ed       = new Ed();
    const bus      = new Bus();

    // HTTP APIs
    for (const controller of allControllers) {
      const symbol = Reflect.getMetadata(
        Symbols.__others.metadata.classSymbol,
        controller
      );
      this.container.bind(symbol).to(controller).inSingletonScope();
    }
    this.container.bind(Symbols.api.utils.errorHandler).to(APIErrorHandler).inSingletonScope();
    this.container.bind(Symbols.api.utils.successInterceptor).to(SuccessInterceptor).inSingletonScope();
    this.container.bind(Symbols.api.utils.validatePeerHeadersMiddleware).to(ValidatePeerHeaders).inSingletonScope();

    // Generics
    this.container.bind(Symbols.generic.appConfig).toConstantValue(this.appConfig);
    this.container.bind(Symbols.generic.db).toConstantValue(db);
    this.container.bind(Symbols.generic.expressApp).toConstantValue(this.expressApp);
    this.container.bind(Symbols.generic.genesisBlock).toConstantValue(this.genesisBlock);
    this.container.bind(Symbols.generic.lastCommit).toConstantValue(this.lastCommit);
    this.container.bind(Symbols.generic.nonce).toConstantValue(this.nonce);
    this.container.bind(Symbols.generic.redisClient).toConstantValue(theCache.client);
    this.container.bind(Symbols.generic.socketIO).toConstantValue(io);
    this.container.bind(Symbols.generic.versionBuild).toConstantValue(this.versionBuild);
    this.container.bind(Symbols.generic.zschema).toConstantValue(this.schema);

    // Helpers
    this.container.bind(Symbols.helpers.bus).toConstantValue(bus);
    this.container.bind(Symbols.helpers.constants).toConstantValue(this.constants);
    this.container.bind(Symbols.helpers.ed).toConstantValue(ed);
    this.container.bind(Symbols.helpers.exceptionsManager).to(ExceptionsManager).inSingletonScope();
    this.container.bind(Symbols.helpers.logger).toConstantValue(this.logger);
    // this.container.bind(Symbols.helpers.sequence).toConstantValue();
    [Symbols.tags.helpers.dbSequence, Symbols.tags.helpers.defaultSequence, Symbols.tags.helpers.balancesSequence]
      .forEach((sequenceTag) => {
        this.container.bind(Symbols.helpers.sequence)
          .toConstantValue(new Sequence({
            onWarning(current) {
              this.logger.warn(`${sequenceTag} queue`, current);
            },
          }))
          .whenTargetTagged(Symbols.helpers.sequence, sequenceTag);
      });
    this.container.bind(Symbols.helpers.slots).to(Slots).inSingletonScope();

    // Logic
    this.container.bind(Symbols.logic.account).to(AccountLogic).inSingletonScope();
    this.container.bind(Symbols.logic.appState).to(AppState).inSingletonScope();
    this.container.bind(Symbols.logic.block).to(BlockLogic).inSingletonScope();
    this.container.bind(Symbols.logic.blockReward).to(BlockRewardLogic).inSingletonScope();
    this.container.bind(Symbols.logic.broadcaster).to(BroadcasterLogic).inSingletonScope();
    this.container.bind(Symbols.logic.peer).to(PeerLogic);
    this.container.bind(Symbols.logic.peerFactory).toFactory((ctx) => {
      return (peer: BasePeerType) => {
        const p = ctx.container.get<IPeerLogic>(Symbols.logic.peer);
        p.accept({... {}, ...peer});
        return p;
      };
    });
    this.container.bind(Symbols.logic.peers).to(PeersLogic).inSingletonScope();
    // this.container.bind(Symbols.logic.round).to(RoundLogic).inSingletonScope();
    this.container.bind(Symbols.logic.rounds).to(RoundsLogic).inSingletonScope();
    this.container.bind(Symbols.logic.transaction).to(TransactionLogic).inSingletonScope();
    this.container.bind(Symbols.logic.transactionPool).to(TransactionPool).inSingletonScope();
    this.container.bind(Symbols.logic.transactions.send).to(SendTransaction).inSingletonScope();
    this.container.bind(Symbols.logic.transactions.vote).to(VoteTransaction).inSingletonScope();
    this.container.bind(Symbols.logic.transactions.createmultisig).to(MultiSignatureTransaction).inSingletonScope();
    this.container.bind(Symbols.logic.transactions.delegate).to(RegisterDelegateTransaction).inSingletonScope();
    this.container.bind(Symbols.logic.transactions.secondSignature).to(SecondSignatureTransaction).inSingletonScope();

    // Modules
    this.container.bind(Symbols.modules.accounts).to(AccountsModule).inSingletonScope();
    this.container.bind(Symbols.modules.blocks).to(BlocksModule).inSingletonScope();
    this.container.bind(Symbols.modules.blocksSubModules.chain).to(BlocksModuleChain).inSingletonScope();
    this.container.bind(Symbols.modules.blocksSubModules.process).to(BlocksModuleProcess).inSingletonScope();
    this.container.bind(Symbols.modules.blocksSubModules.utils).to(BlocksModuleUtils).inSingletonScope();
    this.container.bind(Symbols.modules.blocksSubModules.verify).to(BlocksModuleVerify).inSingletonScope();
    this.container.bind(Symbols.modules.cache).to(Cache).inSingletonScope();
    this.container.bind(Symbols.modules.delegates).to(DelegatesModule).inSingletonScope();
    this.container.bind(Symbols.modules.forge).to(ForgeModule).inSingletonScope();
    this.container.bind(Symbols.modules.fork).to(ForkModule).inSingletonScope();
    this.container.bind(Symbols.modules.loader).to(LoaderModule).inSingletonScope();
    this.container.bind(Symbols.modules.multisignatures).to(MultisignaturesModule).inSingletonScope();
    this.container.bind(Symbols.modules.peers).to(PeersModule).inSingletonScope();
    this.container.bind(Symbols.modules.rounds).to(RoundsModule).inSingletonScope();
    this.container.bind(Symbols.modules.system).to(SystemModule).inSingletonScope();
    this.container.bind(Symbols.modules.transactions).to(TransactionsModule).inSingletonScope();
    this.container.bind(Symbols.modules.transport).to(TransportModule).inSingletonScope();

    // Add exceptions by attaching exception handlers to the manager.
    const exceptionsManager = this.container.get<ExceptionsManager>(Symbols.helpers.exceptionsManager);
    this.excCreators
      .forEach((exc) => exc(exceptionsManager));
  }

  private async finishBoot() {
    const bus   = this.container.get<Bus>(Symbols.helpers.bus);
    bus.modules = this.getModules();

    // Register transaction types.
    const txLogic = this.container.get<ITransactionLogic>(Symbols.logic.transaction);
    const txs     = this.getElementsFromContainer<BaseTransactionType<any>>(Symbols.logic.transactions);
    txs.forEach((tx) => txLogic.attachAssetType(tx));

    const blocksChainModule = this.container.get<IBlocksModuleChain>(Symbols.modules.blocksSubModules.chain);
    await blocksChainModule.saveGenesisBlock();

    // Listen HTTP
    await cbToPromise((cb) => this.server.listen(this.appConfig.port, this.appConfig.address, cb));
    this.logger.info(`Server started: ${this.appConfig.address}:${this.appConfig.port}`);

    this.logger.info('Modules ready and launched. Loading Blockchain...');
    const loaderModule = this.container.get<LoaderModule>(Symbols.modules.loader);
    await loaderModule.loadBlockChain()
      .catch(catchToLoggerAndRemapError('Cannot load blockchain', this.logger));
    this.logger.info('App Booted');

  }

  private getElementsFromContainer<T = any>(symbols: { [k: string]: symbol | { [k: string]: symbol } }): T[] {
    return Object
      .keys(symbols)
      .filter((k) => typeof(symbols[k]) === 'symbol')
      .map((k) => this.container.get(symbols[k] as symbol))
      .concat(
        Object.keys(symbols)
          .filter((k) => typeof(symbols[k]) !== 'symbol')
          .map<T[]>((k) => this.getElementsFromContainer(symbols[k] as any))
          .reduce((a, b) => a.concat(b), [] as any)
      ) as any; // FIXME ?
  }

  /**
   * Returns all the modules
   */
  private getModules(): any[] {
    return this.getElementsFromContainer(Symbols.modules);
  }
}
