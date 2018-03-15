import * as chai from 'chai';
import * as fs from 'fs';
import { Container } from 'inversify';
import * as path from 'path';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { allControllers, APIErrorHandler } from '../../src/apis';
import { AppManager } from '../../src/AppManager';
import { ExceptionsManager } from '../../src/helpers';
import constants from '../../src/helpers/constants';
import { Symbols } from '../../src/ioc/symbols';
import { SignedAndChainedBlockType } from '../../src/logic';
import { DummyCache } from '../../src/modules';
import { AppConfig } from '../../src/types/genericTypes';
import { BlocksSubmoduleChainStub, BusStub, LoggerStub } from '../stubs';
import TransactionLogicStub from '../stubs/logic/TransactionLogicStub';
import { LoaderModuleStub } from '../stubs/modules/LoaderModuleStub';
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
  let allStubsContainer: Container;
  let containerStub: ContainerStub;
  let serverStub;

  before(() => {
    loggerStub        = new LoggerStub();
    allStubsContainer = createContainer();
    allStubsContainer.bind(Symbols.modules.cache).toConstantValue({});
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
    let expressStub: any;
    let fakeApp: { use: SinonStub, options: SinonStub };
    let fakeBodyParser: { raw: SinonStub, urlencoded: SinonStub, json: SinonStub };
    let fakeMiddleware:
          { logClientConnections: SinonStub, attachResponseHeader: SinonStub, applyAPIAccessRules: SinonStub };
    let applyExpressLimitsStub: SinonStub;
    let compressionStub: SinonStub;
    let corsStub: SinonStub;
    let useContainerForHTTPStub: SinonStub;
    let useExpressServerStub: SinonStub;
    let getMetadataSpy: SinonSpy;

    let toRestore;

    before(() => {
      toRestore = {
        'express'                               : RewiredAppManager.__get__('express'),
        '_1.applyExpressLimits'                 : RewiredAppManager.__get__('_1.applyExpressLimits'),
        'compression'                           : RewiredAppManager.__get__('compression'),
        'cors'                                  : RewiredAppManager.__get__('cors'),
        'bodyParser'                            : RewiredAppManager.__get__('bodyParser'),
        '_1.middleware'                         : RewiredAppManager.__get__('_1.middleware'),
        'Reflect.getMetadata'                   : RewiredAppManager.__get__('Reflect.getMetadata'),
        'routing_controllers_1.useContainer'    : RewiredAppManager.__get__('routing_controllers_1.useContainer'),
        'routing_controllers_1.useExpressServer': RewiredAppManager.__get__('routing_controllers_1.useExpressServer'),
      };
    });

    beforeEach(() => {
      fakeApp        = {
        use    : sandbox.stub(),
        options: sandbox.stub(),
      };
      expressStub    = { static: sandbox.stub().returns('static') };
      fakeBodyParser = {
        raw       : sandbox.stub().returns('raw'),
        urlencoded: sandbox.stub().returns('urlencoded'),
        json      : sandbox.stub().returns('json'),
      };
      fakeMiddleware = {
        logClientConnections: sandbox.stub().returns('logClientConnections'),
        attachResponseHeader: sandbox.stub().returns('attachResponseHeader'),
        applyAPIAccessRules : sandbox.stub().returns('applyAPIAccessRules'),
      };

      applyExpressLimitsStub  = sandbox.stub();
      compressionStub         = sandbox.stub().returns('compression');
      corsStub                = sandbox.stub().returns('cors');
      useContainerForHTTPStub = sandbox.stub();
      useExpressServerStub    = sandbox.stub();
      getMetadataSpy          = sandbox.spy(RewiredAppManager.__get__('Reflect'), 'getMetadata');

      RewiredAppManager.__set__('express', expressStub);
      RewiredAppManager.__set__('_1.applyExpressLimits', applyExpressLimitsStub);
      RewiredAppManager.__set__('compression', compressionStub);
      RewiredAppManager.__set__('cors', corsStub);
      RewiredAppManager.__set__('bodyParser', fakeBodyParser);
      RewiredAppManager.__set__('_1.middleware', fakeMiddleware);
      RewiredAppManager.__set__('routing_controllers_1.useContainer', useContainerForHTTPStub);
      RewiredAppManager.__set__('routing_controllers_1.useExpressServer', useExpressServerStub);

      containerStub = new ContainerStub(sandbox);
      containerStub.get.callsFake((s) => (s === Symbols.generic.expressApp) ? fakeApp : s.toString());

      instance = new RewiredAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);

      (instance as any).container = containerStub;
    });

    after(() => {
      Object.keys(toRestore).forEach((key) => {
        RewiredAppManager.__set__(key, toRestore[key]);
      });
    });

    it('should get express from container', async () => {
      await instance.initExpress();
      expect(containerStub.get.calledOnce).to.be.true;
      expect(containerStub.get.firstCall.args.length).to.be.equal(1);
      expect(containerStub.get.firstCall.args[0]).to.be.equal(Symbols.generic.expressApp);
    });

    it('should call applyExpressLimits', async () => {
      await instance.initExpress();
      expect(applyExpressLimitsStub.calledOnce).to.be.true;
      expect(applyExpressLimitsStub.firstCall.args.length).to.be.equal(2);
      expect(applyExpressLimitsStub.firstCall.args[0]).to.be.deep.equal(fakeApp);
      expect(applyExpressLimitsStub.firstCall.args[1]).to.be.deep.equal(appConfig);
    });

    it('should use compression middleware', async () => {
      await instance.initExpress();
      expect(compressionStub.calledOnce).to.be.true;
      expect(compressionStub.firstCall.args.length).to.be.equal(1);
      expect(compressionStub.firstCall.args[0]).to.be.deep.equal({ level: 9 });
      expect(fakeApp.use.getCall(0).args[0]).to.be.equal('compression');
    });

    it('should use cors middleware', async () => {
      await instance.initExpress();
      expect(corsStub.calledTwice).to.be.true;
      expect(corsStub.firstCall.args.length).to.be.equal(0);
      expect(fakeApp.use.getCall(1).args[0]).to.be.equal('cors');
      expect(fakeApp.options.firstCall.args[0]).to.be.equal('*');
      expect(fakeApp.options.firstCall.args[1]).to.be.equal('cors');
    });

    it('should use static middleware for ../public', async () => {
      await instance.initExpress();
      expect(expressStub.static.calledOnce).to.be.true;
      expect(expressStub.static.firstCall.args[0]).to.match(/\.\.\/public$/);
      expect(fakeApp.use.getCall(2).args[0]).to.be.equal('static');
    });

    it('should use bodyParser.raw', async () => {
      await instance.initExpress();
      expect(fakeBodyParser.raw.calledOnce).to.be.true;
      expect(fakeBodyParser.raw.firstCall.args.length).to.be.equal(1);
      expect(fakeBodyParser.raw.firstCall.args[0]).to.be.deep.equal({ limit: '2mb' });
      expect(fakeApp.use.getCall(3).args[0]).to.be.equal('raw');
    });

    it('should use bodyParser.urlencoded', async () => {
      await instance.initExpress();
      expect(fakeBodyParser.urlencoded.calledOnce).to.be.true;
      expect(fakeBodyParser.urlencoded.firstCall.args.length).to.be.equal(1);
      expect(fakeBodyParser.urlencoded.firstCall.args[0]).to.be.deep
        .equal({ extended: true, limit: '2mb', parameterLimit: 5000 });
      expect(fakeApp.use.getCall(4).args[0]).to.be.equal('urlencoded');
    });

    it('should use bodyParser.json', async () => {
      await instance.initExpress();
      expect(fakeBodyParser.json.calledOnce).to.be.true;
      expect(fakeBodyParser.json.firstCall.args.length).to.be.equal(1);
      expect(fakeBodyParser.json.firstCall.args[0]).to.be.deep.equal({ limit: '2mb' });
      expect(fakeApp.use.getCall(5).args[0]).to.be.equal('json');
    });

    it('should use logClientConnections middleware', async () => {
      await instance.initExpress();
      expect(fakeMiddleware.logClientConnections.calledOnce).to.be.true;
      expect(fakeMiddleware.logClientConnections.firstCall.args.length).to.be.equal(1);
      expect(fakeMiddleware.logClientConnections.firstCall.args[0]).to.be.deep.equal(loggerStub);
      expect(fakeApp.use.getCall(6).args[0]).to.be.equal('logClientConnections');
    });

    it('should use attachResponseHeader middleware twice', async () => {
      await instance.initExpress();
      expect(fakeMiddleware.attachResponseHeader.calledTwice).to.be.true;
      expect(fakeMiddleware.attachResponseHeader.firstCall.args.length).to.be.equal(2);
      expect(fakeMiddleware.attachResponseHeader.firstCall.args[0]).to.be.equal('X-Frame-Options');
      expect(fakeMiddleware.attachResponseHeader.firstCall.args[1]).to.be.equal('DENY');
      expect(fakeMiddleware.attachResponseHeader.secondCall.args.length).to.be.equal(2);
      expect(fakeMiddleware.attachResponseHeader.secondCall.args[0]).to.be.equal('Content-Security-Policy');
      expect(fakeMiddleware.attachResponseHeader.secondCall.args[1]).to.be.equal('frame-ancestors \'none\'');
      expect(fakeApp.use.getCall(7).args[0]).to.be.equal('attachResponseHeader');
      expect(fakeApp.use.getCall(8).args[0]).to.be.equal('attachResponseHeader');
    });

    it('should use applyAPIAccessRules middleware', async () => {
      await instance.initExpress();
      expect(fakeMiddleware.applyAPIAccessRules.calledOnce).to.be.true;
      expect(fakeMiddleware.applyAPIAccessRules.firstCall.args.length).to.be.equal(1);
      expect(fakeMiddleware.applyAPIAccessRules.firstCall.args[0]).to.be.deep.equal(appConfig);
      expect(fakeApp.use.getCall(9).args[0]).to.be.equal('applyAPIAccessRules');
    });

    it('should call useContainerForHTTP', async () => {
      await instance.initExpress();
      expect(useContainerForHTTPStub.calledOnce).to.be.true;
      expect(useContainerForHTTPStub.firstCall.args.length).to.be.equal(1);
      expect(useContainerForHTTPStub.firstCall.args[0].get).to.be.a('function');
    });

    describe('iocContainer.get', () => {
      const metadataSymbol = Symbol('testiocContainer.get');
      let fakeGet: (clz: any) => any;
      beforeEach(async () => {
        await instance.initExpress();
        fakeGet = useContainerForHTTPStub.firstCall.args[0].get;
        Reflect.defineMetadata(Symbols.__others.metadata.classSymbol, metadataSymbol, LoggerStub);
      });

      it('should call Reflect.getMetadata', () => {
        fakeGet(LoggerStub);
        expect(getMetadataSpy.calledOnce).to.be.true;
        expect(getMetadataSpy.firstCall.args.length).to.be.equal(2);
        expect(getMetadataSpy.firstCall.args[0]).to.be.equal(Symbols.__others.metadata.classSymbol);
        expect(getMetadataSpy.firstCall.args[1]).to.be.equal(LoggerStub);
      });

      it('should throw if null metadata returned', () => {
        expect(() => {
          fakeGet(String);
        }).to.throw('ERROR instantiating for HTTP undefined');
      });

      it('should call container.get', () => {
        fakeGet(LoggerStub);
        expect(containerStub.get.calledTwice).to.be.true;
        expect(containerStub.get.secondCall.args.length).to.be.equal(1);
        expect(containerStub.get.secondCall.args[0]).to.be.equal(metadataSymbol);
      });
    });
    it('should call useExpressServer', async () => {
      await instance.initExpress();
      expect(useExpressServerStub.calledOnce).to.be.true;
      expect(useExpressServerStub.firstCall.args.length).to.be.equal(2);
      expect(useExpressServerStub.firstCall.args[0]).to.be.deep.equal((instance as any).expressApp);
      expect(useExpressServerStub.firstCall.args[1]).to.be.deep.equal({
        controllers        : allControllers,
        defaultErrorHandler: false,
        middlewares        : [APIErrorHandler],
      });
    });
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
        'express'            : RewiredAppManager.__get__('express'),
        'http.createServer'  : RewiredAppManager.__get__('http.createServer'),
        'socketIO'           : RewiredAppManager.__get__('socketIO'),
        '_1.Database.connect': RewiredAppManager.__get__('_1.Database.connect'),
        '_1.cache.connect'   : RewiredAppManager.__get__('_1.cache.connect'),
        '_1.Sequence'        : RewiredAppManager.__get__('_1.Sequence'),
        '_1.Ed'              : RewiredAppManager.__get__('_1.Ed'),
        '_1.Bus'             : RewiredAppManager.__get__('_1.Bus'),
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
      const exceptionsManager = containerStub.get(Symbols.helpers.exceptionsManager);
      excCreators.forEach((creator) => {
        expect(creator.calledOnce).to.be.true;
        expect(creator.firstCall.args.length).to.be.equal(1);
        expect(creator.firstCall.args[0]).to.be.deep.equal(exceptionsManager);
      });
    });
  });

  describe('finishBoot', () => {
    let cbToPromiseStub: SinonStub;
    let catchToLoggerAndRemapErrorStub: SinonStub;
    let listenStub: SinonStub;
    let getModulesSpy: SinonSpy;
    let busStub: BusStub;
    let transactionLogicStub: TransactionLogicStub;
    let blocksSubmoduleChainStub: BlocksSubmoduleChainStub;
    let loaderModuleStub: LoaderModuleStub;
    let toRestore;

    before(() => {
      toRestore = {
        '_1.cbToPromise'               : RewiredAppManager.__get__('_1.cbToPromise'),
        '_1.catchToLoggerAndRemapError': RewiredAppManager.__get__('_1.catchToLoggerAndRemapError'),
      };
    });

    beforeEach(() => {
      cbToPromiseStub                = sandbox.stub().callsFake((fn) => {
        fn(() => 'cbToPromiseCallbackRetVal');
        return Promise.resolve();
      });
      catchToLoggerAndRemapErrorStub = sandbox.stub().returns('server');
      busStub                        = allStubsContainer.get(Symbols.helpers.bus);
      transactionLogicStub           = allStubsContainer.get(Symbols.logic.transaction);
      blocksSubmoduleChainStub       = allStubsContainer.get(Symbols.modules.blocksSubModules.chain);
      loaderModuleStub               = allStubsContainer.get(Symbols.modules.loader);
      listenStub                     = sandbox.stub();

      RewiredAppManager.__set__('_1.cbToPromise', cbToPromiseStub);
      RewiredAppManager.__set__('_1.catchToLoggerAndRemapError', catchToLoggerAndRemapErrorStub);

      instance      = new RewiredAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);
      getModulesSpy = sandbox.spy(instance as any, 'getModules');

      containerStub = new ContainerStub(sandbox);
      containerStub.get.callsFake((s) => {
        let retVal: any;
        try {
          retVal = allStubsContainer.get(s);
        } catch (e) {
          retVal = { stubNotFound: true, symbol: s };
        }
        return retVal;
      });
      (instance as any).container = containerStub;
      (instance as any).server    = { listen: listenStub };

      transactionLogicStub.stubs.attachAssetType.returns(true);
      blocksSubmoduleChainStub.stubs.saveGenesisBlock.resolves();
      loaderModuleStub.stubs.loadBlockChain.resolves();
    });

    afterEach(() => {
      [busStub, transactionLogicStub, blocksSubmoduleChainStub, loaderModuleStub].forEach((stub: any) => {
        if (typeof stub.reset !== 'undefined') {
          stub.reset();
        }
        if (typeof stub.stubReset !== 'undefined') {
          stub.stubReset();
        }
      });
    });

    after(() => {
      Object.keys(toRestore).forEach((key) => {
        RewiredAppManager.__set__(key, toRestore[key]);
      });
    });

    it('should call container.get for helpers.bus', async () => {
      await instance.finishBoot();
      expect(containerStub.get.called).to.be.true;
      expect(containerStub.get.firstCall.args[0]).to.be.equal(Symbols.helpers.bus);
    });

    it('should call getModules() and set them into bus.modules', async () => {
      await instance.finishBoot();
      expect(getModulesSpy.calledOnce).to.be.true;
      expect(getModulesSpy.firstCall.args.length).to.be.equal(0);
      expect((busStub as any).modules).to.be.deep.equal(getModulesSpy.firstCall.returnValue);
    });

    it('should call container.get for  logic.transaction', async () => {
      await instance.finishBoot();
      const firstArgForAllCalls = containerStub.get.getCalls().map((call) => call.args[0]);
      expect(firstArgForAllCalls.indexOf(Symbols.logic.transaction) !== -1).to.be.true;
    });

    it('should call container.get for all logic.transactions', async () => {
      await instance.finishBoot();
      const firstArgForAllCalls = containerStub.get.getCalls().map((call) => call.args[0]);
      Object.keys(Symbols.logic.transactions).forEach((k) => {
        const s = Symbols.logic.transactions[k];
        expect(firstArgForAllCalls.indexOf(s) !== -1).to.be.true;
      });
    });

    it('should call txLogic.attachAssetType for each returned transaction type', async () => {
      await instance.finishBoot();
      Object.keys(Symbols.logic.transactions).forEach((k, idx) => {
        expect(transactionLogicStub.stubs.attachAssetType.getCall(idx).args[0]).to.be.deep.equal({
          stubNotFound: true,
          symbol      : Symbols.logic.transactions[k],
        });
      });
    });

    it('should call container.get for modules.blocksSubmodules.chain', async () => {
      await instance.finishBoot();
      const firstArgForAllCalls = containerStub.get.getCalls().map((call) => call.args[0]);
      expect(firstArgForAllCalls.indexOf(Symbols.modules.blocksSubModules.chain) !== -1).to.be.true;
    });

    it('should call blocksChainModule.saveGenesisBlock', async () => {
      await instance.finishBoot();
      expect(blocksSubmoduleChainStub.stubs.saveGenesisBlock.calledOnce).to.be.true;
      expect(blocksSubmoduleChainStub.stubs.saveGenesisBlock.firstCall.args.length).to.be.equal(0);
    });

    it('should call cbToPromise if not loading snapshot, which calls server.listen', async () => {
      appConfig.loading.snapshot = undefined;
      await instance.finishBoot();
      expect(cbToPromiseStub.calledOnce).to.be.true;
      expect(cbToPromiseStub.firstCall.args.length).to.be.equal(1);
      expect(cbToPromiseStub.firstCall.args[0]).to.be.a('function');
      expect(listenStub.calledOnce).to.be.true;
      expect(listenStub.firstCall.args[0]).to.be.equal(appConfig.port);
      expect(listenStub.firstCall.args[1]).to.be.equal(appConfig.address);
      expect(listenStub.firstCall.args[2]).to.be.a('function');
      expect(listenStub.firstCall.args[2]()).to.be.equal('cbToPromiseCallbackRetVal');
    });

    it('should NOT call cbToPromise if loading snapshot', async () => {
      appConfig.loading.snapshot = true;
      await instance.finishBoot();
      expect(cbToPromiseStub.notCalled).to.be.true;
    });

    it('should call logger.info three times', async () => {
      appConfig.loading.snapshot = undefined;
      await instance.finishBoot();
      expect(loggerStub.stubs.info.callCount).to.be.equal(3);
      expect(loggerStub.stubs.info.getCall(0).args[0]).to.be
        .equal(`Server started: ${appConfig.address}:${appConfig.port}`);
      expect(loggerStub.stubs.info.getCall(1).args[0]).to.be
        .equal('Modules ready and launched. Loading Blockchain...');
      expect(loggerStub.stubs.info.getCall(2).args[0]).to.be
        .equal('App Booted');
    });

    it('should call container.get for modules.loader', async () => {
      await instance.finishBoot();
      const firstArgForAllCalls = containerStub.get.getCalls().map((call) => call.args[0]);
      expect(firstArgForAllCalls.indexOf(Symbols.modules.loader) !== -1).to.be.true;
    });

    it('should call loaderModule.loadBlockChain', async () => {
      await instance.finishBoot();
      expect(loaderModuleStub.stubs.loadBlockChain.calledOnce).to.be.true;
      expect(loaderModuleStub.stubs.loadBlockChain.firstCall.args.length).to.be.equal(0);
    });

    it('should call catchToLoggerAndRemapError', async () => {
      await instance.finishBoot();
      expect(catchToLoggerAndRemapErrorStub.called).to.be.true;
      expect(catchToLoggerAndRemapErrorStub.firstCall.args.length).to.be.equal(2);
      expect(catchToLoggerAndRemapErrorStub.firstCall.args[0]).to.be.equal('Cannot load blockchain');
      expect(catchToLoggerAndRemapErrorStub.firstCall.args[1]).to.be.deep.equal(loggerStub);
    });
  });

  describe('getElementsFromContainer', () => {
    const symbols = {
      s0  : Symbol('s0'),
      test: {
        s1    : Symbol('s1'),
        child1: {
          s3: Symbol('s3'),
        },
        child2: Symbol('s2'),
      },
    };

    beforeEach(() => {
      instance      = new RewiredAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);
      containerStub = new ContainerStub(sandbox);
      containerStub.get.callsFake((s) => s.toString());
      (instance as any).container = containerStub;
    });

    it('should call container.get for all levels of symbols array', () => {
      (instance as any).getElementsFromContainer(symbols);
      expect(containerStub.get.callCount).to.be.equal(4);
      expect(containerStub.get.getCall(0).args[0]).to.be.equal(symbols.s0);
      expect(containerStub.get.getCall(1).args[0]).to.be.equal(symbols.test.s1);
      expect(containerStub.get.getCall(2).args[0]).to.be.equal(symbols.test.child2);
      expect(containerStub.get.getCall(3).args[0]).to.be.equal(symbols.test.child1.s3);
    });

    it('should return the expected elements', () => {
      const elements = (instance as any).getElementsFromContainer(symbols);
      expect(elements).to.be.deep.equal(['Symbol(s0)', 'Symbol(s1)', 'Symbol(s2)', 'Symbol(s3)']);
    });
  });

  describe('getModules', () => {
    let getElementsFromContainerStub: SinonStub;
    beforeEach(() => {
      instance = new RewiredAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);

      containerStub                = new ContainerStub(sandbox);
      (instance as any).container  = containerStub;
      getElementsFromContainerStub = sandbox.stub(instance as any, 'getElementsFromContainer');
    });

    it('should call getelementsFromContainer', () => {
      (instance as any).getModules();
      expect(getElementsFromContainerStub.calledOnce).to.be.true;
      expect(getElementsFromContainerStub.firstCall.args[0]).to.be.deep.equal(Symbols.modules);
    });
  });
});
