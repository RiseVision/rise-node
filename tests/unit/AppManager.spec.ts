import * as chai from 'chai';
import * as fs from 'fs';
import { Container } from 'inversify';
import * as path from 'path';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { allControllers } from '../../src/apis';
import { AppManager } from '../../src/AppManager';
import { ExceptionsManager } from '../../src/helpers';
import constants from '../../src/helpers/constants';
import { Symbols } from '../../src/ioc/symbols';
import { SignedAndChainedBlockType } from '../../src/logic';
import { DummyCache } from '../../src/modules';
import { AppConfig } from '../../src/types/genericTypes';
import { LoggerStub } from '../stubs';
import { ContainerStub } from '../stubs/utils/ContainerStub';
import { createContainer } from '../utils/containerCreator';

const { expect }        = chai;
const RewiredAppManager = rewire('../../src/AppManager');

// tslint:disable no-unused-expression
describe('AppManager', () => {
  let sandbox: SinonSandbox;
  let instance: AppManager;
  let loggerStub: LoggerStub;
  let appConfig: AppConfig;
  let genesisBlock: SignedAndChainedBlockType;
  let allExceptionCreator: Array<(exc: ExceptionsManager) => void>;
  let allStubsContainer: Container;
  let containerStub: ContainerStub;
  let serverStub;

  before(() => {
    loggerStub        = new LoggerStub();
    allStubsContainer = createContainer();
    allStubsContainer.bind(Symbols.modules.cache).toConstantValue({});
    allStubsContainer.bind(Symbols.modules.loader).toConstantValue({});
    allStubsContainer.bind(Symbols.modules.peers).toConstantValue({});
    appConfig    = JSON.parse(fs.readFileSync(path.resolve('etc/mainnet/config.json'), 'utf8'));
    genesisBlock = JSON.parse(fs.readFileSync(path.resolve('etc/mainnet/genesisBlock.json'), 'utf8'));
  });

  beforeEach(() => {
    sandbox    = sinon.sandbox.create();
    serverStub = {
      listen: sandbox.stub(),
      close : sandbox.stub(),
    };
  });

  afterEach(() => {
    sandbox.restore();
    loggerStub.stubReset();
  });

  describe('constructor', () => {
    it('should set appConfig.nethash to genesisBlock.payloadHash', () => {
      instance = new RewiredAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);
      expect(appConfig.nethash).to.be.deep.equal(genesisBlock.payloadHash);
    });
  });

  describe('boot', () => {
    let initAppElementsStub: SinonStub;
    let initExpressStub: SinonStub;
    let finishBootStub: SinonStub;

    beforeEach(() => {
      instance            = new RewiredAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);
      initAppElementsStub = sandbox.stub(instance, 'initAppElements').resolves();
      initExpressStub     = sandbox.stub(instance, 'initExpress').resolves();
      finishBootStub      = sandbox.stub(instance, 'finishBoot');
    });

    it('should call logger.info', async () => {
      await instance.boot();
      expect(loggerStub.stubs.info.calledOnce).to.be.true;
      expect(loggerStub.stubs.info.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal('Booting');
    });

    it('should call initAppElements', async () => {
      await instance.boot();
      expect(initAppElementsStub.calledOnce).to.be.true;
      expect(initAppElementsStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call initExpress', async () => {
      await instance.boot();
      expect(initExpressStub.calledOnce).to.be.true;
      expect(initExpressStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call finishBoot', async () => {
      await instance.boot();
      expect(finishBootStub.calledOnce).to.be.true;
      expect(finishBootStub.firstCall.args.length).to.be.equal(0);
    });
  });

  describe('tearDown', () => {
    let getModulesStub: SinonStub;
    let fakeModules;

    beforeEach(() => {
      instance = new RewiredAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);

      instance.container           = allStubsContainer;
      (instance as any).isCleaning = false;
      fakeModules                  = [{ cleanup: sandbox.stub().resolves() },
        { cleanup: sandbox.stub().resolves() },
        { cleanup: sandbox.stub().resolves() }];
      getModulesStub               = sandbox.stub(instance as any, 'getModules').returns(fakeModules);
      (instance as any).server     = serverStub;
    });

    it('should not call logger.info if this.isCleaning', async () => {
      (instance as any).isCleaning = true;
      await instance.tearDown();
      expect(loggerStub.stubs.info.notCalled).to.be.true;
    });

    it('should call logger.info twice if !this.isCleaning and modules cleanup is ok.', async () => {
      await instance.tearDown();
      expect(loggerStub.stubs.info.calledTwice).to.be.true;
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal('Cleaning up...');
      expect(loggerStub.stubs.info.secondCall.args[0]).to.be.equal('Cleaned up successfully');
    });

    it('should set isCleaning to true', async () => {
      await instance.tearDown();
      expect((instance as any).isCleaning).to.be.true;
    });

    it('should call getModules', async () => {
      await instance.tearDown();
      expect(getModulesStub.calledOnce).to.be.true;
      expect(getModulesStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call cleanup on all modules that have this method', async () => {
      await instance.tearDown();
      fakeModules.forEach((fm) => {
        expect(fm.cleanup.calledOnce).to.be.true;
        expect(fm.cleanup.firstCall.args.length).to.be.equal(0);
      });
    });

    it('should call logger.info only once and then logger.error if Promise.all fails', async () => {
      const err = new Error('test');
      fakeModules[0].cleanup.rejects(err);
      await instance.tearDown();
      expect(loggerStub.stubs.info.calledOnce).to.be.true;
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal('Cleaning up...');
      expect(loggerStub.stubs.error.calledOnce).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.deep.equal(err);
    });

    it('should call server.close', async () => {
      await instance.tearDown();
      expect(serverStub.close.calledOnce).to.be.true;
      expect(serverStub.close.firstCall.args.length).to.be.equal(0);
    });
  });

  describe('initExpress', () => {
    it('should get express from container');
    it('should call applyExpressLimits'); // rewire
    it('should use compression middleware'); // rewire
    it('should use cors middleware'); // rewire
    it('should use cors for all options'); // rewire
    it('should use static middleware for ../public'); // rewire
    it('should use bodyParser.raw'); // rewire
    it('should use bodyParser.urlendoced'); // rewire
    it('should use bodyParser.json'); // rewire
    it('should use methodOverride middleware'); // rewire
    it('should use logClientConnections middleware'); // rewire
    it('should use attachResponseHeader middleware twice'); // rewire
    it('should use attachResponseHeader applyAPIAccessRules'); // rewire
    it('should call useContainerForHTTP'); // rewire
    describe('iocContainer.get', () => {
      it('should call Reflect.getMetadata'); // rewire
      it('should throw if null metadata returned'); // rewire
      it('should call container.get'); // rewire
    });
    it('should call useExpressServer'); // rewire
  });

  describe('initAppElements', () => {
    let expressStub: SinonStub;
    let createServerStub: SinonStub;
    let socketIOStub: SinonStub;
    let databaseConnectStub: SinonStub;
    let cacheConnectStub: SinonStub;
    let sequenceSpy: SinonSpy;
    let edSpy: SinonSpy;
    let busSpy: SinonSpy;
    let getMetadataSpy: SinonSpy;
    let excCreators: any[];
    let toRestore;

    before(() => {
      toRestore = {
        'express': RewiredAppManager.__get__('express'),
        'http.createServer': RewiredAppManager.__get__('http.createServer'),
        'socketIO': RewiredAppManager.__get__('socketIO'),
        '_1.Database.connect': RewiredAppManager.__get__('_1.Database.connect'),
        '_1.cache.connect': RewiredAppManager.__get__('_1.cache.connect'),
        '_1.Sequence': RewiredAppManager.__get__('_1.Sequence'),
        '_1.Ed': RewiredAppManager.__get__('_1.Ed'),
        '_1.Bus': RewiredAppManager.__get__('_1.Bus'),
        'Reflect.getMetadata': RewiredAppManager.__get__('Reflect.getMetadata'),
      };
    });

    beforeEach(() => {
      expressStub         = sandbox.stub().returns('expressApp');
      createServerStub    = sandbox.stub().returns('server');
      socketIOStub        = sandbox.stub().returns('socketIO');
      databaseConnectStub = sandbox.stub().resolves('db');
      cacheConnectStub    = sandbox.stub().resolves({ client: 'theClient' });
      sequenceSpy         = sandbox.spy(toRestore['_1.Sequence']);
      edSpy               = sandbox.spy(toRestore['_1.Ed']);
      busSpy              = sandbox.spy(toRestore['_1.Bus']);
      getMetadataSpy      = sandbox.spy(RewiredAppManager.__get__('Reflect'), 'getMetadata');

      RewiredAppManager.__set__('express', expressStub);
      RewiredAppManager.__set__('http.createServer', createServerStub);
      RewiredAppManager.__set__('socketIO', socketIOStub);
      RewiredAppManager.__set__('_1.Database.connect', databaseConnectStub);
      RewiredAppManager.__set__('_1.cache.connect', cacheConnectStub);
      RewiredAppManager.__set__('_1.Sequence', sequenceSpy);
      RewiredAppManager.__set__('_1.Ed', edSpy);
      RewiredAppManager.__set__('_1.Bus', busSpy);

      containerStub = new ContainerStub(sandbox);
      containerStub.get.callsFake((s) => allStubsContainer.get(s));
      excCreators = [
        sandbox.stub(),
        sandbox.stub(),
        sandbox.stub(),
      ];

      instance = new RewiredAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, excCreators);

      (instance as any).container = containerStub;
    });

    after(() => {
      Object.keys(toRestore).forEach((key) => {
        RewiredAppManager.__set__(key, toRestore[key]);
      });
    });

    it('should call express and set this.expressApp', async () => {
      await instance.initAppElements();
      expect(expressStub.calledOnce).to.be.true;
      expect(expressStub.firstCall.args.length).to.be.equal(0);
      expect(instance.expressApp).to.be.equal('expressApp');
    });

    it('should call http.createServer and set this.server ', async () => {
      await instance.initAppElements();
      expect(createServerStub.calledOnce).to.be.true;
      expect(createServerStub.firstCall.args.length).to.be.equal(1);
      expect(createServerStub.firstCall.args[0]).to.be.equal(instance.expressApp);
      expect((instance as any).server).to.be.equal('server');
    });

    it('should call socketIO ', async () => {
      await instance.initAppElements();
      expect(socketIOStub.calledOnce).to.be.true;
      expect(socketIOStub.firstCall.args.length).to.be.equal(1);
      expect(socketIOStub.firstCall.args[0]).to.be.equal((instance as any).server);
      expect(instance.expressApp).to.be.equal('expressApp');
    });

    it('should call Database.connect', async () => {
      await instance.initAppElements();
      expect(databaseConnectStub.calledOnce).to.be.true;
      expect(databaseConnectStub.firstCall.args.length).to.be.equal(2);
      expect(databaseConnectStub.firstCall.args[0]).to.be.deep.equal(appConfig.db);
      expect(databaseConnectStub.firstCall.args[1]).to.be.deep.equal(loggerStub);
    });

    it('should call cache.connect', async () => {
      await instance.initAppElements();
      expect(cacheConnectStub.calledOnce).to.be.true;
      expect(cacheConnectStub.firstCall.args.length).to.be.equal(3);
      expect(cacheConnectStub.firstCall.args[0]).to.be.deep.equal(appConfig.cacheEnabled);
      expect(cacheConnectStub.firstCall.args[1]).to.be.deep.equal(appConfig.redis);
      expect(cacheConnectStub.firstCall.args[2]).to.be.deep.equal(loggerStub);
    });

    it('should instantiate Ed', async () => {
      await instance.initAppElements();
      expect(edSpy.calledOnce).to.be.true;
      expect(edSpy.firstCall.args.length).to.be.equal(0);
    });

    it('should instantiate Bus', async () => {
      await instance.initAppElements();
      expect(busSpy.calledOnce).to.be.true;
      expect(busSpy.firstCall.args.length).to.be.equal(0);
    });

    it('should call Reflect.getMetadata for each API controller', async () => {
      await instance.initAppElements();
      expect(getMetadataSpy.callCount).to.be.equal(allControllers.length);
      allControllers.forEach((controller, index) => {
        expect(getMetadataSpy.getCall(index).args[0]).to.be.equal(Symbols.__others.metadata.classSymbol);
        expect(getMetadataSpy.getCall(index).args[1]).to.be.deep.equal(controller);
      });
    });

    // Test added to make sure this file is updated every time a new element is bound in container
    it('should call bind exactly 66 times', async () => {
      await instance.initAppElements();
      expect(containerStub.bindCount).to.be.equal(66);
    });

    it('should bind each API controller to its symbol', async () => {
      await instance.initAppElements();
      allControllers.forEach((controller, index) => {
        const symbol = getMetadataSpy.getCall(index).returnValue;
        expect(containerStub.bindings[symbol]).to.be.deep.equal([{
          to              : controller.name,
          inSingletonScope: true,
        }]);
      });
    });

    it('should bind each API util to its symbol', async () => {
      await instance.initAppElements();
      expect(containerStub.bindings[Symbols.api.utils.errorHandler]).to.be.deep.equal([
        {
          to              : 'APIErrorHandler',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.api.utils.successInterceptor]).to.be.deep.equal([
        {
          to              : 'SuccessInterceptor',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.api.utils.validatePeerHeadersMiddleware]).to.be.deep.equal([
        {
          to              : 'ValidatePeerHeaders',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.api.utils.attachPeerHeaderToResponseObject]).to.be.deep.equal([
        {
          to              : 'AttachPeerHeaders',
          inSingletonScope: true,
        },
      ]);
    });

    it('should bind each generic to its symbol', async () => {
      await instance.initAppElements();
      expect(containerStub.bindings[Symbols.generic.appConfig]).to.be.deep.equal([
        {
          toConstantValue: appConfig,
        },
      ]);

      expect(containerStub.bindings[Symbols.generic.db]).to.be.deep.equal([
        {
          toConstantValue: 'db',
        },
      ]);

      expect(containerStub.bindings[Symbols.generic.expressApp]).to.be.deep.equal([
        {
          toConstantValue: instance.expressApp,
        },
      ]);

      expect(containerStub.bindings[Symbols.generic.genesisBlock]).to.be.deep.equal([
        {
          toConstantValue: genesisBlock,
        },
      ]);

      expect(containerStub.bindings[Symbols.generic.nonce]).to.be.deep.equal([
        {
          toConstantValue: (instance as any).nonce,
        },
      ]);

      expect(containerStub.bindings[Symbols.generic.redisClient]).to.be.deep.equal([
        {
          toConstantValue: 'theClient',
        },
      ]);

      expect(containerStub.bindings[Symbols.generic.socketIO]).to.be.deep.equal([
        {
          toConstantValue: 'socketIO',
        },
      ]);

      expect(containerStub.bindings[Symbols.generic.versionBuild]).to.be.deep.equal([
        {
          toConstantValue: '1.0',
        },
      ]);

      expect(containerStub.bindings[Symbols.generic.zschema]).to.be.deep.equal([
        {
          toConstantValue: (instance as any).schema,
        },
      ]);
    });

    it('should bind each helper to its symbol', async () => {
      await instance.initAppElements();
      expect(Array.isArray(containerStub.bindings[Symbols.helpers.bus])).to.be.true;
      expect(containerStub.bindings[Symbols.helpers.bus].length).to.be.equal(1);
      expect(containerStub.bindings[Symbols.helpers.bus][0].toConstantValue).to.not.be.undefined;
      expect(containerStub.bindings[Symbols.helpers.bus][0].toConstantValue.constructor.name).to.be.equal('Bus');

      expect(containerStub.bindings[Symbols.helpers.constants]).to.be.deep.equal([
        {
          toConstantValue: constants,
        },
      ]);

      expect(Array.isArray(containerStub.bindings[Symbols.helpers.ed])).to.be.true;
      expect(containerStub.bindings[Symbols.helpers.ed].length).to.be.equal(1);
      expect(containerStub.bindings[Symbols.helpers.ed][0].toConstantValue).to.not.be.undefined;
      expect(containerStub.bindings[Symbols.helpers.ed][0].toConstantValue.constructor.name).to.be.equal('Ed');

      expect(containerStub.bindings[Symbols.helpers.exceptionsManager]).to.be.deep.equal([
        {
          to              : 'ExceptionsManager',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.helpers.jobsQueue]).to.be.deep.equal([
        {
          to              : 'JobsQueue',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.helpers.logger]).to.be.deep.equal([
        {
          toConstantValue: (instance as any).logger,
        },
      ]);

      expect(containerStub.bindings[Symbols.helpers.slots]).to.be.deep.equal([
        {
          to              : 'Slots',
          inSingletonScope: true,
        },
      ]);
    });

    it('should create 3 Sequences to bind in container for helpers.sequence based on the tag', async () => {
      await instance.initAppElements();
      expect(sequenceSpy.calledThrice).to.be.true;
      expect(Array.isArray(containerStub.bindings[Symbols.helpers.sequence])).to.be.true;
      expect(containerStub.bindings[Symbols.helpers.sequence].length).to.be.equal(3);
      const seqSymbols = [
        Symbols.tags.helpers.dbSequence,
        Symbols.tags.helpers.defaultSequence,
        Symbols.tags.helpers.balancesSequence,
      ];
      seqSymbols.forEach((sequenceTag, index) => {
        expect(containerStub.bindings[Symbols.helpers.sequence][index].toConstantValue).to.not.be.undefined;
        const sequence = containerStub.bindings[Symbols.helpers.sequence][index].toConstantValue;
        expect(sequence.constructor.name).to.be.equal('Sequence');
        expect(sequenceSpy.getCall(index).args[0].onWarning).to.not.be.undefined;
        sequenceSpy.getCall(index).args[0].onWarning(`current_${index}`);
        expect(loggerStub.stubs.warn.callCount).to.be.equal(index + 1);
        expect(loggerStub.stubs.warn.getCall(index).args[0]).to.be.equal(`${sequenceTag.toString()} queue`);
        expect(loggerStub.stubs.warn.getCall(index).args[1]).to.be.equal(`current_${index}`);
        expect(containerStub.bindings[Symbols.helpers.sequence][index].whenTargetTagged).to.not.be.undefined;
        expect(containerStub.bindings[Symbols.helpers.sequence][index].whenTargetTagged).to.be.deep
          .equal([Symbols.helpers.sequence, sequenceTag]);
      });
    });

    it('should bind each logic to its symbol', async () => {
      await instance.initAppElements();

      expect(containerStub.bindings[Symbols.logic.account]).to.be.deep.equal([
        {
          to              : 'AccountLogic',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.appState]).to.be.deep.equal([
        {
          to              : 'AppState',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.block]).to.be.deep.equal([
        {
          to              : 'BlockLogic',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.blockReward]).to.be.deep.equal([
        {
          to              : 'BlockRewardLogic',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.broadcaster]).to.be.deep.equal([
        {
          to              : 'BroadcasterLogic',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.peer]).to.be.deep.equal([
        {
          to: 'PeerLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.peers]).to.be.deep.equal([
        {
          to              : 'PeersLogic',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.round]).to.be.deep.equal([
        {
          toConstructor: 'RoundLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.rounds]).to.be.deep.equal([
        {
          to              : 'RoundsLogic',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transaction]).to.be.deep.equal([
        {
          to              : 'TransactionLogic',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactionPool]).to.be.deep.equal([
        {
          to              : 'TransactionPool',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactions.send]).to.be.deep.equal([
        {
          to              : 'SendTransaction',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactions.vote]).to.be.deep.equal([
        {
          to              : 'VoteTransaction',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactions.createmultisig]).to.be.deep.equal([
        {
          to              : 'MultiSignatureTransaction',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactions.delegate]).to.be.deep.equal([
        {
          to              : 'RegisterDelegateTransaction',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactions.secondSignature]).to.be.deep.equal([
        {
          to              : 'SecondSignatureTransaction',
          inSingletonScope: true,
        },
      ]);

    });

    it('should implements logic.peerFactory and bind it to its symbol', async () => {
      await instance.initAppElements();

      expect(Array.isArray(containerStub.bindings[Symbols.logic.peerFactory])).to.be.true;
      expect(containerStub.bindings[Symbols.logic.peerFactory].length).to.be.equal(1);
      expect(containerStub.bindings[Symbols.logic.peerFactory][0].toFactory).to.not.be.undefined;
      expect(containerStub.bindings[Symbols.logic.peerFactory][0].toFactory).to.be.a('function');
      const toFactory = containerStub.bindings[Symbols.logic.peerFactory][0].toFactory;
      const p         = { accept: sinon.stub() };
      const ctx       = { container: { get: sandbox.stub().returns(p) } };
      const factory   = toFactory(ctx);
      const testPeer  = { test: true };
      const retVal    = factory(testPeer);
      expect(ctx.container.get.calledOnce).to.be.true;
      expect(ctx.container.get.firstCall.args[0]).to.be.equal(Symbols.logic.peer);
      expect(p.accept.calledOnce).to.be.true;
      expect(p.accept.firstCall.args[0]).to.be.deep.equal({ ... {}, ...testPeer });
      expect(retVal).to.be.deep.equal(p);
    });

    it('should bind each module to its symbol', async () => {
      appConfig.cacheEnabled = true;
      await instance.initAppElements();

      expect(containerStub.bindings[Symbols.modules.accounts]).to.be.deep.equal([
        {
          to              : 'AccountsModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.blocks]).to.be.deep.equal([
        {
          to              : 'BlocksModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.blocksSubModules.chain]).to.be.deep.equal([
        {
          to              : 'BlocksModuleChain',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.blocksSubModules.process]).to.be.deep.equal([
        {
          to              : 'BlocksModuleProcess',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.blocksSubModules.utils]).to.be.deep.equal([
        {
          to              : 'BlocksModuleUtils',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.blocksSubModules.verify]).to.be.deep.equal([
        {
          to              : 'BlocksModuleVerify',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.cache]).to.be.deep.equal([
        {
          to              : 'Cache',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.delegates]).to.be.deep.equal([
        {
          to              : 'DelegatesModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.forge]).to.be.deep.equal([
        {
          to              : 'ForgeModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.fork]).to.be.deep.equal([
        {
          to              : 'ForkModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.loader]).to.be.deep.equal([
        {
          to              : 'LoaderModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.multisignatures]).to.be.deep.equal([
        {
          to              : 'MultisignaturesModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.peers]).to.be.deep.equal([
        {
          to              : 'PeersModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.rounds]).to.be.deep.equal([
        {
          to              : 'RoundsModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.system]).to.be.deep.equal([
        {
          to              : 'SystemModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.transactions]).to.be.deep.equal([
        {
          to              : 'TransactionsModule',
          inSingletonScope: true,
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.transport]).to.be.deep.equal([
        {
          to              : 'TransportModule',
          inSingletonScope: true,
        },
      ]);
    });

    it('should bind modules.cache to DummyCache if cache not enabled', async () => {
      appConfig.cacheEnabled = false;
      await instance.initAppElements();

      expect(containerStub.bindings[Symbols.modules.cache]).to.be.deep.equal([
        {
          to              : 'DummyCache',
          inSingletonScope: true,
        },
      ]);
    });

    it('should call all exceptionCreators passing exceptionsManager', async () => {
      await instance.initAppElements();
      const exceptionsManager = containerStub.get(Symbols.helpers.exceptionsManager);;
      excCreators.forEach((creator) => {
        expect(creator.calledOnce).to.be.true;
        expect(creator.firstCall.args.length).to.be.equal(1);
        expect(creator.firstCall.args[0]).to.be.deep.equal(exceptionsManager);
      });
    });
  });

  describe('finishBoot', () => {
    it('should call container.get for helpers.bus');
    it('should call getModules()');
    it('should call container.get for logic.transaction');
    it('should call txLogic.attachAssetType for each returned transaction type');
    it('should call container.get for modules.blocksSubmodules.chain');
    it('should call blocksChainModule.saveGenesisBlock');
    it('should call cbToPromise if not loading snapshot'); // rewire
    it('should NOT call cbToPromise if loading snapshot'); // rewire
    it('should call logger.info three times');
    it('should call container.get for modules.loader');
    it('should call loaderModule.loadBlockChain');
    it('should call catchToLoggerAndRemapError if loadBlockChain throws'); // rewire
  });

  describe('getElementsFromContainer', () => {
    it('should call container.get for all levels of symbols array');
    it('should return the expected elements');
  });

  describe('getModules', () => {
    it('should call getelementsFromContainer');
  });
});
