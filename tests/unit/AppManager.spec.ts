import * as chai from 'chai';
import * as fs from 'fs';
import { Container } from 'inversify';
import * as path from 'path';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
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
    let databaseStub: SinonStub;
    let cacheStub: { connect: SinonStub };
    let edStub: SinonStub;
    let busStub: SinonStub;
    let reflectStub: { getMetadata: SinonStub };

    beforeEach(() => {
      instance = new RewiredAppManager.AppManager(appConfig, loggerStub, '1.0', genesisBlock, constants, []);

      containerStub = new ContainerStub(sandbox);
      containerStub.get.callsFake((s) => allStubsContainer.get(s));
      (instance as any).container = containerStub;
    });

    it('should call express'); // rewire
    it('should call socketIO'); // rewire
    it('should call Database.connect'); // rewire
    it('should call cache.connect'); // rewire
    it('should instantiate Ed'); // rewire
    it('should instantiate Bus'); // rewire
    it('should call Reflect.getMetadata for each API controller'); // rewire
    it('should call container.bind for each API controller');
    it('should call container.bind for each API utils');
    it('should call container.bind for each generics');
    it('should call container.bind for each helpers');
    it('should create 3 Sequences to bind in container for helpers.sequence based on the tag');
    it('should call container.bind for each logic');
    it('should call container.bind for each module');
    it('should bind cache to DummyCache if cache not enabled');
    it('should call all exceptionCreators passing exceptionsManager');
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
