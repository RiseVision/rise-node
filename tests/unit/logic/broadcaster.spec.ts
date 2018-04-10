import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BroadcasterLogic, BroadcastTaskOptions } from '../../../src/logic';
import {
  JobsQueueStub, LoggerStub, PeersLogicStub, PeersModuleStub,
  TransactionLogicStub, TransactionsModuleStub
} from '../../stubs';
import { constants } from './../../../src/helpers/';

// tslint:disable no-unused-expression
describe('logic/broadcaster', () => {
  let sandbox: SinonSandbox;
  let fakeConfig: any;
  let instance: BroadcasterLogic;
  let jobsQueueStub: JobsQueueStub;
  let loggerStub: LoggerStub;
  let peersLogicStub: PeersLogicStub;
  let transactionLogicStub: TransactionLogicStub;
  let fakeAppState: { set: SinonStub };
  let peersModuleStub: PeersModuleStub;
  let transactionsModuleStub: TransactionsModuleStub;

  beforeEach(() => {
    sandbox                = sinon.sandbox.create({
      useFakeTimers: true,
    });
    fakeConfig             = {
      broadcasts: {
        broadcastInterval: 1,
        broadcastLimit   : 2,
        parallelLimit    : 3,
        releaseLimit     : 4,
        relayLimit       : 5,
      },
      forging   : {
        force: false,
      },
    };
    jobsQueueStub          = new JobsQueueStub();
    fakeAppState           = { set: sandbox.stub() };
    loggerStub             = new LoggerStub();
    peersLogicStub         = new PeersLogicStub();
    transactionLogicStub   = new TransactionLogicStub();
    peersModuleStub        = new PeersModuleStub();
    transactionsModuleStub = new TransactionsModuleStub();

    // Dependency injection
    instance                             = new BroadcasterLogic();
    (instance as any).config             = fakeConfig;
    (instance as any).constants          = constants;
    (instance as any).jobsQueue          = jobsQueueStub;
    (instance as any).logger             = loggerStub;
    (instance as any).peersLogic         = peersLogicStub;
    (instance as any).transactionLogic   = transactionLogicStub;
    (instance as any).appState           = fakeAppState;
    (instance as any).peersModule        = peersModuleStub;
    (instance as any).transactionsModule = transactionsModuleStub;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('afterConstruct', () => {
    it('should call appState.set if forging.force', () => {
      fakeConfig.forging.force = true;
      (instance as any).afterConstruct();
      expect(fakeAppState.set.calledOnce).to.be.true;
      expect(fakeAppState.set.firstCall.args[0]).to.be.equal('node.consensus');
      expect(fakeAppState.set.firstCall.args[1]).to.be.undefined;
    });

    it('should call appState with consensus value if NOT forging.force', () => {
      fakeConfig.forging.force = false;
      (instance as any).afterConstruct();
      expect(fakeAppState.set.calledOnce).to.be.true;
      expect(fakeAppState.set.firstCall.args[0]).to.be.equal('node.consensus');
      expect(fakeAppState.set.firstCall.args[1]).to.be.equal(100);
    });

    it('should call JobsQueue.register', () => {
      (instance as any).afterConstruct();
      expect(jobsQueueStub.stubs.register.calledOnce).to.be.true;
      expect(jobsQueueStub.stubs.register.firstCall.args.length).to.be.equal(3);
      expect(jobsQueueStub.stubs.register.firstCall.args[0]).to.be.equal('broadcasterNextRelease');
      expect(jobsQueueStub.stubs.register.firstCall.args[1]).to.be.a('function');
      expect(jobsQueueStub.stubs.register.firstCall.args[2]).to.be.equal(fakeConfig.broadcasts.broadcastInterval);
    });

    it('should call to releaseQueue()', async () => {
      jobsQueueStub.stubs.register.callsFake((name: string, job: () => Promise<any>, time: number) => {
        job();
      });
      instance['releaseQueue'] = sandbox.stub().resolves(true);
      await instance.afterConstruct();
      expect(jobsQueueStub.stubs.register.called).to.be.true;
      expect(instance['releaseQueue'].calledOnce).to.be.true;
    });

    it('if releaseQueue() rejects should call to catch()', async () => {
      jobsQueueStub.stubs.register.callsFake((name: string, job: () => Promise<any>, time: number) => {
        job();
      });
      instance['releaseQueue'] = sandbox.stub().rejects(new Error('Booo!'));
      await instance.afterConstruct();
      expect(jobsQueueStub.stubs.register.called).to.be.true;
      expect(instance['releaseQueue'].calledOnce).to.be.true;
      expect(loggerStub.stubs.log.called).to.be.true;
    });
  });

  describe('getPeers', () => {
    let limit: number;
    let broadhash: string;
    let peers: any[];
    let consensus: number;

    beforeEach(() => {
      limit     = 100;
      broadhash = 'asd';
      peers     = [];
      consensus = 123;
      peersModuleStub.stubs.list.resolves({ peers, consensus });
    });

    it('should call peersModule.list', async () => {
      await instance.getPeers({ limit, broadhash });
      expect(peersModuleStub.stubs.list.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.list.firstCall.args.length).to.be.equal(1);
      expect(peersModuleStub.stubs.list.firstCall.args[0]).to.be.deep.equal({ limit, broadhash });
    });

    it('should call peersModule.list also with default params', async () => {
      await instance.getPeers({});
      expect(peersModuleStub.stubs.list.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.list.firstCall.args.length).to.be.equal(1);
      expect(peersModuleStub.stubs.list.firstCall.args[0]).to.be.deep.equal({
        limit    : constants.maxPeers,
        broadhash: null,
      });
    });

    it('should set consensus if limit is constants.maxPeers', async () => {
      await instance.getPeers({ limit: constants.maxPeers });
      expect(fakeAppState.set.calledOnce).to.be.true;
      expect(fakeAppState.set.firstCall.args[0]).to.be.equal('node.consensus');
      expect(fakeAppState.set.firstCall.args[1]).to.be.equal(consensus);
    });

    it('should set consensus in 100 if limit is constants.maxPeers and config.forging.force is true', async () => {
      (instance as any).config.forging.force = true;
      await instance.getPeers({ limit: constants.maxPeers });
      expect(fakeAppState.set.calledOnce).to.be.true;
      expect(fakeAppState.set.firstCall.args[0]).to.be.equal('node.consensus');
      expect(fakeAppState.set.firstCall.args[1]).to.be.equal(100);
    });

    it('should return the right value', async () => {
      const result = await instance.getPeers({ limit: constants.maxPeers });
      expect(result).to.be.equal(peers);
    });
  });

  describe('enqueue', () => {
    let params: any;
    let options: BroadcastTaskOptions;

    beforeEach(() => {
      params  = {};
      options = {
        immediate: true,
        data     : {},
        api      : 'api',
        method   : 'method',
      };
    });

    it('should call queue.push called; immediate is set', () => {
      const spy = sandbox.spy(instance.queue, 'push');

      instance.enqueue(params, options);

      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.args.length).to.be.equal(1);
      expect(spy.firstCall.args[0]).to.be.deep.equal({
        params : {},
        options: {
          immediate: false,
          data     : {},
          api      : 'api',
          method   : 'method',
        },
      });
    });

    it('build the queue as expected', () => {
      instance.enqueue(params, options);

      expect(instance.queue).to.be.deep.equal([{
        params : {},
        options: {
          immediate: false,
          data     : {},
          api      : 'api',
          method   : 'method',
        },
      }]);
    });

    it('should return the right value', () => {
      const result: any = instance.enqueue(params, options);
      expect(result).to.be.deep.equal(1);
    });
  });

  describe('broadcast', () => {
    let params: any;
    let options: any;
    let peers: any[];
    let createdPeers: any[];

    let getPeersStub: any;

    beforeEach(() => {
      params       = {
        limit    : 100,
        broadhash: 'broadhash',
        peers    : null,
      };
      options      = {};
      peers        = [{}, {}];
      createdPeers = [
        { string: 'first', makeRequest: sandbox.stub().resolves(), },
        { string: 'second', makeRequest: sandbox.stub().resolves(), },
      ];

      getPeersStub = sandbox.stub(instance, 'getPeers');
      getPeersStub.resolves(peers);

      peers.forEach((peer, index) => {
        peersLogicStub.stubs.create.onCall(index).returns(createdPeers[index]);
      });
    });

    it('should call getPeers', async () => {
      await instance.broadcast(params, options);
      expect(getPeersStub.calledOnce).to.be.true;
      expect(getPeersStub.firstCall.args.length).to.be.equal(1);
      expect(getPeersStub.firstCall.args[0]).to.be.equal(params);
    });

    it('should not call getPeers if peers passed', async () => {
      params.peers = peers;
      await instance.broadcast(params, options);
      expect(getPeersStub.called).to.be.false;
    });

    it('should call logger.debug', async () => {
      const error: Error = new Error('error');
      createdPeers.forEach((p) => {
        p.makeRequest.rejects(error);
      });

      await instance.broadcast(params, options);

      expect(loggerStub.stubs.debug.callCount).to.be.equal(peers.length + 2);
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Begin broadcast');
      expect(loggerStub.stubs.debug.firstCall.args[1]).to.be.equal(options);

      createdPeers.forEach((peer, index) => {
        expect(loggerStub.stubs.debug.getCall(index + 1).args.length).to.be.equal(2);
        expect(loggerStub.stubs.debug.getCall(index + 1).args[0]).to.be.
         equal(`Failed to broadcast to peer: ${peer.string}`);
        expect(loggerStub.stubs.debug.getCall(index + 1).args[1]).to.be.equal(error);
      });

      expect(loggerStub.stubs.debug.getCall(peers.length + 1).args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.getCall(peers.length + 1).args[0]).to.be.equal('End broadcast');
    });

    it('should call peersLogic.create for each peer', async () => {
      await instance.broadcast(params, options);
      expect(peersLogicStub.stubs.create.callCount).to.be.equal(peers.length);
      peers.forEach((peer, index) => {
        expect(peersLogicStub.stubs.create.getCall(index).args.length).to.be.equal(1);
        expect(peersLogicStub.stubs.create.getCall(index).args[0]).to.be.equal(peer);
      });
    });

    it('should call peer.makeRequest per each created peer instance', async () => {
      peersLogicStub.stubs.create.resetBehavior();
      const stubs              = [];
      let makeRequestCallCount = 0;
      peersLogicStub.stubs.create.callsFake((p) => {
        const peer = {
          makeRequest: sandbox.stub().callsFake(() => {
            makeRequestCallCount++;
            return Promise.resolve();
          }),
          peer       : p,
        };
        stubs.push(peer);
        return peer;
      });

      await instance.broadcast(params, options);
      expect(makeRequestCallCount).to.be.equal(peers.length);
      peers.forEach((peer, index) => {
        expect(stubs[index].makeRequest.args.length).to.be.equal(1);
        expect(stubs[index].makeRequest.firstCall.args[0]).to.be.deep.equal(options);
      });
    });

    it('should return the right value', async () => {
      const result = await instance.broadcast(params, options);

      expect(result).to.be.deep.equal({
        peer: peers,
      });
    });
  });

  describe('maxRelays', () => {
    let obj: any;

    beforeEach(() => {
      obj = {
        relays: fakeConfig.broadcasts.relayLimit - 1,
      };
    });

    it('should return false if no relays passed', () => {
      delete obj.relays;

      const result = instance.maxRelays(obj);

      expect(obj).to.have.property('relays');
      expect(obj.relays).to.be.equal(1);
      expect(result).to.be.false;
    });

    it('should return true if relays is greater', () => {
      obj.relays   = fakeConfig.broadcasts.relayLimit;
      const result = instance.maxRelays(obj);
      expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Broadcast relays exhausted');
      expect(loggerStub.stubs.debug.firstCall.args[1]).to.be.equal(obj);
      expect(result).to.be.true;
    });

    it('should return false if relays is less', () => {
      const result = instance.maxRelays(obj);
      expect(obj.relays).to.be.equal(fakeConfig.broadcasts.relayLimit);
      expect(result).to.be.false;
    });
  });

  describe('filterQueue', () => {
    let task: any;
    let length: number;
    let filterStub: SinonStub;

    beforeEach(() => {
      task = {
        options: {
          immediate: true,
          data     : {
            transaction: 'transaction',
          },
        },
      };

      instance.queue.push(task);
      length = instance.queue.length;

      filterStub = sandbox.stub((instance as any), 'filterTransaction');
      filterStub.resolves(true);
    });

    it('should call logger.debug', async () => {
      await (instance as any).filterQueue();
      expect(loggerStub.stubs.debug.calledTwice).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal(`Broadcast before filtering: ${length}`);
      expect(loggerStub.stubs.debug.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.secondCall.args[0]).to.be.
      equal(`Broadcasts after filtering: ${instance.queue.length}`);
    });

    it('should behave correctly when options.immediate=true', async () => {
      await (instance as any).filterQueue();
      expect(instance.queue).to.be.deep.equal([task]);
    });

    it('should behave correctly when options.immediate false; data true; filter true', async () => {
      task.options.immediate = false;
      await (instance as any).filterQueue();
      expect(instance.queue).to.be.deep.equal([task]);
    });

    it('should behave correctly when immediate false; data true; filter false', async () => {
      task.options.immediate = false;
      filterStub.resolves(false);
      await (instance as any).filterQueue();
      expect(instance.queue).to.be.deep.equal([]);
    });

    it('should behave correctly when immediate false; data false', async () => {
      task.options.immediate = false;
      task.options.data      = false;
      await (instance as any).filterQueue();
      expect(instance.queue).to.be.deep.equal([task]);
    });
  });

  describe('filterTransaction', () => {
    let tx;

    beforeEach(() => {
      tx = { id: 'id' };
    });

    it('should return false when tx undefined', async () => {
      const result = await (instance as any).filterTransaction();
      expect(transactionsModuleStub.stubs.transactionInPool.called).to.be.false;
      expect(result).to.be.false;
    });

    it('should return true when tx is in pool', async () => {
      transactionsModuleStub.stubs.transactionInPool.returns(true);
      const result = await (instance as any).filterTransaction(tx);
      expect(transactionsModuleStub.stubs.transactionInPool.calledOnce).to.be.true;
      expect(transactionsModuleStub.stubs.transactionInPool.firstCall.args.length).to.be.equal(1);
      expect(transactionsModuleStub.stubs.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);
      expect(transactionLogicStub.stubs.assertNonConfirmed.called).to.be.false;
      expect(result).to.be.true;
    });

    it('should behave correctly when tx is not in pool and assert does not throw error', async () => {
      transactionsModuleStub.stubs.transactionInPool.returns(false);
      transactionLogicStub.stubs.assertNonConfirmed.resolves();
      const result = await (instance as any).filterTransaction(tx);
      expect(transactionsModuleStub.stubs.transactionInPool.calledOnce).to.be.true;
      expect(transactionsModuleStub.stubs.transactionInPool.firstCall.args.length).to.be.equal(1);
      expect(transactionsModuleStub.stubs.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);
      expect(transactionLogicStub.stubs.assertNonConfirmed.calledOnce).to.be.true;
      expect(transactionLogicStub.stubs.assertNonConfirmed.firstCall.args.length).to.be.equal(1);
      expect(transactionLogicStub.stubs.assertNonConfirmed.firstCall.args[0]).to.be.equal(tx);
      expect(result).to.be.true;
    });

    it('should behave correctly when tx is not in pool; assert throws error', async () => {
      transactionsModuleStub.stubs.transactionInPool.returns(false);
      transactionLogicStub.stubs.assertNonConfirmed.throws(new Error());
      const result = await (instance as any).filterTransaction(tx);
      expect(transactionsModuleStub.stubs.transactionInPool.calledOnce).to.be.true;
      expect(transactionsModuleStub.stubs.transactionInPool.firstCall.args.length).to.be.equal(1);
      expect(transactionsModuleStub.stubs.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);
      expect(transactionLogicStub.stubs.assertNonConfirmed.calledOnce).to.be.true;
      expect(transactionLogicStub.stubs.assertNonConfirmed.firstCall.args.length).to.be.equal(1);
      expect(transactionLogicStub.stubs.assertNonConfirmed.firstCall.args[0]).to.be.equal(tx);
      expect(result).to.be.false;
    });
  });

  describe('squashQueue', () => {
    let routes;
    let broadcasts;

    beforeEach(() => {
      routes     = [{
        path      : 'type1',
        collection: 'collection1',
        object    : 'object1',
        method    : 'method1',
      }, {
        path      : 'type2',
        collection: 'collection2',
        object    : 'object2',
        method    : 'method2',
      }];
      broadcasts = [{
        options: { api: 'type1', data: { object1: 'object1' } },
      }, {
        options: { api: 'type2', data: { object2: 'object2' } },
      }, {
        options: { api: 'type1', data: { object1: 'object1' } },
      }];

      instance.routes = routes;
    });

    it('should return the expected result', () => {
      const result = (instance as any).squashQueue(broadcasts);

      expect(result).to.be.deep.equal([{
        options: {
          api      : routes[0].path,
          data     : {
            [routes[0].collection]: [
              broadcasts[0].options.data.object1,
              broadcasts[2].options.data.object1,
            ],
          },
          immediate: false,
          method   : routes[0].method,
        },
      }, {
        options: {
          api      : routes[1].path,
          data     : {
            [routes[1].collection]: [
              broadcasts[1].options.data.object2,
            ],
          },
          immediate: false,
          method   : routes[1].method,
        },
      }]);
    });
  });

  describe('releaseQueue', () => {
    let queue;
    let broadcasts;
    let peers;

    let filterQueueStub: SinonStub;
    let squashQueueStub: SinonStub;
    let broadcastStub: SinonStub;

    beforeEach(() => {
      queue      = [{}, {}];
      broadcasts = [{
        params : { name: 'params1' },
        options: 'options1',
      }, {
        params : { name: 'params2' },
        options: 'options2',
      }];
      peers      = [{ some: 'some1' }, { some: 'some2' }];

      instance.queue = queue;

      filterQueueStub = sandbox.stub(instance as any, 'filterQueue');
      squashQueueStub = sandbox.stub(instance as any, 'squashQueue');
      broadcastStub   = sandbox.stub(instance as any, 'broadcast');

      squashQueueStub.returns(broadcasts);
      broadcastStub.resolves();
    });

    it('should call logger.debug at first time', async () => {
      await (instance as any).releaseQueue();
      expect(loggerStub.stubs.debug.callCount).to.be.at.least(1);
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Releasing enqueued broadcasts');
    });

    it('should not call filterQueue if queue.length == 0', async () => {
      instance.queue = [];
      const result   = await (instance as any).releaseQueue();
      expect(loggerStub.stubs.debug.callCount).to.be.equal(2);
      expect(loggerStub.stubs.debug.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.secondCall.args[0]).to.be.equal('Queue empty');
      expect(result).to.be.undefined;
      expect(filterQueueStub.called).to.be.false;
    });

    it('should call filterQueue if queue is not empty', async () => {
      await (instance as any).releaseQueue();
      expect(filterQueueStub.calledOnce).to.be.true;
      expect(filterQueueStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call squashQueue', async () => {
      await (instance as any).releaseQueue();
      expect(squashQueueStub.calledOnce).to.be.true;
      expect(squashQueueStub.firstCall.args.length).to.be.equal(1);
      expect(squashQueueStub.firstCall.args[0]).to.be.deep.equal([{}, {}]);
    });

    it('should call broadcast', async () => {
      await (instance as any).releaseQueue();
      expect(broadcastStub.callCount).to.be.equal(broadcasts.length);
      broadcasts.forEach((broadcast, index) => {
        expect(broadcastStub.getCall(index).args.length).to.be.equal(2);
        expect(broadcastStub.getCall(index).args[0]).to.be.deep.equal({
          name: broadcast.params.name,
        });
        expect(broadcastStub.getCall(index).args[1]).to.be.equal(broadcast.options);
      });
    });

    it('should call logger.debug on fail', async () => {
      const error = new Error('error');
      broadcastStub.rejects(error);
      await (instance as any).releaseQueue();
      expect(loggerStub.stubs.warn.calledOnce).to.be.true;
      expect(loggerStub.stubs.warn.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal('Failed to release broadcast queue');
      expect(loggerStub.stubs.warn.firstCall.args[1]).to.be.equal(error);
    });

    it('should call logger.debug on success', async () => {
      await (instance as any).releaseQueue();
      expect(loggerStub.stubs.debug.calledTwice).to.be.true;
      expect(loggerStub.stubs.debug.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.secondCall.args[0]).to.be.equal(`Broadcasts released ${broadcasts.length}`);
    });
  });
});
