import { wait } from '@risevision/core-utils';
import { expect } from 'chai';
import { Container } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { LoggerStub } from '../../../core-utils/tests/unit/stubs/';
import { AppManager } from '../../src/AppManager';
import { OnFinishBoot, OnInitContainer } from '../../src/hooks';
import { CoreModuleStub } from './stubs/CoreModuleStub';

// tslint:disable no-var-requires no-unused-expression
const genesisBlock = require('./assets/genesisBlock.json');
const config = require('./assets/config.json');
describe('AppManager', () => {
  const sandbox: SinonSandbox = sinon.createSandbox();
  let instance: AppManager;
  let modules: CoreModuleStub[] = [];
  afterEach(() => sandbox.restore());

  beforeEach(() => {
    modules = [
      new CoreModuleStub(),
      new CoreModuleStub(),
      new CoreModuleStub(),
      new CoreModuleStub(),
    ];
    instance = new AppManager(
      { ...config },
      new LoggerStub(),
      null,
      genesisBlock,
      modules
    );
  });

  describe('constructor', () => {
    it('should create container, hookSystem and isCleaning fields', () => {
      const inst = new AppManager({ ...config }, null, null, genesisBlock, []);
      expect(inst).to.haveOwnProperty('container');
      expect(inst).to.haveOwnProperty('hookSystem');
      expect(inst).to.haveOwnProperty('isCleaning');

      expect(inst.container).to.be.an.instanceof(Container);
      expect(inst.hookSystem).to.be.an.instanceof(WordPressHookSystem);
      // @ts-ignore
      expect(inst.isCleaning).false;
    });
    it('should set nethash from genesisBlock', () => {
      const inst = new AppManager(
        { ...config, nethash: 'ciao' },
        null,
        null,
        genesisBlock,
        []
      );
      // @ts-ignore
      expect(inst.appConfig.nethash).deep.eq(
        'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6'
      );
    });
  });

  describe('boot()', () => {
    it('should call initAppElements and then finishBoot', async () => {
      const initAppStub = sandbox
        .stub(instance, 'initAppElements')
        .returns(wait(1000));
      const finishBootStub = sandbox
        .stub(instance, 'finishBoot')
        .returns(wait(1000));
      const now = Date.now();
      await instance.boot();
      expect(Date.now() - now).lt(2000);
      expect(finishBootStub.calledAfter(initAppStub));
    });
  });

  describe('tearDown()', () => {
    it('should cycle through all modules and call tearDown', async () => {
      await instance.tearDown();
      for (const m of modules) {
        expect(m.stubs.teardown.calledOnce).is.true;
      }
    });
    it('should not do anything is it was already teared down', async () => {
      await instance.tearDown();
      await instance.tearDown();

      for (const m of modules) {
        expect(m.stubs.teardown.calledOnce).is.true;
      }
    });
  });

  describe('initAppElements()', () => {
    it('should set config and container on each module', async () => {
      await instance.initAppElements();
      for (const m of modules) {
        expect(m.container).deep.eq(instance.container);
        // @ts-ignore
        expect(m.config).deep.eq(instance.appConfig);
      }
    });
    it('should call addElementsToContainer for each module and then initAppElements', async () => {
      await instance.initAppElements();
      for (const m of modules) {
        expect(m.stubs.addElementsToContainer.calledOnce).true;
        expect(m.stubs.initAppElements.calledOnce).true;
        expect(
          m.stubs.initAppElements.calledAfter(m.stubs.addElementsToContainer)
        ).true;
      }
    });
    it('should launch init/container action', async () => {
      const stub = sinon.stub();
      class X extends WPHooksSubscriber(Object) {
        public hookSystem = instance.hookSystem;
        @OnInitContainer()
        public test(...args: any[]) {
          stub(...args);
          return Promise.resolve();
        }
      }
      const x = new X();
      await x.hookMethods();
      await instance.initAppElements();
      expect(stub.calledOnce).is.true;
      expect(stub.firstCall.args[0]).deep.eq(instance.container);
    });
  });

  describe('finishBoot()', () => {
    it('should call boot for each module', async () => {
      await instance.finishBoot();
      for (const m of modules) {
        expect(m.stubs.boot.calledOnce).is.true;
      }
    });
    it('should fire core/init/onFinishBoot', async () => {
      const stub = sinon.stub();
      // tslint:disable-next-line
      class X extends WPHooksSubscriber(Object) {
        public hookSystem = instance.hookSystem;
        @OnFinishBoot()
        public test(...args: any[]) {
          stub(...args);
          return Promise.resolve();
        }
      }
      const x = new X();
      await x.hookMethods();
      await instance.finishBoot();
      expect(stub.calledOnce).is.true;
    });
  });
});
