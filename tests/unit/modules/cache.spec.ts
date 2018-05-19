import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import * as helpers from '../../../src/helpers';
import { cbToPromise, TransactionType } from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { Cache, DummyCache } from '../../../src/modules';
import { RedisClientStub } from '../../stubs';
import { createContainer } from '../../utils/containerCreator';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/cache', () => {
  let dummyCache: DummyCache;
  let cache: Cache;
  let container: Container;
  let sandbox: SinonSandbox;
  let spyHelper;
  let redisClientStub: RedisClientStub;

  beforeEach(() => {
    sandbox         = sinon.sandbox.create();
    container       = createContainer();
    container.bind(Symbols.generic.redisClient).to(RedisClientStub).inSingletonScope();
    container.bind(Symbols.modules.cache).to(Cache);
    cache           = container.get(Symbols.modules.cache);
    redisClientStub = container.get(Symbols.generic.redisClient);
    cache.onSyncFinished();

    dummyCache = new DummyCache();

    spyHelper = {
      cache       : {
        assertConnected        : sandbox.spy(cache, 'assertConnected'),
        assertConnectedAndReady: sandbox.spy(cache, 'assertConnectedAndReady'),
      },
      callback    : sandbox.spy(),
      promiseUtils: {
        cbToPromise    : sandbox.spy(helpers, 'cbToPromise'),
        cbToVoidPromise: sandbox.spy(helpers, 'cbToVoidPromise'),
        emptyCB        : sandbox.spy(helpers, 'emptyCB'),
      },
    };
  });

  afterEach(() => {
    redisClientStub.stubReset();
    sandbox.restore();
  });

  describe('Cache', () => {
    describe('get .isConnected', () => {

      afterEach(() => {
        (cache as any).redisClient           = redisClientStub;
        (cache as any).redisClient.connected = true;
      });

      it('should return true with established connection', () => {
        expect(cache.isConnected).to.be.true;
      });

      it('should return false without redisClient instance', () => {
        (cache as any).redisClient = false;

        expect(cache.isConnected).to.be.false;
      });

      it('should return false without established connection with redis', () => {
        (cache as any).redisClient.connected = false;

        expect(cache.isConnected).to.be.false;
      });

    });

    describe('.assertConnected', () => {

      afterEach(() => {
        (cache as any).redisClient.connected = true;
      });

      it('should return resolved promise if connection is established', async () => {
        const res = await cache.assertConnected();

        expect(res).to.be.undefined;
      });

      it('should return rejected promise if there is no connection', async () => {
        (cache as any).redisClient.connected = false;

        await expect(cache.assertConnected()).to.rejectedWith('Cache unavailable');
      });

    });

    describe('.assertConnectedAndReady', () => {

      it('should call Cache.assertConnected', async () => {
        await cache.assertConnectedAndReady();

        expect((cache.assertConnected as any).calledOnce).to.be.true;
      });

      it('should return a rejected promise if Cache.cacheReady is false', async () => {
        (cache as any).cacheReady = false;

        await expect(cache.assertConnectedAndReady()).to.rejectedWith('Cache not ready');
      });

    });

    describe('.getObjFromKey', () => {

      let k;
      let keyString;
      let keyObject;
      let parseStub;

      beforeEach(() => {
        k         = 'str';
        keyString = '{"data":10}';
        keyObject = JSON.parse(keyString);

        parseStub = sandbox.spy(JSON, 'parse');
        redisClientStub.stubs.get.callsArgWith(1, null, keyString);
      });

      it('should call Cache.assertConnected', async () => {
        await cache.getObjFromKey(k);

        expect(spyHelper.cache.assertConnected.calledOnce).to.be.true;
        expect(spyHelper.cache.assertConnected.firstCall.args.length).to.be.equal(0);
      });

      it('should call Cache.redisClient.get after resolved promise', async () => {
        await cache.getObjFromKey(k);

        expect(spyHelper.promiseUtils.cbToPromise.calledOnce).to.be.true;
        expect(spyHelper.promiseUtils.cbToPromise.firstCall.args.length).to.be.equal(1);
        expect(spyHelper.promiseUtils.cbToPromise.firstCall.args[0]).to.be.an('function');

        expect(redisClientStub.stubs.get.calledOnce).to.be.true;
        expect(redisClientStub.stubs.get.firstCall.args.length).to.be.equal(2);
        expect(redisClientStub.stubs.get.firstCall.args[0]).to.be.equal(k);
      });

      it('should return a key object', async () => {
        const ret = await cache.getObjFromKey(k);

        expect(parseStub.calledOnce).to.be.true;
        expect(parseStub.firstCall.args.length).to.be.equal(1);
        expect(parseStub.firstCall.args[0]).to.be.equal(keyString);

        expect(ret).to.be.an('object');
        expect(ret).to.be.deep.equal(keyObject);
      });

    });

    describe('.setObjFromKey', () => {

      let k;
      let valueObject;
      let valueString;
      let redisResult;
      let stringifyStub;

      beforeEach(() => {
        k           = 'str';
        valueObject = { data: 100 };
        valueString = JSON.stringify(valueObject);
        redisResult = 'ok';

        stringifyStub = sandbox.spy(JSON, 'stringify');
        redisClientStub.stubs.set.callsArgWith(2, null, redisResult);
      });

      it('should call Cache.assertConnected', async () => {
        await cache.setObjFromKey(k, valueObject);

        expect(spyHelper.cache.assertConnected.calledOnce).to.be.true;
        expect(spyHelper.cache.assertConnected.firstCall.args.length).to.be.equal(0);
      });

      it('should call Cache.redisClient.get after resolved promise', async () => {
        await cache.setObjFromKey(k, valueObject);

        expect(spyHelper.promiseUtils.cbToVoidPromise.calledOnce).to.be.true;
        expect(spyHelper.promiseUtils.cbToVoidPromise.firstCall.args.length).to.be.equal(1);
        expect(spyHelper.promiseUtils.cbToVoidPromise.firstCall.args[0]).to.be.a('function');

        expect(redisClientStub.stubs.set.calledOnce).to.be.true;
        expect(redisClientStub.stubs.set.firstCall.args.length).to.be.equal(3);
        expect(redisClientStub.stubs.set.firstCall.args[0]).to.be.equal(k);
        expect(redisClientStub.stubs.set.firstCall.args[1]).to.be.equal(valueString);

      });

      it('should return a positive result of set key', async () => {
        const ret = await cache.setObjFromKey(k, valueObject);

        expect(stringifyStub.calledOnce).to.be.true;
        expect(stringifyStub.firstCall.args.length).to.be.equal(1);
        expect(stringifyStub.firstCall.args[0]).to.be.equal(valueObject);

        expect(ret).to.be.an('string');
        expect(ret).to.be.equal(redisResult);
      });

    });

    describe('.deleteJsonForKey', () => {
      let k;
      let redisResult;

      beforeEach(() => {
        k           = 'str';
        redisResult = 'ok';

        redisClientStub.stubs.del.callsArgWith(1, null, redisResult);
      });

      it('should call Cache.assertConnected', async () => {
        await cache.deleteJsonForKey(k);

        expect(spyHelper.cache.assertConnected.calledOnce).to.be.true;
        expect(spyHelper.cache.assertConnected.firstCall.args.length).to.be.equal(0);
      });

      it('should call Cache.redisClient.del after resolved promise', async () => {
        await cache.deleteJsonForKey(k);

        expect(spyHelper.promiseUtils.cbToVoidPromise.calledOnce).to.be.true;
        expect(spyHelper.promiseUtils.cbToVoidPromise.firstCall.args.length).to.be.equal(1);
        expect(spyHelper.promiseUtils.cbToVoidPromise.firstCall.args[0]).to.be.a('function');

        expect(redisClientStub.stubs.del.calledOnce).to.be.true;
        expect(redisClientStub.stubs.del.firstCall.args.length).to.be.equal(2);
        expect(redisClientStub.stubs.del.firstCall.args[0]).to.be.equal(k);
      });

      it('should return a positive result of del', async () => {
        const ret = await cache.deleteJsonForKey(k);

        expect(ret).to.be.an('string');
        expect(ret).to.be.equal(redisResult);
      });

    });

    describe('.removeByPattern', () => {

      let pattern;
      let resArrays;
      let keys;
      let cursor;
      let deleteJsonForKeyStub;

      beforeEach(() => {
        pattern   = 'pattern';
        keys      = 'keys';
        cursor    = 0;
        resArrays = [[1, keys], [2, ''], [-1, keys]];

        deleteJsonForKeyStub = sandbox.stub(cache, 'deleteJsonForKey').resolves(1);
        redisClientStub.stubs.scan.onCall(0).callsArgWith(3, null, resArrays[0]);
        redisClientStub.stubs.scan.onCall(1).callsArgWith(3, null, resArrays[1]);
        redisClientStub.stubs.scan.onCall(2).callsArgWith(3, null, resArrays[2]);
      });

      it('should call Cache.assertConnected', async () => {
        await cache.removeByPattern(pattern);

        expect(spyHelper.cache.assertConnected.calledOnce).to.be.true;
        expect(spyHelper.cache.assertConnected.firstCall.args.length).to.be.equal(0);
      });

      it('should call cbToPromise for each iteration', async () => {
        await cache.removeByPattern(pattern);

        expect(spyHelper.promiseUtils.cbToPromise.calledThrice).to.be.true;
      });

      it('should call Cache.redisClient.scan for each finded elements', async () => {
        await cache.removeByPattern(pattern);

        expect(redisClientStub.stubs.scan.calledThrice).to.be.true;

        expect(redisClientStub.stubs.scan.getCall(0).args.length).to.be.equal(4);
        expect(redisClientStub.stubs.scan.getCall(0).args[0]).to.be.equal(`${cursor}`);
        expect(redisClientStub.stubs.scan.getCall(0).args[1]).to.be.equal('MATCH');
        expect(redisClientStub.stubs.scan.getCall(0).args[2]).to.be.equal(pattern);

        expect(redisClientStub.stubs.scan.getCall(1).args.length).to.be.equal(4);
        expect(redisClientStub.stubs.scan.getCall(1).args[0]).to.be.equal(`${resArrays[0][0]}`);
        expect(redisClientStub.stubs.scan.getCall(1).args[1]).to.be.equal('MATCH');
        expect(redisClientStub.stubs.scan.getCall(1).args[2]).to.be.equal(pattern);

        expect(redisClientStub.stubs.scan.getCall(2).args.length).to.be.equal(4);
        expect(redisClientStub.stubs.scan.getCall(2).args[0]).to.be.equal(`${resArrays[1][0]}`);
        expect(redisClientStub.stubs.scan.getCall(2).args[1]).to.be.equal('MATCH');
        expect(redisClientStub.stubs.scan.getCall(2).args[2]).to.be.equal(pattern);
      });

      it('should call Cache.deleteJsonForKey for each finded elements where keys.length>0', async () => {
        await cache.removeByPattern(pattern);

        expect(deleteJsonForKeyStub.calledTwice).to.be.true;

        expect(deleteJsonForKeyStub.getCall(0).args.length).to.be.equal(1);
        expect(deleteJsonForKeyStub.getCall(0).args[0]).to.be.equal(resArrays[0][1]);

        expect(deleteJsonForKeyStub.getCall(1).args.length).to.be.equal(1);
        expect(deleteJsonForKeyStub.getCall(1).args[0]).to.be.equal(resArrays[2][1]);
      });

    });

    describe('.flushDb', () => {

      let redisResult;

      beforeEach(() => {
        redisResult = 'ok';

        redisClientStub.stubs.flushdb.callsArgWith(0, null, redisResult);
      });

      it('should call Cache.assertConnected', async () => {
        await cache.flushDb();

        expect(spyHelper.cache.assertConnected.calledOnce).to.be.true;
        expect(spyHelper.cache.assertConnected.firstCall.args.length).to.be.equal(0);
      });

      it('should call Cache.redisClient.flushDb after resolved promise', async () => {
        await cache.flushDb();

        expect(spyHelper.promiseUtils.cbToVoidPromise.calledOnce).to.be.true;
        expect(spyHelper.promiseUtils.cbToVoidPromise.firstCall.args.length).to.be.equal(1);
        expect(spyHelper.promiseUtils.cbToVoidPromise.firstCall.args[0]).to.be.a('function');

        expect(redisClientStub.stubs.flushdb.calledOnce).to.be.true;
        expect(redisClientStub.stubs.flushdb.firstCall.args.length).to.be.equal(1);
      });

      it('should return a positive result of flushdb', async () => {
        const ret = await cache.flushDb();

        expect(ret).to.be.an('string');
        expect(ret).to.be.equal(redisResult);
      });

    });

    describe('.cleanup', () => {

      let quitStub;

      beforeEach(() => {
        quitStub = sandbox.stub(cache, 'quit');
      });

      after(() => {
        (cache as any).redisClient.connected = true;
      });

      it('should call Cache.quit', async () => {
        await cache.cleanup();

        expect(quitStub.calledOnce).to.be.true;
        expect(quitStub.firstCall.args.length).to.be.equal(0);
      });

      it('should not call Cache.quit if connection isn"t established', async () => {
        (cache as any).redisClient.connected = false;

        await cache.cleanup();

        expect(quitStub.callCount).to.be.equal(0);
      });

    });

    describe('.quit', () => {

      let redisResult;

      beforeEach(() => {
        redisResult = 'ok';

        redisClientStub.stubs.quit.callsArgWith(0, null, redisResult);
      });

      it('should call Cache.assertConnected', async () => {
        await cache.quit();

        expect(spyHelper.cache.assertConnected.calledOnce).to.be.true;
        expect(spyHelper.cache.assertConnected.firstCall.args.length).to.be.equal(0);
      });

      it('should call Cache.redisClient.flushDb after resolved promise', async () => {
        await cache.quit();

        expect(spyHelper.promiseUtils.cbToVoidPromise.calledOnce).to.be.true;
        expect(spyHelper.promiseUtils.cbToVoidPromise.firstCall.args.length).to.be.equal(1);
        expect(spyHelper.promiseUtils.cbToVoidPromise.firstCall.args[0]).to.be.a('function');

        expect(redisClientStub.stubs.quit.calledOnce).to.be.true;
        expect(redisClientStub.stubs.quit.firstCall.args.length).to.be.equal(1);
      });

      it('should return a positive result of flushdb', async () => {
        const ret = await cache.quit();

        expect(ret).to.be.an('string');
        expect(ret).to.be.equal(redisResult);
      });

    });

    describe('.onNewBlock', () => {

      let removeByPatternStub;

      beforeEach(() => {
        removeByPatternStub = sandbox.stub(cache, 'removeByPattern');
      });

      it('should call Cache.assertConnectedAndReady', async () => {
        await cache.onNewBlock();

        expect(spyHelper.cache.assertConnectedAndReady.calledOnce).to.be.true;
        expect(spyHelper.cache.assertConnectedAndReady.firstCall.args.length).to.be.equal(0);
      });

      it('should call Cache.removeByPattern for each toRemove(two times)', async () => {
        await cache.onNewBlock();

        expect(removeByPatternStub.calledTwice).to.be.true;

        expect(removeByPatternStub.firstCall.args.length).to.be.equal(1);
        expect(removeByPatternStub.secondCall.args.length).to.be.equal(1);
      });

    });

    describe('.onFinishRound', () => {

      let removeByPatternStub;

      beforeEach(() => {
        removeByPatternStub = sandbox.stub(cache, 'removeByPattern');
      });

      // tslint:disable-next-line: max-line-length
      it('Should call to removeByPattern() with parameter /api/delegates* for to remove all cache entries', async () => {
        await cache.onFinishRound();

        expect(spyHelper.cache.assertConnectedAndReady.calledOnce).to.be.true;
        expect(spyHelper.cache.assertConnectedAndReady.firstCall.args.length).to.be.equal(0);
        expect(removeByPatternStub.calledOnce).to.be.true;
        expect(removeByPatternStub.firstCall.args.length).to.be.equal(1);
        expect(removeByPatternStub.firstCall.args[0]).to.be.equal('/api/delegates*');
      });
    });

    describe('.onTransactionsSaved', () => {
      // tslint:disable max-line-length
      const transactions = [
        {
          amount         : 10000000000000000,
          asset          : 1,
          fee            : 0,
          id             : '1465651642158264047',
          recipientId    : '16313739661670634666L',
          senderPublicKey: 'c96dec3595ff6041c3bd28b76b8cf75dce8225173d1bd00241624ee89b50f2a8',
          signature      : 'd8103d0ea2004c3dea8076a6a22c6db8bae95bc0db819240c77fc5335f32920e91b9f41f58b01fc86dfda11019c9fd1c6c3dcbab0a4e478e3c9186ff6090dc05',
          timestamp      : 0,
          type           : TransactionType.DELEGATE,
        },
        {
          amount         : 100,
          asset          : 1,
          fee            : 0,
          id             : '9314232245035524467',
          recipientId    : '16313739661670634666L',
          senderPublicKey: 'c094ebee7ec0c50ebee32918655e089f6e1a604b83bcaa760293c61e0f18ab6f',
          signature      : 'd8103d0ea2004c3dea8076a6a22c6db8bae95bc0db819240c77fc5335f32920e91b9f41f58b01fc86dfda11019c9fd1c6c3dcbab0a4e478e3c9186ff6090dc05',
          timestamp      : 0,
          type           : TransactionType.MULTI,
        },
      ];
      // tslint:enable max-line-length

      let removeByPatternStub;
      let error;

      beforeEach(() => {
        error = new Error('error');

        removeByPatternStub = sandbox.stub(cache, 'removeByPattern');
      });

      it('should call Cache.assertConnectedAndReady', async () => {
        await cache.onTransactionsSaved(transactions);

        expect(spyHelper.cache.assertConnectedAndReady.calledOnce).to.be.true;
        expect(spyHelper.cache.assertConnectedAndReady.firstCall.args.length).to.be.equal(0);
      });

      // tslint:disable max-line-length
      it('should call Cache.removeByPattern when one of transactions has TransactionType.DELEGATE type', async () => {
        await cache.onTransactionsSaved(transactions);

        expect(removeByPatternStub.calledOnce).to.be.true;
        expect(removeByPatternStub.firstCall.args.length).to.be.equal(1);
        expect(removeByPatternStub.firstCall.args[0]).to.be.equal('/api/delegates*');
      });
      // tslint:enable max-line-length

      it('shouldn"t call Cache.removeByPattern with all tx.type !== TransactionType.DELEGATE', async () => {
        await cache.onTransactionsSaved([transactions[1]]);

        expect(removeByPatternStub.notCalled).to.be.true;
      });
    });

    describe('.onSyncStarted', () => {
      it('should set Cache.cacheReady in false', () => {
        cache.onSyncStarted();

        expect((cache as any).cacheReady).to.be.false;
      });
    });

    describe('.onSyncFinished', () => {
      it('should set Cache.cacheReady in true', () => {
        (cache as any).cacheReady = false;

        cache.onSyncFinished();

        expect((cache as any).cacheReady).to.be.true;
      });
    });
  });

  describe('DummyCache', () => {

    it('get .isConnected should rejected with Cache not enabled msg', () => {
      expect(() => dummyCache.isConnected()).to.throw('Cache not enabled');
    });

    it('.assertConnected should rejected with Cache not enabled msg', async () => {
      await expect(dummyCache.assertConnected()).to.rejectedWith('Cache not enabled');
    });

    it('.assertConnectedAndReady should rejected with Cache not enabled msg', async () => {
      await expect(dummyCache.assertConnectedAndReady()).to.rejectedWith('Cache not enabled');
    });

    it('.cleanup should resolved as there is nothing to cleanup', async () => {
      await dummyCache.cleanup();
    });

    it('.deleteJsonForKey should rejected with Cache not enabled msg', async () => {
      const myString = 'string';

      await expect(dummyCache.deleteJsonForKey(myString)).to.rejectedWith('Cache not enabled');
    });

    it('.deleteJsonForKey should rejected with Cache not enabled msg', async () => {
      await expect(dummyCache.flushDb()).to.rejectedWith('Cache not enabled');
    });

    it('.deleteJsonForKey should rejected with Cache not enabled msg', async () => {
      const myString = 'string';

      await expect(dummyCache.getObjFromKey(myString)).to.rejectedWith('Cache not enabled');
    });

    it('.deleteJsonForKey should rejected with Cache not enabled msg', async () => {
      await expect(dummyCache.quit()).to.rejectedWith('Cache not enabled');
    });

    it('.deleteJsonForKey should rejected with Cache not enabled msg', async () => {
      const pattern = 'string';

      await expect(dummyCache.removeByPattern(pattern)).to.rejectedWith('Cache not enabled');
    });

    it('.deleteJsonForKey should rejected with Cache not enabled msg', async () => {
      const myString = 'string';
      const value    = 5;
      await expect(dummyCache.setObjFromKey(myString, value)).to.rejectedWith('Cache not enabled');
    });
  });
});
