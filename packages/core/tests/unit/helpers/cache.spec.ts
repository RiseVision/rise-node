import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import * as redis from 'redis';
import { SinonSpy } from 'sinon';
import * as sinon from 'sinon';
import { ILogger } from '../../../src/helpers';

// tslint:disable no-unused-expression
describe('helpers/cache.connect', () => {
  let logFn: SinonSpy;
  let createClientSpy: SinonSpy;
  let onReadySpy: SinonSpy;
  let onErrorSpy: SinonSpy;
  let doError = false;
  let mockLogger: ILogger;
  let mockCreateClient;
  const proxyRedis = {} as any;
  const cache = proxyquire('../../../src/helpers/cache', {
    redis: proxyRedis,
  });

  const config = { password: null };
  const mockOn = (event: string, cb: (err?: string) => void) => {
    if (!doError && event === 'ready') {
      onReadySpy();
      cb();
    } else if (doError && event === 'error') {
      onErrorSpy();
      cb('testError');
    }
  };
  const oldImplementation = redis.createClient;

  beforeEach(() => {
    logFn = sinon.spy();
    createClientSpy = sinon.spy();
    onReadySpy = sinon.spy();
    onErrorSpy = sinon.spy();
    mockLogger = {
      debug   : logFn,
      error   : logFn,
      fatal   : logFn,
      info    : logFn,
      log     : logFn,
      none    : logFn,
      setLevel: () => {
        return;
      },
      trace   : logFn,
      warn    : logFn,
    };

    mockCreateClient = (cfg) => {
      createClientSpy(cfg);
      return {
        on: mockOn,
      };
    };

    proxyRedis.createClient  = mockCreateClient;
  });

  afterEach(() => {
    proxyRedis.createClient = oldImplementation;
  });

  it('should return a promise', () => {
    const res = cache.connect(true, config, mockLogger);
    expect(res).to.be.instanceOf(Promise);
  });

  it('should resolve with client as null if cache not enabled', async () => {
    const res = await cache.connect(false, config, mockLogger);
    expect(res.client).to.be.eq(null);
  });

  it('should call redis.createClient when cacheEnabled is true', async () => {
    await cache.connect(true, config, mockLogger);
    expect(createClientSpy.called).to.be.true;
  });

  it('should not call redis.createClient when cacheEnabled is false', async () => {
    await cache.connect(false, config, mockLogger);
    expect(createClientSpy.called).to.be.false;
  });

  it('should not pass password to createClient if passed config.password is null', async () => {
    await cache.connect(true, config, mockLogger);
    expect(createClientSpy.args[0][0]).to.be.deep.eq({});
  });

  it('on client error, it should log error and resolve with client as null', async () => {
    doError = true;
    const res = await cache.connect(true, config, mockLogger);
    expect(onReadySpy.called).to.be.false;
    expect(onErrorSpy.called).to.be.true;
    expect(logFn.called).to.be.true;
    expect(logFn.args[0][1]).to.be.eq('testError');
    expect(res.client).to.be.eq(null);
  });

  it('on client ready, it should log success and resolve with the client object', async () => {
    doError = false;
    const res = await cache.connect(true, config, mockLogger);
    expect(onReadySpy.called).to.be.true;
    expect(onErrorSpy.called).to.be.false;
    expect(logFn.called).to.be.true;
    expect(logFn.args[0][0]).to.match(/connected/);
    expect(res.client).to.be.deep.eq({on: mockOn});
  });
});
