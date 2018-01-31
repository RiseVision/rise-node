import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { JobsQueueStub, LoggerStub, PeersLogicStub, PeersModuleStub,
         TransactionLogicStub, TransactionsModuleStub } from '../../stubs';
import { constants } from './../../../src/helpers/';
import { BroadcasterLogic, BroadcastTaskOptions } from './../../../src/logic/broadcaster';

// tslint:disable no-unused-expression
describe('logic/broadcaster', () => {
  let sandbox: SinonSandbox;
  let fakeConfig: any;
  let instance: BroadcasterLogic;
  let jobsQueueStub: JobsQueueStub;
  let loggerStub: LoggerStub;
  let peersLogicStub: PeersLogicStub;
  let transactionLogicStub: TransactionLogicStub;
  let fakeAppState: {set: SinonStub};
  let peersModuleStub: PeersModuleStub;
  let transactionsModuleStub: TransactionsModuleStub;

  beforeEach(() => {
    sandbox = sinon.sandbox.create({
      useFakeTimers: true,
    });
    fakeConfig = {
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
    jobsQueueStub = new JobsQueueStub();
    fakeAppState = {set: sandbox.stub()};
    loggerStub = new LoggerStub();
    peersLogicStub = new PeersLogicStub();
    transactionLogicStub = new TransactionLogicStub();
    peersModuleStub = new PeersModuleStub();
    transactionsModuleStub = new TransactionsModuleStub();

    // Dependency injection
    instance = new BroadcasterLogic();
    (instance as any).config = fakeConfig;
    (instance as any).constants = constants;
    (instance as any).jobsQueue = jobsQueueStub;
    (instance as any).logger = loggerStub;
    (instance as any).peersLogic = peersLogicStub;
    (instance as any).transactionLogic = transactionLogicStub;
    (instance as any).appState = fakeAppState;
    (instance as any).peersModule = peersModuleStub;
    (instance as any).transactionsModule = transactionsModuleStub;
  });

  afterEach(() => {
    sandbox.reset();
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
      peersLogicStub.stubs.create.reset();
      const stubs = [];
      let makeRequestCallCount = 0;
      peersLogicStub.stubs.create.callsFake((p) => {
        const peer = {
          makeRequest: sandbox.stub().callsFake((o) => {
            makeRequestCallCount++;
            return Promise.resolve();
          }),
          peer: p,
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
      obj.relays = fakeConfig.broadcasts.relayLimit;
      const result = instance.maxRelays(obj);
      expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Broadcast relays exhausted');
      expect(loggerStub.stubs.debug.firstCall.args[1]).to.be.equal(obj);
      expect(result).to.be.true;
    });

    it('return false if relays is less', () => {
      const result = instance.maxRelays(obj);
      expect(obj.relays).to.be.equal(fakeConfig.broadcasts.relayLimit);
      expect(result).to.be.false;
    });
  });

  // describe('filterQueue', () => {
  //   let task: any;
  //   let length: any;
  //   let filterStub: any;
  //
  //   beforeEach(() => {
  //     task = {
  //       options: {
  //         immediate: true,
  //         data     : {
  //           transaction: 'transaction'
  //         }
  //       }
  //     };
  //
  //     instance.queue.push(task);
  //     length = instance.queue.length;
  //
  //     filterStub = sandbox.stub((instance as any), 'filterTransaction');
  //     filterStub.resolves(true);
  //   });
  //
  //   it('logger.debug is called', async () => {
  //     await (instance as any).filterQueue();
  //
  //     expect(library.logger.debug.calledTwice).to.be.true;
  //     expect(library.logger.debug.firstCall.args.length).to.be.equal(1);
  //     expect(library.logger.debug.firstCall.args[0]).to.be.equal(`Broadcast before filtering: ${length}`);
  //     expect(library.logger.debug.secondCall.args.length).to.be.equal(1);
  //     expect(library.logger.debug.secondCall.args[0]).to.be.equal(`Broadcasts after filtering: ${instance.queue.length}`);
  //   });
  //
  //   it('immediate true', async () => {
  //     await (instance as any).filterQueue();
  //
  //     expect(instance.queue).to.be.deep.equal([task]);
  //   });
  //
  //   it('immediate false; data true; filter true', async () => {
  //     task.options.immediate = false;
  //
  //     await (instance as any).filterQueue();
  //
  //     expect(instance.queue).to.be.deep.equal([task]);
  //   });
  //
  //   it('immediate false; data true; filter false', async () => {
  //     task.options.immediate = false;
  //     filterStub.resolves(false);
  //
  //     await (instance as any).filterQueue();
  //
  //     expect(instance.queue).to.be.deep.equal([]);
  //   });
  //
  //   it('immediate false; data false', async () => {
  //     task.options.immediate = false;
  //     task.options.data      = false;
  //
  //     await (instance as any).filterQueue();
  //
  //     expect(instance.queue).to.be.deep.equal([task]);
  //   });
  // });
  //
  // describe('filterTransaction', () => {
  //   let tx;
  //
  //   beforeEach(() => {
  //     tx = { id: 'id' };
  //   });
  //
  //   it('tx undefined; false is returned', async () => {
  //     const result = await (instance as any).filterTransaction();
  //
  //     expect(modules.transactions.transactionInPool.called).to.be.false;
  //     expect(result).to.be.false;
  //   });
  //
  //   it('tx is in pool; true is returned', async () => {
  //     modules.transactions.transactionInPool.returns(true);
  //     const result = await (instance as any).filterTransaction(tx);
  //
  //     expect(modules.transactions.transactionInPool.calledOnce).to.be.true;
  //     expect(modules.transactions.transactionInPool.firstCall.args.length).to.be.equal(1);
  //     expect(modules.transactions.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);
  //
  //     expect(library.logic.transactions.assertNonConfirmed.called).to.be.false;
  //
  //     expect(result).to.be.true;
  //   });
  //
  //   it('tx is not in pool; assert doesn\'t throw error', async () => {
  //     modules.transactions.transactionInPool.returns(false);
  //
  //     const result = await (instance as any).filterTransaction(tx);
  //
  //     expect(modules.transactions.transactionInPool.calledOnce).to.be.true;
  //     expect(modules.transactions.transactionInPool.firstCall.args.length).to.be.equal(1);
  //     expect(modules.transactions.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);
  //
  //     expect(library.logic.transactions.assertNonConfirmed.calledOnce).to.be.true;
  //     expect(library.logic.transactions.assertNonConfirmed.firstCall.args.length).to.be.equal(1);
  //     expect(library.logic.transactions.assertNonConfirmed.firstCall.args[0]).to.be.equal(tx);
  //
  //     expect(result).to.be.true;
  //   });
  //
  //   it('tx is not in pool; assert throws error', async () => {
  //     modules.transactions.transactionInPool.returns(false);
  //     library.logic.transactions.assertNonConfirmed.throws(new Error());
  //
  //     const result = await (instance as any).filterTransaction(tx);
  //
  //     expect(modules.transactions.transactionInPool.calledOnce).to.be.true;
  //     expect(modules.transactions.transactionInPool.firstCall.args.length).to.be.equal(1);
  //     expect(modules.transactions.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);
  //
  //     expect(library.logic.transactions.assertNonConfirmed.calledOnce).to.be.true;
  //     expect(library.logic.transactions.assertNonConfirmed.firstCall.args.length).to.be.equal(1);
  //     expect(library.logic.transactions.assertNonConfirmed.firstCall.args[0]).to.be.equal(tx);
  //
  //     expect(result).to.be.false;
  //   });
  // });
  //
  // describe('squashQueue', () => {
  //   let routes;
  //   let broadcasts;
  //
  //   beforeEach(() => {
  //     routes     = [{
  //       path      : 'type1',
  //       collection: 'collection1',
  //       object    : 'object1',
  //       method    : 'method1'
  //     }, {
  //       path      : 'type2',
  //       collection: 'collection2',
  //       object    : 'object2',
  //       method    : 'method2'
  //     }];
  //     broadcasts = [{
  //       options: { api: 'type1', data: { object1: 'object1' } }
  //     }, {
  //       options: { api: 'type2', data: { object2: 'object2' } }
  //     }, {
  //       options: { api: 'type1', data: { object1: 'object1' } }
  //     }];
  //
  //     instance.routes = routes;
  //   });
  //
  //   it('compare result', () => {
  //     const result = (instance as any).squashQueue(broadcasts);
  //
  //     expect(result).to.be.deep.equal([{
  //       options: {
  //         api      : routes[0]['path'],
  //         data     : {
  //           [routes[0]['collection']]: [
  //             broadcasts[0].options.data.object1,
  //             broadcasts[2].options.data.object1
  //           ]
  //         },
  //         immediate: false,
  //         method   : routes[0]['method']
  //       }
  //     }, {
  //       options: {
  //         api      : routes[1]['path'],
  //         data     : {
  //           [routes[1]['collection']]: [
  //             broadcasts[1].options.data.object2
  //           ]
  //         },
  //         immediate: false,
  //         method   : routes[1]['method']
  //       }
  //     }]);
  //   });
  // });
  //
  // describe('releaseQueue', () => {
  //   let queue;
  //   let broadcasts;
  //   let peers;
  //
  //   let filterQueueStub;
  //   let squashQueueStub;
  //   let getPeersStub;
  //   let broadcastStub;
  //
  //   beforeEach(() => {
  //     queue      = [{}, {}];
  //     broadcasts = [{
  //       params : { name: 'params1' },
  //       options: 'options1'
  //     }, {
  //       params : { name: 'params2' },
  //       options: 'options2'
  //     }];
  //     peers      = [{ some: 'some1' }, { some: 'some2' }];
  //
  //     instance.queue = queue;
  //
  //     filterQueueStub = sandbox.stub(instance as any, 'filterQueue');
  //     squashQueueStub = sandbox.stub(instance as any, 'squashQueue');
  //     getPeersStub    = sandbox.stub(instance as any, 'getPeers');
  //     broadcastStub   = sandbox.stub(instance as any, 'broadcast');
  //
  //     squashQueueStub.returns(broadcasts);
  //     getPeersStub.returns(peers);
  //     broadcastStub.resolves();
  //   });
  //
  //   it('library logger debug is called first time', async () => {
  //     await (instance as any).releaseQueue();
  //
  //     expect(library.logger.debug.callCount).to.be.at.least(1);
  //     expect(library.logger.debug.firstCall.args.length).to.be.equal(1);
  //     expect(library.logger.debug.firstCall.args[0]).to.be.equal('Releasing enqueued broadcasts');
  //   });
  //
  //   it('if queue.length == 0 filterQueue is not called', async () => {
  //     instance.queue = [];
  //
  //     const result = await (instance as any).releaseQueue();
  //
  //     expect(library.logger.debug.callCount).to.be.equal(2);
  //     expect(library.logger.debug.secondCall.args.length).to.be.equal(1);
  //     expect(library.logger.debug.secondCall.args[0]).to.be.equal('Queue empty');
  //
  //     expect(result).to.be.undefined;
  //
  //     expect(filterQueueStub.called).to.be.false;
  //   });
  //
  //   it('filterQueue is called', async () => {
  //     await (instance as any).releaseQueue();
  //
  //     expect(filterQueueStub.calledOnce).to.be.true;
  //     expect(filterQueueStub.firstCall.args.length).to.be.equal(0);
  //   });
  //
  //   it('squashQueue is called', async () => {
  //     await (instance as any).releaseQueue();
  //
  //     expect(squashQueueStub.calledOnce).to.be.true;
  //     expect(squashQueueStub.firstCall.args.length).to.be.equal(1);
  //     expect(squashQueueStub.firstCall.args[0]).to.be.deep.equal([{}, {}]);
  //   });
  //
  //   it('getPeers is called', async () => {
  //     await (instance as any).releaseQueue();
  //
  //     expect(getPeersStub.calledOnce).to.be.true;
  //     expect(getPeersStub.firstCall.args.length).to.be.equal(1);
  //     expect(getPeersStub.firstCall.args[0]).to.be.deep.equal({});
  //   });
  //
  //   it('broadcast is called', async () => {
  //     await (instance as any).releaseQueue();
  //
  //     expect(broadcastStub.callCount).to.be.equal(broadcasts.length);
  //     broadcasts.forEach((broadcast, index) => {
  //       expect(broadcastStub.getCall(index).args.length).to.be.equal(2);
  //       expect(broadcastStub.getCall(index).args[0]).to.be.deep.equal({
  //         peers: peers,
  //         name : broadcast.params.name
  //       });
  //       expect(broadcastStub.getCall(index).args[1]).to.be.equal(broadcast.options);
  //     });
  //   });
  //
  //   it('fail; logger.debug is called', async () => {
  //     const error = new Error('error');
  //     broadcastStub.rejects(error);
  //
  //     await (instance as any).releaseQueue();
  //
  //     expect(library.logger.debug.calledTwice).to.be.true;
  //     expect(library.logger.debug.secondCall.args.length).to.be.equal(2);
  //     expect(library.logger.debug.secondCall.args[0]).to.be.equal('Failed to release broadcast queue');
  //     expect(library.logger.debug.secondCall.args[1]).to.be.equal(error);
  //   });
  //
  //   it('success; logger.debug is called', async () => {
  //     await (instance as any).releaseQueue();
  //
  //     expect(library.logger.debug.calledTwice).to.be.true;
  //     expect(library.logger.debug.secondCall.args.length).to.be.equal(1);
  //     expect(library.logger.debug.secondCall.args[0]).to.be.equal(`Broadcasts released ${broadcasts.length}`);
  //   });
  // });
});