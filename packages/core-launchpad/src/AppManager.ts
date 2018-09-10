import { ILogger } from '@risevision/core-interfaces';
import { AppConfig, SignedAndChainedBlockType } from '@risevision/core-types';
import { Container } from 'inversify';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import * as pg from 'pg';
import 'reflect-metadata';
import { ICoreModule } from './module';
import { LaunchpadSymbols } from './launchpadSymbols';

export class AppManager {
  public container: Container = new Container();
  public hookSystem: WordPressHookSystem = new WordPressHookSystem(new InMemoryFilterModel());
  private isCleaning       = false;

  constructor(private appConfig: AppConfig,
              private logger: ILogger,
              private versionBuild: string,
              private genesisBlock: SignedAndChainedBlockType,
              private modules: Array<ICoreModule<any>>) {
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

    try {
      await Promise.all(this.modules.map((m) => m.teardown()));
      this.logger.info('Cleaned up successfully');
    } catch (err) {
      this.logger.error(err);
    }
  }

  /**
   * Initialize all app dependencies into the IoC container.
   */
  public async initAppElements() {
    this.modules.forEach((m) => {
      m.config = this.appConfig;
      m.container = this.container;
      m.sortedModules = this.modules;
    });

    this.container.bind(LaunchpadSymbols.coremodules).toConstantValue(this.modules);

    this.modules.forEach((m) => m.addElementsToContainer());

    for (const m of this.modules) {
      await m.initAppElements();
    }

    // hooks
    await this.hookSystem.do_action('core/init/container', this.container);
    //
    // // allow plugins to just modify models
    // const models = this.getElementsFromContainer<typeof IBaseModel>(Symbols.models);
    // await Promise.all(models.map((model) => this.hookSystem.do_action('core/init/model', model)));
    //
    // // Start migrations/runtime queries.
    // await this.container.get<Migrator>(Symbols.helpers.migrator).init();
    // // Add exceptions by attaching exception handlers to the manager.
    // const exceptionsManager = this.container.get<ExceptionsManager>(Symbols.helpers.exceptionsManager);
    // await Promise.all(this.excCreators.map((exc) => exc(exceptionsManager)));
  }

  public async finishBoot() {
    for (const module of this.modules) {
      await module.boot();
    }
    await this.hookSystem.do_action('core/init/onFinishBoot');
    // const infoModel = this.container.get<typeof IInfoModel>(Symbols.models.info);
    // Create or restore nonce!
    // const [val] = await infoModel
    //   .findOrCreate({where: {key: 'nonce'}, defaults: {value: uuid.v4()}});
    // this.container.bind(Symbols.generic.nonce).toConstantValue(val.value);
    // const bus       = this.container.get<Bus>(Symbols.helpers.bus);
    // bus.modules     = this.getModules();

    // Register transaction types.
    // const txLogic = this.container.get<ITransactionLogic>(Symbols.logic.transaction);
    // const txs     = this.getElementsFromContainer<any>(Symbols.logic.transactions);
    // txs.forEach((tx) => txLogic.attachAssetType(tx));

    // await infoModel
    //   .upsert({key: 'genesisAccount', value: this.genesisBlock.transactions[0].senderId});

    // Move the genesis from string signatures to buffer signatures
    // this.genesisBlock.previousBlock = '1'; // exception for genesisblock
    // this.container.get<IBlockLogic>(Symbols.logic.block).objectNormalize(this.genesisBlock);
    // this.genesisBlock.previousBlock = null;

    // const blocksChainModule = this.container.get<IBlocksModuleChain>(Symbols.modules.blocksSubModules.chain);
    // await blocksChainModule.saveGenesisBlock();

    // Listen HTTP
    // if (!this.appConfig.loading.snapshot) {
    //   await cbToPromise((cb) => this.server.listen(this.appConfig.port, this.appConfig.address, cb));
    // }
    // this.logger.info(`Server started: ${this.appConfig.address}:${this.appConfig.port}`);

    // this.logger.info('Modules ready and launched. Loading Blockchain...');
    // const loaderModule = this.container.get<LoaderModule>(Symbols.modules.loader);
    // await loaderModule.loadBlockChain()
    //   .catch(catchToLoggerAndRemapError('Cannot load blockchain', this.logger));
    // this.logger.info('App Booted');
    // const aM = this.container.get<IAccountsModule>(Symbols.modules.accounts);
    // const bit = await aM.getAccount({address: '15326312953541715317R'});
    // console.log(bit);
  }
  //
  // private async modelsElements(sequelize) {
  //
  //   await this.hookSystem.do_action('core/')
  //   // Register models
  //   const models = this.getElementsFromContainer<typeof BaseModel>(Symbols.models);
  //   sequelize.addModels(models);
  //
  //   // add container to models.
  //   models.forEach((model) => model.container = this.container);
  //
  // }
  //
  // private modulesElements() {
  //   this.container.bind(Symbols.modules.accounts).to(AccountsModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.blocks).to(BlocksModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.blocksSubModules.chain).to(BlocksModuleChain).inSingletonScope();
  //   this.container.bind(Symbols.modules.blocksSubModules.process).to(BlocksModuleProcess).inSingletonScope();
  //   this.container.bind(Symbols.modules.blocksSubModules.utils).to(BlocksModuleUtils).inSingletonScope();
  //   this.container.bind(Symbols.modules.blocksSubModules.verify).to(BlocksModuleVerify).inSingletonScope();
  //   if (this.appConfig.cacheEnabled) {
  //     this.container.bind(Symbols.modules.cache).to(Cache).inSingletonScope();
  //   } else {
  //     this.container.bind(Symbols.modules.cache).to(DummyCache).inSingletonScope();
  //   }
  //   this.container.bind(Symbols.modules.delegates).to(DelegatesModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.forge).to(ForgeModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.fork).to(ForkModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.loader).to(LoaderModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.multisignatures).to(MultisignaturesModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.peers).to(PeersModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.rounds).to(RoundsModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.system).to(SystemModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.transactions).to(TransactionsModule).inSingletonScope();
  //   this.container.bind(Symbols.modules.transport).to(TransportModule).inSingletonScope();
  // }
  //
  // private logicElements() {
  //   this.container.bind(Symbols.logic.account).to(AccountLogic).inSingletonScope();
  //   this.container.bind(Symbols.logic.appState).to(AppState).inSingletonScope();
  //   this.container.bind(Symbols.logic.block).to(BlockLogic).inSingletonScope();
  //   this.container.bind(Symbols.logic.blockReward).to(BlockRewardLogic).inSingletonScope();
  //   this.container.bind(Symbols.logic.broadcaster).to(BroadcasterLogic).inSingletonScope();
  //   this.container.bind(Symbols.logic.peer).to(Peer);
  //   this.container.bind(Symbols.logic.peerFactory).toFactory((ctx) => {
  //     return (peer: BasePeerType) => {
  //       const p = ctx.container.get<IPeerLogic>(Symbols.logic.peer);
  //       p.accept({ ... {}, ...peer });
  //       return p;
  //     };
  //   });
  //   this.container.bind(Symbols.logic.peers).to(PeersLogic).inSingletonScope();
  //   this.container.bind(Symbols.logic.round).toConstructor(RoundLogic);
  //   this.container.bind(Symbols.logic.rounds).to(RoundsLogic).inSingletonScope();
  //   this.container.bind(Symbols.logic.transaction).to(TransactionLogic).inSingletonScope();
  //   this.container.bind(Symbols.logic.transactionPool).to(TransactionPool).inSingletonScope();
  //   this.container.bind(Symbols.logic.transactions.send).to(SendTransaction).inSingletonScope();
  //   this.container.bind(Symbols.logic.transactions.vote).to(VoteTransaction).inSingletonScope();
  //   this.container.bind(Symbols.logic.transactions.createmultisig).to(MultiSignatureTransaction).inSingletonScope();
  //   this.container.bind(Symbols.logic.transactions.delegate).to(RegisterDelegateTransaction).inSingletonScope();
  //   this.container.bind(Symbols.logic.transactions.secondSignature).to(SecondSignatureTransaction).inSingletonScope();
  // }
  //
  // private helperElements(bus, ed) {
  //   this.container.bind(Symbols.helpers.bus).toConstantValue(bus);
  //   this.container.bind(Symbols.helpers.constants).toConstantValue(this.constants);
  //   this.container.bind(Symbols.helpers.crypto).toConstantValue(ed);
  //   this.container.bind(Symbols.helpers.exceptionsManager).to(ExceptionsManager).inSingletonScope();
  //   this.container.bind(Symbols.helpers.jobsQueue).to(JobsQueue).inSingletonScope();
  //   this.container.bind(Symbols.helpers.logger).toConstantValue(this.logger);
  //   this.container.bind(Symbols.helpers.migrator).to(Migrator).inSingletonScope();
  //   // this.container.bind(Symbols.helpers.sequence).toConstantValue();
  //   const self = this;
  //   [Symbols.tags.helpers.dbSequence, Symbols.tags.helpers.defaultSequence, Symbols.tags.helpers.balancesSequence]
  //     .forEach((sequenceTag) => {
  //       this.container.bind(Symbols.helpers.sequence)
  //         .toConstantValue(new Sequence(sequenceTag, {
  //           onWarning(current) {
  //             self.logger.warn(`${sequenceTag.toString()} queue`, current);
  //           },
  //         }))
  //         .whenTargetTagged(Symbols.helpers.sequence, sequenceTag);
  //     });
  //   this.container.bind(Symbols.helpers.slots).to(Slots).inSingletonScope();
  // }
  //
  // private genericsElements(sequelize, namespace, io) {
  //   this.container.bind(Symbols.generic.hookSystem).toConstantValue(this.hookSystem);
  //   this.container.bind(Symbols.generic.appConfig).toConstantValue(this.appConfig);
  //   this.container.bind(Symbols.generic.expressApp).toConstantValue(this.expressApp);
  //   this.container.bind(Symbols.generic.genesisBlock).toConstantValue(this.genesisBlock);
  //   // Nonce is restore in finishBoot.
  //   // this.container.bind(Symbols.generic.nonce).toConstantValue(this.nonce);
  //   this.container.bind(Symbols.generic.socketIO).toConstantValue(io);
  //   this.container.bind(Symbols.generic.versionBuild).toConstantValue(this.versionBuild);
  //   this.container.bind(Symbols.generic.zschema).toConstantValue(this.schema);
  // }
  //
  // private getElementsFromContainer<T = any>(symbols: { [k: string]: symbol | { [k: string]: symbol } }): T[] {
  //   this.container.getAllTagged()
  //   return Object
  //     .keys(symbols)
  //     .filter((k) => typeof(symbols[k]) === 'symbol')
  //     .map((k) => this.container.get(symbols[k] as symbol))
  //     .concat(
  //       Object.keys(symbols)
  //         .filter((k) => typeof(symbols[k]) !== 'symbol')
  //         .map<T[]>((k) => this.getElementsFromContainer(symbols[k] as any))
  //         .reduce((a, b) => a.concat(b), [] as any)
  //     ) as any; // FIXME ?
  // }
  //
  // /**
  //  * Returns all the modules
  //  */
  // private getModules(): any[] {
  //   return this.getElementsFromContainer(Symbols.modules);
  // }
}
