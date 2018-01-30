import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { PeersLogicStub } from '../../stubs';
import JobsQueueStub from '../../stubs/helpers/jobsQueueStub';
import LoggerStub from '../../stubs/helpers/LoggerStub';
import TransactionLogicStub from '../../stubs/logic/TransactionLogicStub';
import { constants } from './../../../src/helpers/';
import { BroadcasterLogic, BroadcastTaskOptions } from './../../../src/logic/broadcaster';

describe('logic/broadcaster', () => {
  let sandbox: SinonSandbox;
  let fakeConfig: any;
  let instance: BroadcasterLogic;
  let jobsQueueStub: JobsQueueStub;
  let loggerStub: LoggerStub;
  let peersLogicStub: PeersLogicStub;
  let transactionLogicStub: TransactionLogicStub;
  let fakeAppState: {set: SinonStub};

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

    instance = new BroadcasterLogic();

    (instance as any).config = fakeConfig;
    (instance as any).constants = constants;
    (instance as any).jobsQueue = jobsQueueStub;
    (instance as any).logger = loggerStub;
    (instance as any).peersLogic = peersLogicStub;
    (instance as any).transactionLogic = transactionLogicStub;
    (instance as any).appState = fakeAppState;
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.restore();
  });

  describe('constructor', () => {
    it('check instance', () => {
      expect(instance).to.be.instanceof(BroadcasterLogic);
    });

    it('check library', () => {
      expect(instance.library).to.be.equal(library);
    });

    it('check config', () => {
      expect(instance.config).to.have.property('broadcasts');
      expect(instance.config).to.have.property('peerLimit');

      expect(instance.config.broadcasts).to.be.equal(library.config.broadcasts);
      expect(instance.config.peerLimit).to.be.equal(constants.maxPeers);
    });

    it('check consensus', () => {
      expect(instance.consensus).to.be.equal(100);
    });

    it('JobsQueue register called', () => {
      expect(JobsQueueStub.calledOnce).to.be.true;
      expect(JobsQueueStub.firstCall.args.length).to.be.equal(3);
      expect(JobsQueueStub.firstCall.args[0]).to.be.equal('broadcasterNextRelease');
      expect(JobsQueueStub.firstCall.args[1]).to.be.a('function');
      expect(JobsQueueStub.firstCall.args[2]).to.be.equal(library.config.broadcasts.broadcastInterval);
    });
  });

  describe('bind', () => {
    it('check peers', () => {
      expect(instance.modules).to.have.property('peers');
      expect(instance.modules.peers).to.be.equal(modules.peers);
    });

    it('check transport', () => {
      expect(instance.modules).to.have.property('transport');
      expect(instance.modules.transport).to.be.equal(modules.transport);
    });

    it('check transactions', () => {
      expect(instance.modules).to.have.property('transactions');
      expect(instance.modules.transactions).to.be.equal(modules.transactions);
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

      modules.peers.list.resolves({ peers, consensus });
    });

    it('modules.peers.list called', async () => {
      const result: Array<any> = await instance.getPeers({ limit, broadhash });

      expect(modules.peers.list.calledOnce).to.be.true;
      expect(modules.peers.list.firstCall.args.length).to.be.equal(1);
      expect(modules.peers.list.firstCall.args[0]).to.be.deep.equal({
        limit    : limit,
        broadhash: broadhash
      });
    });

    it('check default params', async () => {
      const result: Array<any> = await instance.getPeers({});

      expect(modules.peers.list.calledOnce).to.be.true;
      expect(modules.peers.list.firstCall.args.length).to.be.equal(1);
      expect(modules.peers.list.firstCall.args[0]).to.be.deep.equal({
        limit    : instance.config.peerLimit,
        broadhash: null
      });
    });

    it('check consensus', async () => {
      const result: Array<any> = await instance.getPeers({ limit: constants.maxPeers });

      expect(instance.consensus).to.be.equal(consensus);
    });

    it('check result', async () => {
      const result: Array<any> = await instance.getPeers({ limit: constants.maxPeers });

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
        method   : 'method'
      };
    });

    it('queue push called; immediate is set', () => {
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
          method   : 'method'
        }
      });
    });

    it('compare queue', () => {
      instance.enqueue(params, options);

      expect(instance.queue).to.be.deep.equal([{
        params : {},
        options: {
          immediate: false,
          data     : {},
          api      : 'api',
          method   : 'method'
        }
      }]);
    });

    it('compare result', () => {
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
        peers    : null
      };
      options      = {};
      peers        = [{}, {}];
      createdPeers = [{ string: 'first' }, { string: 'second' }];

      getPeersStub = sandbox.stub(instance, 'getPeers');
      getPeersStub.resolves(peers);

      peers.forEach((peer, index) => {
        library.logic.peers.create.onCall(index).returns(createdPeers[index]);
      });
      modules.transport.getFromPeer.resolves();
    });

    it('getPeers is called', async () => {
      await instance.broadcast(params, options);

      expect(getPeersStub.calledOnce).to.be.true;
      expect(getPeersStub.firstCall.args.length).to.be.equal(1);
      expect(getPeersStub.firstCall.args[0]).to.be.equal(params);
    });

    it('getPeers is not called', async () => {
      params.peers = peers;

      await instance.broadcast(params, options);

      expect(getPeersStub.called).to.be.false;
    });

    it('logger is called', async () => {
      const error: Error = new Error('error');
      modules.transport.getFromPeer.rejects(error);

      await instance.broadcast(params, options);

      expect(library.logger.debug.callCount).to.be.equal(peers.length + 2);

      expect(library.logger.debug.firstCall.args.length).to.be.equal(2);
      expect(library.logger.debug.firstCall.args[0]).to.be.equal('Begin broadcast');
      expect(library.logger.debug.firstCall.args[1]).to.be.equal(options);

      createdPeers.forEach((peer, index) => {
        expect(library.logger.debug.getCall(index + 1).args.length).to.be.equal(2);
        expect(library.logger.debug.getCall(index + 1).args[0]).to.be.equal(`Failed to broadcast to peer: ${peer.string}`);
        expect(library.logger.debug.getCall(index + 1).args[1]).to.be.equal(error);
      });

      expect(library.logger.debug.getCall(peers.length + 1).args.length).to.be.equal(1);
      expect(library.logger.debug.getCall(peers.length + 1).args[0]).to.be.equal('End broadcast');
    });

    it('library.logic.peers.create is called', async () => {
      await instance.broadcast(params, options);

      expect(library.logic.peers.create.callCount).to.be.equal(peers.length);
      peers.forEach((peer, index) => {
        expect(library.logic.peers.create.getCall(index).args.length).to.be.equal(1);
        expect(library.logic.peers.create.getCall(index).args[0]).to.be.equal(peer);
      });
    });

    it('modules.transport.getFromPeer is called', async () => {
      await instance.broadcast(params, options);

      expect(modules.transport.getFromPeer.callCount).to.be.equal(peers.length);
      peers.forEach((peer, index) => {
        expect(modules.transport.getFromPeer.getCall(index).args.length).to.be.equal(2);
        expect(modules.transport.getFromPeer.getCall(index).args[0]).to.be.equal(createdPeers[index]);
        expect(modules.transport.getFromPeer.getCall(index).args[1]).to.be.equal(options);
      });
    });

    it('check result', async () => {
      const result = await instance.broadcast(params, options);

      expect(result).to.be.deep.equal({
        peer: peers
      });
    });
  });

  describe('maxRelays', () => {
    let obj: any;

    beforeEach(() => {
      obj = {
        relays: library.config.broadcasts.relayLimit - 1
      };
    });

    it('no relays', () => {
      delete obj.relays;

      const result = instance.maxRelays(obj);

      expect(obj).to.have.property('relays');
      expect(obj.relays).to.be.equal(1);

      expect(result).to.be.false;
    });

    it('relays is greater', () => {
      obj.relays = library.config.broadcasts.relayLimit;

      const result = instance.maxRelays(obj);

      expect(library.logger.debug.calledOnce).to.be.true;
      expect(library.logger.debug.firstCall.args.length).to.be.equal(2);
      expect(library.logger.debug.firstCall.args[0]).to.be.equal('Broadcast relays exhausted');
      expect(library.logger.debug.firstCall.args[1]).to.be.equal(obj);

      expect(result).to.be.true;
    });

    it('relays is less', () => {
      const result = instance.maxRelays(obj);

      expect(obj.relays).to.be.equal(library.config.broadcasts.relayLimit);

      expect(result).to.be.false;
    });
  });

  describe('filterQueue', () => {
    let task: any;
    let length: any;
    let filterStub: any;

    beforeEach(() => {
      task = {
        options: {
          immediate: true,
          data     : {
            transaction: 'transaction'
          }
        }
      };

      instance.queue.push(task);
      length = instance.queue.length;

      filterStub = sandbox.stub((instance as any), 'filterTransaction');
      filterStub.resolves(true);
    });

    it('logger.debug is called', async () => {
      await (instance as any).filterQueue();

      expect(library.logger.debug.calledTwice).to.be.true;
      expect(library.logger.debug.firstCall.args.length).to.be.equal(1);
      expect(library.logger.debug.firstCall.args[0]).to.be.equal(`Broadcast before filtering: ${length}`);
      expect(library.logger.debug.secondCall.args.length).to.be.equal(1);
      expect(library.logger.debug.secondCall.args[0]).to.be.equal(`Broadcasts after filtering: ${instance.queue.length}`);
    });

    it('immediate true', async () => {
      await (instance as any).filterQueue();

      expect(instance.queue).to.be.deep.equal([task]);
    });

    it('immediate false; data true; filter true', async () => {
      task.options.immediate = false;

      await (instance as any).filterQueue();

      expect(instance.queue).to.be.deep.equal([task]);
    });

    it('immediate false; data true; filter false', async () => {
      task.options.immediate = false;
      filterStub.resolves(false);

      await (instance as any).filterQueue();

      expect(instance.queue).to.be.deep.equal([]);
    });

    it('immediate false; data false', async () => {
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

    it('tx undefined; false is returned', async () => {
      const result = await (instance as any).filterTransaction();

      expect(modules.transactions.transactionInPool.called).to.be.false;
      expect(result).to.be.false;
    });

    it('tx is in pool; true is returned', async () => {
      modules.transactions.transactionInPool.returns(true);
      const result = await (instance as any).filterTransaction(tx);

      expect(modules.transactions.transactionInPool.calledOnce).to.be.true;
      expect(modules.transactions.transactionInPool.firstCall.args.length).to.be.equal(1);
      expect(modules.transactions.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);

      expect(library.logic.transactions.assertNonConfirmed.called).to.be.false;

      expect(result).to.be.true;
    });

    it('tx is not in pool; assert doesn\'t throw error', async () => {
      modules.transactions.transactionInPool.returns(false);

      const result = await (instance as any).filterTransaction(tx);

      expect(modules.transactions.transactionInPool.calledOnce).to.be.true;
      expect(modules.transactions.transactionInPool.firstCall.args.length).to.be.equal(1);
      expect(modules.transactions.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);

      expect(library.logic.transactions.assertNonConfirmed.calledOnce).to.be.true;
      expect(library.logic.transactions.assertNonConfirmed.firstCall.args.length).to.be.equal(1);
      expect(library.logic.transactions.assertNonConfirmed.firstCall.args[0]).to.be.equal(tx);

      expect(result).to.be.true;
    });

    it('tx is not in pool; assert throws error', async () => {
      modules.transactions.transactionInPool.returns(false);
      library.logic.transactions.assertNonConfirmed.throws(new Error());

      const result = await (instance as any).filterTransaction(tx);

      expect(modules.transactions.transactionInPool.calledOnce).to.be.true;
      expect(modules.transactions.transactionInPool.firstCall.args.length).to.be.equal(1);
      expect(modules.transactions.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);

      expect(library.logic.transactions.assertNonConfirmed.calledOnce).to.be.true;
      expect(library.logic.transactions.assertNonConfirmed.firstCall.args.length).to.be.equal(1);
      expect(library.logic.transactions.assertNonConfirmed.firstCall.args[0]).to.be.equal(tx);

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
        method    : 'method1'
      }, {
        path      : 'type2',
        collection: 'collection2',
        object    : 'object2',
        method    : 'method2'
      }];
      broadcasts = [{
        options: { api: 'type1', data: { object1: 'object1' } }
      }, {
        options: { api: 'type2', data: { object2: 'object2' } }
      }, {
        options: { api: 'type1', data: { object1: 'object1' } }
      }];

      instance.routes = routes;
    });

    it('compare result', () => {
      const result = (instance as any).squashQueue(broadcasts);

      expect(result).to.be.deep.equal([{
        options: {
          api      : routes[0]['path'],
          data     : {
            [routes[0]['collection']]: [
              broadcasts[0].options.data.object1,
              broadcasts[2].options.data.object1
            ]
          },
          immediate: false,
          method   : routes[0]['method']
        }
      }, {
        options: {
          api      : routes[1]['path'],
          data     : {
            [routes[1]['collection']]: [
              broadcasts[1].options.data.object2
            ]
          },
          immediate: false,
          method   : routes[1]['method']
        }
      }]);
    });
  });

  describe('releaseQueue', () => {
    let queue;
    let broadcasts;
    let peers;

    let filterQueueStub;
    let squashQueueStub;
    let getPeersStub;
    let broadcastStub;

    beforeEach(() => {
      queue      = [{}, {}];
      broadcasts = [{
        params : { name: 'params1' },
        options: 'options1'
      }, {
        params : { name: 'params2' },
        options: 'options2'
      }];
      peers      = [{ some: 'some1' }, { some: 'some2' }];

      instance.queue = queue;

      filterQueueStub = sandbox.stub(instance as any, 'filterQueue');
      squashQueueStub = sandbox.stub(instance as any, 'squashQueue');
      getPeersStub    = sandbox.stub(instance as any, 'getPeers');
      broadcastStub   = sandbox.stub(instance as any, 'broadcast');

      squashQueueStub.returns(broadcasts);
      getPeersStub.returns(peers);
      broadcastStub.resolves();
    });

    it('library logger debug is called first time', async () => {
      await (instance as any).releaseQueue();

      expect(library.logger.debug.callCount).to.be.at.least(1);
      expect(library.logger.debug.firstCall.args.length).to.be.equal(1);
      expect(library.logger.debug.firstCall.args[0]).to.be.equal('Releasing enqueued broadcasts');
    });

    it('if queue.length == 0 filterQueue is not called', async () => {
      instance.queue = [];

      const result = await (instance as any).releaseQueue();

      expect(library.logger.debug.callCount).to.be.equal(2);
      expect(library.logger.debug.secondCall.args.length).to.be.equal(1);
      expect(library.logger.debug.secondCall.args[0]).to.be.equal('Queue empty');

      expect(result).to.be.undefined;

      expect(filterQueueStub.called).to.be.false;
    });

    it('filterQueue is called', async () => {
      await (instance as any).releaseQueue();

      expect(filterQueueStub.calledOnce).to.be.true;
      expect(filterQueueStub.firstCall.args.length).to.be.equal(0);
    });

    it('squashQueue is called', async () => {
      await (instance as any).releaseQueue();

      expect(squashQueueStub.calledOnce).to.be.true;
      expect(squashQueueStub.firstCall.args.length).to.be.equal(1);
      expect(squashQueueStub.firstCall.args[0]).to.be.deep.equal([{}, {}]);
    });

    it('getPeers is called', async () => {
      await (instance as any).releaseQueue();

      expect(getPeersStub.calledOnce).to.be.true;
      expect(getPeersStub.firstCall.args.length).to.be.equal(1);
      expect(getPeersStub.firstCall.args[0]).to.be.deep.equal({});
    });

    it('broadcast is called', async () => {
      await (instance as any).releaseQueue();

      expect(broadcastStub.callCount).to.be.equal(broadcasts.length);
      broadcasts.forEach((broadcast, index) => {
        expect(broadcastStub.getCall(index).args.length).to.be.equal(2);
        expect(broadcastStub.getCall(index).args[0]).to.be.deep.equal({
          peers: peers,
          name : broadcast.params.name
        });
        expect(broadcastStub.getCall(index).args[1]).to.be.equal(broadcast.options);
      });
    });

    it('fail; logger.debug is called', async () => {
      const error = new Error('error');
      broadcastStub.rejects(error);

      await (instance as any).releaseQueue();

      expect(library.logger.debug.calledTwice).to.be.true;
      expect(library.logger.debug.secondCall.args.length).to.be.equal(2);
      expect(library.logger.debug.secondCall.args[0]).to.be.equal('Failed to release broadcast queue');
      expect(library.logger.debug.secondCall.args[1]).to.be.equal(error);
    });

    it('success; logger.debug is called', async () => {
      await (instance as any).releaseQueue();

      expect(library.logger.debug.calledTwice).to.be.true;
      expect(library.logger.debug.secondCall.args.length).to.be.equal(1);
      expect(library.logger.debug.secondCall.args[0]).to.be.equal(`Broadcasts released ${broadcasts.length}`);
    });
  });
});