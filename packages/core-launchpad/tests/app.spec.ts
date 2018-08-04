import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import { StubbedInstance } from '../../core-test-utils/src/stubCreator';
import { AppManager } from '../src/AppManager';
import { expect } from 'chai';
import { wait } from '../../core-utils/src';
import { SinonStub } from 'sinon';

describe('app', () => {
  let oldPWD: string;
  before(() => {
    oldPWD          = process.env.PWD;
    process.env.PWD = `${__dirname}/assets/app`;
  });
  after(() => {
    process.env.PWD = oldPWD;
  });

  class StubbedAppManager extends StubbedInstance(AppManager) {
    constructor(a, b, c, d, e) {
      super(a, b, c, d, e);
      this.stubs.tearDown.resolves();
    }
  }

  afterEach(() => {
    StubbedAppManager.instances.splice(0, StubbedAppManager.instances.length);
    StubbedAppManager.constructorCalls.splice(0, StubbedAppManager.instances.length);
  });
  it('constructor', () => {
    proxyquire('../src/app', { './AppManager': { AppManager: StubbedAppManager } });
    expect(StubbedAppManager.instances.length).eq(1);
    expect(StubbedAppManager.constructorCalls[0][0]).deep.eq({
      ...require('./assets/app/etc/mainnet/config.json'),
      nethash: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
    });
    expect(StubbedAppManager.constructorCalls[0][2]).deep.eq('0.1.1');
    expect(StubbedAppManager.constructorCalls[0][3]).deep.eq(require('./assets/app/etc/mainnet/genesisBlock.json'));
    expect(StubbedAppManager.constructorCalls[0][4]).deep.eq([]);
  });
  it('should call appManager.boot and exitHook After ', async () => {
    proxyquire('../src/app', {
      './AppManager'   : { AppManager: StubbedAppManager },
      'async-exit-hook': (cb) => cb(),
    });
    const [instance] = StubbedAppManager.instances;
    await wait(100);
    expect(instance.stubs.boot.calledOnce).is.true;
    expect(instance.stubs.tearDown.calledOnce).is.true;
  });

  describe('cli arguments', () => {
    const oldArgs        = [...process.argv];
    const oldProcessExit = process.exit;
    let exitStub: SinonStub;
    beforeEach(() => process.argv = [...oldArgs]);
    beforeEach(() => {
      exitStub     = sinon.stub();
      process.exit = (...args) => {
        exitStub(...args);
        console.log('Exited', ...args);
        return void 0 as never;
      };
    });
    afterEach(() => process.exit = oldProcessExit);

    it('should honorate --net param', () => {
      process.argv.push('--net');
      process.argv.push('haha');

      expect(() => proxyquire('../src/app', {
        './AppManager': { AppManager: StubbedAppManager },
      })).to.throw('haha');
    });

    it('should allow override partial configuration via multiple -o', async () => {
      process.argv.push('-o');
      process.argv.push('$.a=b');
      process.argv.push('-o');
      process.argv.push('$.address=meow');
      process.argv.push('-o');
      process.argv.push('$.db.host=myhost');
      proxyquire('../src/app', {
        './AppManager': { AppManager: StubbedAppManager },
      });

      const [constructorArgs] = StubbedAppManager.constructorCalls;

      expect(constructorArgs[0].a).eq('b');
      expect(constructorArgs[0].address).eq('meow');
      expect(constructorArgs[0].db).deep.eq({
        database          : 'test',
        host              : 'myhost',
        logEvents         : [
          'error',
        ],
        password          : 'password',
        poolIdleTimeout   : 30000,
        poolSize          : 95,
        port              : 5432,
        reapIntervalMillis: 1000,
        user              : 'test',
      });
    });

    it('should allow specifying the port and address', () => {
      process.argv.push('-p', '10');
      process.argv.push('-a', 'localhome');
      proxyquire('../src/app', {
        './AppManager': { AppManager: StubbedAppManager },
      });

      const [[config]] = StubbedAppManager.constructorCalls;
      expect(config.port).deep.eq(10);
      expect(config.address).deep.eq('localhome');

      // invalid port
      process.argv = [...oldArgs];
      process.argv.push('-p', 'hahaa');
      proxyquire('../src/app', {
        './AppManager': { AppManager: StubbedAppManager },
      });

      expect(exitStub.calledOnce).is.true;
      expect(exitStub.firstCall.args[0]).eq(1);
    });

    it('should allow specifying config path', () => {
      process.argv.push('-c', '/dev/null');
      const configStub = sinon.stub();
      proxyquire('../src/app', {
        './AppManager' : { AppManager: StubbedAppManager },
        './loadConfigs': { configCreator: configStub },
      });
      expect(configStub.calledOnce).is.true;
      expect(configStub.firstCall.args[0]).deep.eq('/dev/null');
    });
    it('should require and merge extraConfig', () => {
      process.argv.push('-e', `${__dirname}/assets/app/extraConfig.json`);
      proxyquire('../src/app', {
        './AppManager' : { AppManager: StubbedAppManager },
      });

      const [[config]] = StubbedAppManager.constructorCalls;
      expect(config.extra).eq('config');
      expect(config.address).eq('extra-config-address');
      expect(config.db).deep.eq({
        database          : 'extra-config-db',
        host              : 'myhost',
        logEvents         : [
          'error',
        ],
        password          : 'password',
        poolIdleTimeout   : 30000,
        poolSize          : 95,
        port              : 5432,
        reapIntervalMillis: 1000,
        user              : 'test',
      });
    });
  });
});
