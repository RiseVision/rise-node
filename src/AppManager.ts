import * as bodyParser from 'body-parser';
import * as cls from 'cls-hooked';
import * as compression from 'compression';
import * as cors from 'cors';
import * as express from 'express';
import * as http from 'http';
import { Container } from 'inversify';
import * as pg from 'pg';
import 'reflect-metadata';
import { useContainer as useContainerForHTTP, useExpressServer } from 'routing-controllers';
import { Model, Sequelize } from 'sequelize-typescript';
import * as socketIO from 'socket.io';
import * as uuid from 'uuid';
import { allControllers, APIErrorHandler } from './apis';
import { CommonBlockRequest } from './apis/requests/CommonBlockRequest';
import { GetBlocksRequest } from './apis/requests/GetBlocksRequest';
import { GetSignaturesRequest } from './apis/requests/GetSignaturesRequest';
import { GetTransactionsRequest } from './apis/requests/GetTransactionsRequest';
import { HeightRequest } from './apis/requests/HeightRequest';
import { PeersListRequest } from './apis/requests/PeersListRequest';
import { PingRequest } from './apis/requests/PingRequest';
import { PostBlocksRequest } from './apis/requests/PostBlocksRequest';
import { PostSignaturesRequest } from './apis/requests/PostSignaturesRequest';
import { PostTransactionsRequest } from './apis/requests/PostTransactionsRequest';
import { requestSymbols } from './apis/requests/requestSymbols';
import { AttachPeerHeaders } from './apis/utils/attachPeerHeaders';
import { ForgingApisWatchGuard } from './apis/utils/forgingApisWatchGuard';
import { SuccessInterceptor } from './apis/utils/successInterceptor';
import { V2APIErrorHandler } from './apis/utils/v2ErrorHandler';
import { ValidatePeerHeaders } from './apis/utils/validatePeerHeaders';
import {
  applyExpressLimits,
  Bus,
  cache,
  catchToLoggerAndRemapError,
  cbToPromise,
  constants as constantsType,
  DBHelper,
  Ed,
  ExceptionsManager,
  ILogger,
  JobsQueue,
  middleware,
  Migrator,
  ProtoBufHelper,
  Sequence,
  Slots,
  z_schema,
} from './helpers/';
import { IBlockLogic, IPeerLogic, ITransactionLogic } from './ioc/interfaces/logic';
import { IBlocksModuleChain } from './ioc/interfaces/modules';
import { Symbols } from './ioc/symbols';
import {
  AccountLogic,
  AppState,
  BasePeerType,
  BlockLogic,
  BlockRewardLogic,
  BroadcasterLogic,
  PeerLogic,
  PeersLogic,
  RoundLogic,
  RoundsLogic,
  SignedAndChainedBlockType,
  TransactionLogic,
  TransactionPool
} from './logic/';
import {
  BaseTransactionType,
  MultiSignatureTransaction,
  RegisterDelegateTransaction,
  SecondSignatureTransaction,
  SendTransaction,
  VoteTransaction
} from './logic/transactions';
import {
  Accounts2DelegatesModel,
  Accounts2MultisignaturesModel,
  Accounts2U_DelegatesModel,
  Accounts2U_MultisignaturesModel,
  AccountsModel,
  BlocksModel,
  DelegatesModel, ExceptionModel,
  ForksStatsModel, InfoModel, MigrationsModel,
  MultiSignaturesModel,
  PeersModel,
  RoundsFeesModel,
  RoundsModel,
  SignaturesModel,
  TransactionsModel,
  VotesModel
} from './models';
import {
  AccountsModule,
  BlocksModule,
  Cache,
  DelegatesModule,
  DummyCache,
  ForgeModule,
  LoaderModule,
  MultisignaturesModule,
  PeersModule,
  RoundsModule,
  SystemModule,
  TransactionsModule,
  TransportModule
} from './modules/';
import { BlocksModuleChain, BlocksModuleProcess, BlocksModuleUtils, BlocksModuleVerify } from './modules/blocks/';
import { ForkModule } from './modules/fork';
import { AppConfig } from './types/genericTypes';

// import {makeLoggerMiddleware} from 'inversify-logger-middleware';
// const theLogger = makeLoggerMiddleware();

export class AppManager {
  public container: Container = new Container();
  public expressApp: express.Express;

  private schema: z_schema = new z_schema({});
  private isCleaning       = false;
  private server: http.Server;

  constructor(private appConfig: AppConfig,
              private logger: ILogger,
              private versionBuild: string,
              private genesisBlock: SignedAndChainedBlockType,
              private constants: typeof constantsType,
              private excCreators: Array<(ex: ExceptionsManager) => Promise<void>>) {
    this.appConfig.nethash = genesisBlock.payloadHash.toString('hex');
    // this.container.applyMiddleware(theLogger);
    // Sets the int8 (64bit integer) to be parsed as int instead of being returned as text
    pg.types.setTypeParser(20, 'text', parseInt);
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

    this.server.close();

  }

  /**
   * Initialize http endpoints.
   */
  public async initExpress() {
    const app = this.container.get<express.Application>(Symbols.generic.expressApp);
    applyExpressLimits(app, this.appConfig);

    app.use(compression({ level: 9 }));
    app.use(cors());
    app.options('*', cors());

    app.use(bodyParser.raw({ limit: '2mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '2mb', parameterLimit: 5000 }));
    app.use(bodyParser.json({ limit: '2mb' }));

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

    // app.use(middleware.protoBuf());

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
        middlewares        : [V2APIErrorHandler, APIErrorHandler],
      }
    );

  }

  /**
   * Initialize all app dependencies into the IoC container.
   */
  public async initAppElements() {
    this.expressApp = express();

    this.server = http.createServer(this.expressApp);
    const io    = socketIO(this.server);

    const namespace = cls.createNamespace('sequelize-namespace');

    (Sequelize as any).__proto__.useCLS(namespace);

    const sequelize = new Sequelize({
      // logging(msg) {
      //   (require('fs')).appendFileSync(`${__dirname}/../sequelize.log`, msg+"\n");
      // },
      database: this.appConfig.db.database,
      dialect : 'postgres',
      host    : this.appConfig.db.host,
      logging : false,
      password: this.appConfig.db.password,
      pool    : {
        idle: this.appConfig.db.poolIdleTimeout,
        max : this.appConfig.db.poolSize,
      },
      port    : this.appConfig.db.port,
      username: this.appConfig.db.user,
    });
    const theCache  = await cache.connect(
      this.appConfig.cacheEnabled,
      this.appConfig.redis,
      this.logger
    );
    const ed        = new Ed();
    const bus       = new Bus();

    // HTTP APIs
    for (const controller of allControllers) {
      const symbol = Reflect.getMetadata(
        Symbols.__others.metadata.classSymbol,
        controller
      );
      this.container.bind(symbol).to(controller).inSingletonScope();
    }
    this.container.bind(Symbols.api.utils.errorHandler).to(APIErrorHandler).inSingletonScope();
    this.container.bind(Symbols.api.utils.v2ErrorHandler).to(V2APIErrorHandler).inSingletonScope();
    this.container.bind(Symbols.api.utils.successInterceptor).to(SuccessInterceptor).inSingletonScope();
    this.container.bind(Symbols.api.utils.forgingApisWatchGuard).to(ForgingApisWatchGuard).inSingletonScope();
    this.container.bind(Symbols.api.utils.validatePeerHeadersMiddleware).to(ValidatePeerHeaders).inSingletonScope();
    this.container.bind(Symbols.api.utils.attachPeerHeaderToResponseObject).to(AttachPeerHeaders).inSingletonScope();

    // Generics
    this.genericsElements(theCache, sequelize, namespace, io);

    // Helpers
    this.helperElements(bus, ed);

    // Logic
    this.logicElements();

    // Modules
    this.modulesElements();

    // Add models
    this.modelsElements(sequelize);

    // Add all API request elements
    this.requestElements();

    // Start migrations/runtime queries.
    await this.container.get<Migrator>(Symbols.helpers.migrator).init();
    // Add exceptions by attaching exception handlers to the manager.
    const exceptionsManager = this.container.get<ExceptionsManager>(Symbols.helpers.exceptionsManager);
    await Promise.all(this.excCreators.map((exc) => exc(exceptionsManager)));
  }

  public async finishBoot() {
    const infoModel = this.container.get<typeof InfoModel>(Symbols.models.info);
    // Create or restore nonce!
    const [val] = await infoModel
      .findOrCreate({where: {key: 'nonce'}, defaults: {value: uuid.v4()}});
    this.container.bind(Symbols.generic.nonce).toConstantValue(val.value);
    const bus       = this.container.get<Bus>(Symbols.helpers.bus);
    bus.modules     = this.getModules();

    // Register transaction types.
    const txLogic = this.container.get<ITransactionLogic>(Symbols.logic.transaction);
    const txs     = this.getElementsFromContainer<BaseTransactionType<any, any>>(Symbols.logic.transactions);
    txs.forEach((tx) => txLogic.attachAssetType(tx));

    await infoModel
      .upsert({key: 'genesisAccount', value: this.genesisBlock.transactions[0].senderId});

    // Move the genesis from string signatures to buffer signatures
    this.genesisBlock.previousBlock = '1'; // exception for genesisblock
    this.container.get<IBlockLogic>(Symbols.logic.block).objectNormalize(this.genesisBlock);
    this.genesisBlock.previousBlock = null;

    const blocksChainModule = this.container.get<IBlocksModuleChain>(Symbols.modules.blocksSubModules.chain);
    await blocksChainModule.saveGenesisBlock();

    // Listen HTTP
    if (!this.appConfig.loading.snapshot) {
      await cbToPromise((cb) => this.server.listen(this.appConfig.port, this.appConfig.address, cb));
    }
    this.logger.info(`Server started: ${this.appConfig.address}:${this.appConfig.port}`);

    this.logger.info('Modules ready and launched. Loading Blockchain...');
    const loaderModule = this.container.get<LoaderModule>(Symbols.modules.loader);
    await loaderModule.loadBlockChain()
      .catch(catchToLoggerAndRemapError('Cannot load blockchain', this.logger));
    this.logger.info('App Booted');
    // const aM = this.container.get<IAccountsModule>(Symbols.modules.accounts);
    // const bit = await aM.getAccount({address: '15326312953541715317R'});
    // console.log(bit);
  }

  private modelsElements(sequelize) {
    this.container.bind(Symbols.models.accounts).toConstructor(AccountsModel);
    this.container.bind(Symbols.models.accounts2Delegates).toConstructor(Accounts2DelegatesModel);
    this.container.bind(Symbols.models.accounts2Multisignatures).toConstructor(Accounts2MultisignaturesModel);
    this.container.bind(Symbols.models.accounts2U_Delegates).toConstructor(Accounts2U_DelegatesModel);
    this.container.bind(Symbols.models.accounts2U_Multisignatures).toConstructor(Accounts2U_MultisignaturesModel);
    this.container.bind(Symbols.models.blocks).toConstructor(BlocksModel);
    this.container.bind(Symbols.models.delegates).toConstructor(DelegatesModel);
    this.container.bind(Symbols.models.exceptions).toConstructor(ExceptionModel);
    this.container.bind(Symbols.models.forkStats).toConstructor(ForksStatsModel);
    this.container.bind(Symbols.models.info).toConstructor(InfoModel);
    this.container.bind(Symbols.models.migrations).toConstructor(MigrationsModel);
    this.container.bind(Symbols.models.multisignatures).toConstructor(MultiSignaturesModel);
    this.container.bind(Symbols.models.peers).toConstructor(PeersModel);
    this.container.bind(Symbols.models.roundsFees).toConstructor(RoundsFeesModel);
    this.container.bind(Symbols.models.rounds).toConstructor(RoundsModel);
    this.container.bind(Symbols.models.signatures).toConstructor(SignaturesModel);
    this.container.bind(Symbols.models.transactions).toConstructor(TransactionsModel);
    this.container.bind(Symbols.models.votes).toConstructor(VotesModel);
    // Register models
    sequelize.addModels(this.getElementsFromContainer<typeof Model>(Symbols.models));
  }

  private modulesElements() {
    this.container.bind(Symbols.modules.accounts).to(AccountsModule).inSingletonScope();
    this.container.bind(Symbols.modules.blocks).to(BlocksModule).inSingletonScope();
    this.container.bind(Symbols.modules.blocksSubModules.chain).to(BlocksModuleChain).inSingletonScope();
    this.container.bind(Symbols.modules.blocksSubModules.process).to(BlocksModuleProcess).inSingletonScope();
    this.container.bind(Symbols.modules.blocksSubModules.utils).to(BlocksModuleUtils).inSingletonScope();
    this.container.bind(Symbols.modules.blocksSubModules.verify).to(BlocksModuleVerify).inSingletonScope();
    if (this.appConfig.cacheEnabled) {
      this.container.bind(Symbols.modules.cache).to(Cache).inSingletonScope();
    } else {
      this.container.bind(Symbols.modules.cache).to(DummyCache).inSingletonScope();
    }
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
  }

  private logicElements() {
    this.container.bind(Symbols.logic.account).to(AccountLogic).inSingletonScope();
    this.container.bind(Symbols.logic.appState).to(AppState).inSingletonScope();
    this.container.bind(Symbols.logic.block).to(BlockLogic).inSingletonScope();
    this.container.bind(Symbols.logic.blockReward).to(BlockRewardLogic).inSingletonScope();
    this.container.bind(Symbols.logic.broadcaster).to(BroadcasterLogic).inSingletonScope();
    this.container.bind(Symbols.logic.peer).to(PeerLogic);
    this.container.bind(Symbols.logic.peerFactory).toFactory((ctx) => {
      return (peer: BasePeerType) => {
        const p = ctx.container.get<IPeerLogic>(Symbols.logic.peer);
        p.accept({ ... {}, ...peer });
        return p;
      };
    });
    this.container.bind(Symbols.logic.peers).to(PeersLogic).inSingletonScope();
    this.container.bind(Symbols.logic.round).toConstructor(RoundLogic);
    this.container.bind(Symbols.logic.rounds).to(RoundsLogic).inSingletonScope();
    this.container.bind(Symbols.logic.transaction).to(TransactionLogic).inSingletonScope();
    this.container.bind(Symbols.logic.transactionPool).to(TransactionPool).inSingletonScope();
    this.container.bind(Symbols.logic.transactions.send).to(SendTransaction).inSingletonScope();
    this.container.bind(Symbols.logic.transactions.vote).to(VoteTransaction).inSingletonScope();
    this.container.bind(Symbols.logic.transactions.createmultisig).to(MultiSignatureTransaction).inSingletonScope();
    this.container.bind(Symbols.logic.transactions.delegate).to(RegisterDelegateTransaction).inSingletonScope();
    this.container.bind(Symbols.logic.transactions.secondSignature).to(SecondSignatureTransaction).inSingletonScope();
  }

  private helperElements(bus, ed) {
    this.container.bind(Symbols.helpers.bus).toConstantValue(bus);
    this.container.bind(Symbols.helpers.constants).toConstantValue(this.constants);
    this.container.bind(Symbols.helpers.db).to(DBHelper).inSingletonScope();
    this.container.bind(Symbols.helpers.ed).toConstantValue(ed);
    this.container.bind(Symbols.helpers.exceptionsManager).to(ExceptionsManager).inSingletonScope();
    this.container.bind(Symbols.helpers.jobsQueue).to(JobsQueue).inSingletonScope();
    this.container.bind(Symbols.helpers.logger).toConstantValue(this.logger);
    this.container.bind(Symbols.helpers.migrator).to(Migrator).inSingletonScope();
    // this.container.bind(Symbols.helpers.sequence).toConstantValue();
    const self = this;
    [Symbols.tags.helpers.dbSequence, Symbols.tags.helpers.defaultSequence, Symbols.tags.helpers.balancesSequence]
      .forEach((sequenceTag) => {
        this.container.bind(Symbols.helpers.sequence)
          .toConstantValue(new Sequence(sequenceTag, {
            onWarning(current) {
              self.logger.warn(`${sequenceTag.toString()} queue`, current);
            },
          }))
          .whenTargetTagged(Symbols.helpers.sequence, sequenceTag);
      });
    this.container.bind(Symbols.helpers.slots).to(Slots).inSingletonScope();
    this.container.bind(Symbols.helpers.protoBuf).to(ProtoBufHelper).inSingletonScope();
  }

  private requestElements() {
    const factory = (what: (new () => any)) => (ctx) => (options) => {
      const toRet = ctx.container.resolve(what);
      toRet.options = options;
      return toRet;
    };
    this.container.bind(requestSymbols.commonBlock).toFactory(factory(CommonBlockRequest));
    this.container.bind(requestSymbols.getBlocks).toFactory(factory(GetBlocksRequest));
    this.container.bind(requestSymbols.getSignatures).toFactory(factory(GetSignaturesRequest));
    this.container.bind(requestSymbols.getTransactions).toFactory(factory(GetTransactionsRequest));
    this.container.bind(requestSymbols.height).toFactory(factory(HeightRequest));
    this.container.bind(requestSymbols.peersList).toFactory(factory(PeersListRequest));
    this.container.bind(requestSymbols.ping).toFactory(factory(PingRequest));
    this.container.bind(requestSymbols.postBlocks).toFactory(factory(PostBlocksRequest));
    this.container.bind(requestSymbols.postSignatures).toFactory(factory(PostSignaturesRequest));
    this.container.bind(requestSymbols.postTransactions).toFactory(factory(PostTransactionsRequest));
  }

  private genericsElements(theCache, sequelize, namespace, io) {
    this.container.bind(Symbols.generic.appConfig).toConstantValue(this.appConfig);
    this.container.bind(Symbols.generic.expressApp).toConstantValue(this.expressApp);
    this.container.bind(Symbols.generic.genesisBlock).toConstantValue(this.genesisBlock);
    // Nonce is restore in finishBoot.
    // this.container.bind(Symbols.generic.nonce).toConstantValue(this.nonce);
    this.container.bind(Symbols.generic.redisClient).toConstantValue(theCache.client);
    this.container.bind(Symbols.generic.sequelize).toConstantValue(sequelize);
    this.container.bind(Symbols.generic.sequelizeNamespace).toConstantValue(namespace);
    this.container.bind(Symbols.generic.socketIO).toConstantValue(io);
    this.container.bind(Symbols.generic.versionBuild).toConstantValue(this.versionBuild);
    this.container.bind(Symbols.generic.zschema).toConstantValue(this.schema);
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
