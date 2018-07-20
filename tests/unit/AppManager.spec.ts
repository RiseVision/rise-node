import * as chai from 'chai';
import * as fs from 'fs';
import * as http from 'http';
import { Container } from 'inversify';
import * as path from 'path';
import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { allControllers, APIErrorHandler } from '../../src/apis';
import { AppManager } from '../../src/AppManager';
import { Bus, cache, Ed,  ExceptionsManager, JobsQueue, Sequence, Slots, z_schema } from '../../src/helpers';
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

import { Sequelize } from 'sequelize-typescript';
import { BlockLogicStub } from '../stubs/logic/BlockLogicStub';
import { V2APIErrorHandler } from '../../src/apis/utils/v2ErrorHandler';

const { expect } = chai;

const fakeMiddleware = {} as any;
const fakeBodyParser = { raw: undefined, urlencoded: undefined, json: undefined } as any;
let expressStub: SinonStub;
let applyExpressLimitsStub: SinonStub;
let compressionStub: SinonStub;
let corsStub: SinonStub;
let useContainerForHTTPStub: SinonStub;
let useExpressServerStub: SinonStub;
let socketIOStub: SinonStub;
let cbToPromiseStub: SinonStub;
let catchToLoggerAndRemapErrorStub: SinonStub;
const clsObj = {};
const pgObj = {};
const seqTypescriptObj = {
  Model: {},
  Sequelize,
};

function expressRunner(...args) {
  return expressStub.apply(this, args);
}

const ProxyAppManager = proxyquire('../../src/AppManager', {
  'cls-hooked': clsObj,
  'pg': pgObj,
  'sequelize-typescript': seqTypescriptObj,
  './helpers/': {
    Bus,
    Ed,
    ExceptionsManager,
    JobsQueue,
    Sequence,
    Slots,
    applyExpressLimits        : (...args) => applyExpressLimitsStub.apply(this, args),
    cache,
    catchToLoggerAndRemapError: (...args) => catchToLoggerAndRemapErrorStub.apply(this, args),
    cbToPromise               : (...args) => cbToPromiseStub.apply(this, args),
    constants,
    middleware: fakeMiddleware,
    z_schema,
  },
  'body-parser'        : fakeBodyParser,
  'compression'        : (...args) => compressionStub.apply(this, args),
  'cors'               : (...args) => corsStub.apply(this, args),
  'express': expressRunner,
  'reflect-metadata'   : Reflect,
  'routing-controllers': {
    useContainer    : (...args) => useContainerForHTTPStub.apply(this, args),
    useExpressServer: (...args) => useExpressServerStub.apply(this, args),
  },
  'socket.io'          : (...args) => socketIOStub.apply(this, args),
});

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
    allStubsContainer = createContainer();
    loggerStub = allStubsContainer.get(Symbols.helpers.logger);
    allStubsContainer.bind(Symbols.modules.cache).toConstantValue({});
    allStubsContainer.bind(Symbols.modules.peers).toConstantValue({});
    appConfig    = JSON.parse(fs.readFileSync(path.resolve('etc/mainnet/config.json'), 'utf8'));
    genesisBlock = JSON.parse(fs.readFileSync(path.resolve('etc/mainnet/genesisBlock.json'), 'utf8'));
  });

  beforeEach(() => {
    sandbox    = sinon.createSandbox();
    serverStub = {
      close : sandbox.stub(),
      listen: sandbox.stub(),
    };
  });

  afterEach(() => {
    sandbox.restore();
    loggerStub.stubReset();
  });

  describe('constructor', () => {
    it('should set appConfig.nethash to genesisBlock.payloadHash', () => {
      instance = new ProxyAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);
      expect(appConfig.nethash).to.be.deep.equal(genesisBlock.payloadHash);
    });
  });

  describe('boot', () => {
    let initAppElementsStub: SinonStub;
    let initExpressStub: SinonStub;
    let finishBootStub: SinonStub;

    beforeEach(() => {
      instance            = new ProxyAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);
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
      instance = new ProxyAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);

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
    let fakeApp: { use: SinonStub, options: SinonStub };
    let getMetadataSpy: SinonSpy;

    beforeEach(() => {
      fakeApp                       = {
        options: sandbox.stub(),
        use    : sandbox.stub(),
      };
      (expressRunner as any).static = sandbox.stub().returns('static');

      (fakeBodyParser as any).raw        = sandbox.stub().returns('raw');
      (fakeBodyParser as any).urlencoded = sandbox.stub().returns('urlencoded');
      (fakeBodyParser as any).json       = sandbox.stub().returns('json');

      fakeMiddleware.logClientConnections = sandbox.stub().returns('logClientConnections');
      fakeMiddleware.attachResponseHeader = sandbox.stub().returns('attachResponseHeader');
      fakeMiddleware.applyAPIAccessRules  = sandbox.stub().returns('applyAPIAccessRules');
      fakeMiddleware.protoBuf             = sandbox.stub().returns('protoBuf');

      applyExpressLimitsStub  = sandbox.stub();
      compressionStub         = sandbox.stub().returns('compression');
      corsStub                = sandbox.stub().returns('cors');
      useContainerForHTTPStub = sandbox.stub();
      useExpressServerStub    = sandbox.stub();
      getMetadataSpy          = sandbox.spy(Reflect, 'getMetadata');

      containerStub = new ContainerStub(sandbox);
      containerStub.get.callsFake((s) => (s === Symbols.generic.expressApp) ? fakeApp : s.toString());

      instance = new ProxyAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);

      (instance as any).container = containerStub;
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

    it('should use bodyParser.raw', async () => {
      await instance.initExpress();
      expect(fakeBodyParser.raw.calledOnce).to.be.true;
      expect(fakeBodyParser.raw.firstCall.args.length).to.be.equal(1);
      expect(fakeBodyParser.raw.firstCall.args[0]).to.be.deep.equal({ limit: '2mb' });
      expect(fakeApp.use.getCall(2).args[0]).to.be.equal('raw');
    });

    it('should use bodyParser.urlencoded', async () => {
      await instance.initExpress();
      expect(fakeBodyParser.urlencoded.calledOnce).to.be.true;
      expect(fakeBodyParser.urlencoded.firstCall.args.length).to.be.equal(1);
      expect(fakeBodyParser.urlencoded.firstCall.args[0]).to.be.deep
        .equal({ extended: true, limit: '2mb', parameterLimit: 5000 });
      expect(fakeApp.use.getCall(3).args[0]).to.be.equal('urlencoded');
    });

    it('should use bodyParser.json', async () => {
      await instance.initExpress();
      expect(fakeBodyParser.json.calledOnce).to.be.true;
      expect(fakeBodyParser.json.firstCall.args.length).to.be.equal(1);
      expect(fakeBodyParser.json.firstCall.args[0]).to.be.deep.equal({ limit: '2mb' });
      expect(fakeApp.use.getCall(4).args[0]).to.be.equal('json');
    });

    it('should use logClientConnections middleware', async () => {
      await instance.initExpress();
      expect(fakeMiddleware.logClientConnections.calledOnce).to.be.true;
      expect(fakeMiddleware.logClientConnections.firstCall.args.length).to.be.equal(1);
      expect(fakeMiddleware.logClientConnections.firstCall.args[0]).to.be.deep.equal(loggerStub);
      expect(fakeApp.use.getCall(5).args[0]).to.be.equal('logClientConnections');
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
      expect(fakeApp.use.getCall(6).args[0]).to.be.equal('attachResponseHeader');
      expect(fakeApp.use.getCall(7).args[0]).to.be.equal('attachResponseHeader');
    });

    it('should use applyAPIAccessRules middleware', async () => {
      await instance.initExpress();
      expect(fakeMiddleware.applyAPIAccessRules.calledOnce).to.be.true;
      expect(fakeMiddleware.applyAPIAccessRules.firstCall.args.length).to.be.equal(1);
      expect(fakeMiddleware.applyAPIAccessRules.firstCall.args[0]).to.be.deep.equal(appConfig);
      expect(fakeApp.use.getCall(8).args[0]).to.be.equal('applyAPIAccessRules');
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
        middlewares        : [V2APIErrorHandler, APIErrorHandler],
      });
    });
  });

  describe('initAppElements', () => {
    let cacheConnectStub: SinonStub;
    let createServerStub: SinonStub;
    let getMetadataSpy: SinonSpy;
    let sequelizeNamespaceAttachStub: SinonStub;
    let excCreators: any[];

    beforeEach(() => {
      expressStub         = sandbox.stub().returns('expressApp');
      createServerStub    = sandbox.stub(http, 'createServer').returns('server');
      socketIOStub        = sandbox.stub().returns('socketIO');
      cacheConnectStub    = sandbox.stub(cache, 'connect').resolves({ client: 'theClient' });
      getMetadataSpy      = sandbox.spy(Reflect, 'getMetadata');

      sequelizeNamespaceAttachStub = sandbox.stub((seqTypescriptObj.Sequelize as any).__proto__, 'useCLS');
      containerStub = new ContainerStub(sandbox);
      containerStub.get.callsFake((s) => allStubsContainer.get(s));
      excCreators = [
        sandbox.stub(),
        sandbox.stub(),
        sandbox.stub(),
      ];

      instance = new ProxyAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, excCreators);

      (instance as any).container = containerStub;
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

    it('should call cache.connect', async () => {
      await instance.initAppElements();
      expect(cacheConnectStub.calledOnce).to.be.true;
      expect(cacheConnectStub.firstCall.args.length).to.be.equal(3);
      expect(cacheConnectStub.firstCall.args[0]).to.be.deep.equal(appConfig.cacheEnabled);
      expect(cacheConnectStub.firstCall.args[1]).to.be.deep.equal(appConfig.redis);
      expect(cacheConnectStub.firstCall.args[2]).to.be.deep.equal(loggerStub);
    });

    it('should call Reflect.getMetadata for each API controller', async () => {
      await instance.initAppElements();
      // expect(getMetadataSpy.callCount).to.be.equal(allControllers.length);
      allControllers.forEach((controller, index) => {
        expect(getMetadataSpy.getCall(index).args[0]).to.be.equal(Symbols.__others.metadata.classSymbol);
        expect(getMetadataSpy.getCall(index).args[1]).to.be.deep.equal(controller);
      });
    });

    // Test added to make sure this file is updated every time a new element is bound in container
    it('should call bind exactly 100 times', async () => {
      await instance.initAppElements();
      expect(containerStub.bindCount).to.be.equal(100);
    });

    it('should bind each API controller to its symbol', async () => {
      await instance.initAppElements();
      allControllers.forEach((controller, index) => {
        const symbol = getMetadataSpy.getCall(index).returnValue;
        expect(containerStub.bindings[symbol]).to.be.deep.equal([{
          inSingletonScope: true,
          to              : controller.name,
        }]);
      });
    });

    it('should bind each API util to its symbol', async () => {
      await instance.initAppElements();
      expect(containerStub.bindings[Symbols.api.utils.errorHandler]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'APIErrorHandler',
        },
      ]);

      expect(containerStub.bindings[Symbols.api.utils.successInterceptor]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'SuccessInterceptor',
        },
      ]);

      expect(containerStub.bindings[Symbols.api.utils.validatePeerHeadersMiddleware]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'ValidatePeerHeaders',
        },
      ]);

      expect(containerStub.bindings[Symbols.api.utils.attachPeerHeaderToResponseObject]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'AttachPeerHeaders',
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
          inSingletonScope: true,
          to              : 'ExceptionsManager',
        },
      ]);

      expect(containerStub.bindings[Symbols.helpers.jobsQueue]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'JobsQueue',
        },
      ]);

      expect(containerStub.bindings[Symbols.helpers.logger]).to.be.deep.equal([
        {
          toConstantValue: (instance as any).logger,
        },
      ]);

      expect(containerStub.bindings[Symbols.helpers.protoBuf]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'ProtoBufHelper',
        },
      ]);

      expect(containerStub.bindings[Symbols.helpers.slots]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'Slots',
        },
      ]);
    });

    it('should create 3 Sequences to bind in container for helpers.sequence based on the tag', async () => {
      await instance.initAppElements();
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
        expect(containerStub.bindings[Symbols.helpers.sequence][index].whenTargetTagged).to.not.be.undefined;
        expect(containerStub.bindings[Symbols.helpers.sequence][index].whenTargetTagged).to.be.deep
          .equal([Symbols.helpers.sequence, sequenceTag]);
      });
    });

    it('should bind each logic to its symbol', async () => {
      await instance.initAppElements();

      expect(containerStub.bindings[Symbols.logic.account]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'AccountLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.appState]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'AppState',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.block]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'BlockLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.blockReward]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'BlockRewardLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.broadcaster]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'BroadcasterLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.peer]).to.be.deep.equal([
        {
          to: 'PeerLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.peers]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'PeersLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.round]).to.be.deep.equal([
        {
          toConstructor: 'RoundLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.rounds]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'RoundsLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transaction]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'TransactionLogic',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactionPool]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'TransactionPool',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactions.send]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'SendTransaction',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactions.vote]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'VoteTransaction',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactions.createmultisig]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'MultiSignatureTransaction',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactions.delegate]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'RegisterDelegateTransaction',
        },
      ]);

      expect(containerStub.bindings[Symbols.logic.transactions.secondSignature]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'SecondSignatureTransaction',
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
          inSingletonScope: true,
          to              : 'AccountsModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.blocks]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'BlocksModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.blocksSubModules.chain]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'BlocksModuleChain',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.blocksSubModules.process]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'BlocksModuleProcess',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.blocksSubModules.utils]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'BlocksModuleUtils',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.blocksSubModules.verify]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'BlocksModuleVerify',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.cache]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'Cache',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.delegates]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'DelegatesModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.forge]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'ForgeModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.fork]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'ForkModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.loader]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'LoaderModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.multisignatures]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'MultisignaturesModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.peers]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'PeersModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.rounds]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'RoundsModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.system]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'SystemModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.transactions]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'TransactionsModule',
        },
      ]);

      expect(containerStub.bindings[Symbols.modules.transport]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'TransportModule',
        },
      ]);
    });

    it('should bind modules.cache to DummyCache if cache not enabled', async () => {
      appConfig.cacheEnabled = false;
      await instance.initAppElements();

      expect(containerStub.bindings[Symbols.modules.cache]).to.be.deep.equal([
        {
          inSingletonScope: true,
          to              : 'DummyCache',
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
    let listenStub: SinonStub;
    let getModulesSpy: SinonSpy;
    let busStub: BusStub;
    let transactionLogicStub: TransactionLogicStub;
    let blocksSubmoduleChainStub: BlocksSubmoduleChainStub;
    let loaderModuleStub: LoaderModuleStub;
    let infoFindOrCreateStub: SinonStub;
    let infoUpsertStub: SinonStub;
    let blockLogicStub: BlockLogicStub;
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
      blockLogicStub                 = allStubsContainer.get(Symbols.logic.block);
      listenStub                     = sandbox.stub();

      instance      = new ProxyAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);
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
      sandbox.stub(Sequelize.prototype, 'addModels').returns(null);
      infoFindOrCreateStub = sandbox
        .stub(allStubsContainer.get<any>(Symbols.models.info), 'findOrCreate')
        .returns([{value: '1', key: 'nonce'}]);
      infoUpsertStub = sandbox
        .stub(allStubsContainer.get<any>(Symbols.models.info), 'upsert')
        .resolves();
      blockLogicStub.enqueueResponse('objectNormalize', null);
    });

    afterEach(() => {
      [busStub, transactionLogicStub, blocksSubmoduleChainStub, loaderModuleStub, blockLogicStub].forEach((stub: any) => {
        if (typeof stub.reset !== 'undefined') {
          stub.reset();
        }
        if (typeof stub.stubReset !== 'undefined') {
          stub.stubReset();
        }
      });
    });


    it('should call objectNormalize over genesisblock', async () => {
      await instance.finishBoot();
      expect(blockLogicStub.stubs.objectNormalize.called).is.true;
      expect(blockLogicStub.stubs.objectNormalize.firstCall.args[0]).deep.eq(genesisBlock);
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
        expect(transactionLogicStub.stubs.attachAssetType.getCall(idx).args[0].type).to.be.deep.equal(
          allStubsContainer.get<any>(Symbols.logic.transactions[k]).type
        );
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

    it('should query/update info table', async () => {
      await instance.finishBoot();
      expect(infoFindOrCreateStub.calledOnce).is.true;
      expect(infoFindOrCreateStub.firstCall.args[0]).to.haveOwnProperty('where');
      expect(infoFindOrCreateStub.firstCall.args[0].where).to.deep.eq({key: 'nonce'});
      expect(infoFindOrCreateStub.firstCall.args[0]).to.haveOwnProperty('defaults');
      expect(containerStub.bindings[Symbols.generic.nonce][0].toConstantValue).be.eq('1');
      expect(infoUpsertStub.calledOnce).is.true;
      expect(infoUpsertStub.firstCall.args[0]).is.deep.eq({
        key: 'genesisAccount',
        value: '14709573872795067383R'
      });
    });
  });

  describe('getElementsFromContainer', () => {
    const symbols = {
      s0  : Symbol('s0'),
      test: {
        child1: {
          s3: Symbol('s3'),
        },
        child2: Symbol('s1'),
        s1    : Symbol('s2'),
      },
    };

    beforeEach(() => {
      instance      = new ProxyAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);
      containerStub = new ContainerStub(sandbox);
      containerStub.get.callsFake((s) => s.toString());
      (instance as any).container = containerStub;
    });

    it('should call container.get for all levels of symbols array', () => {
      (instance as any).getElementsFromContainer(symbols);
      expect(containerStub.get.callCount).to.be.equal(4);
      expect(containerStub.get.getCall(0).args[0]).to.be.equal(symbols.s0);
      expect(containerStub.get.getCall(1).args[0]).to.be.equal(symbols.test.child2);
      expect(containerStub.get.getCall(2).args[0]).to.be.equal(symbols.test.s1);
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
      instance = new ProxyAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);

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
