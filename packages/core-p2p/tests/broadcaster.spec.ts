import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BroadcasterLogic } from '../src/broadcaster';
import { IJobsQueue } from '../../core-interfaces/src/helpers';
import { PeersLogic } from '../src/peersLogic';
import { TransactionLogic, TransactionsModule } from '../../core-transactions/src';
import { PeersModule } from '../src/peersModule';
import { createContainer } from '../../core-launchpad/tests/utils/createContainer';
import { Symbols } from '../../core-interfaces/src';
import { P2PConstantsType, p2pSymbols } from '../src/helpers';
import { ConstantsType } from '../../core-types/src';
import { BroadcastTaskOptions } from '../../core-interfaces/src/logic';
import { LoggerStub } from '../../core-utils/tests/stubs';
import {
  createRandomTransaction,
  createRandomTransactions,
  toBufferedTransaction
} from '../../core-transactions/tests/utils/txCrafter';
import { StubbedRequest, StubbedRequest2 } from './utils/StubbedRequest';

// tslint:disable no-unused-expression
describe('logic/broadcaster', () => {
  let sandbox: SinonSandbox;
  let instance: BroadcasterLogic;
  let jobsQueue: IJobsQueue;
  let loggerStub: LoggerStub;
  let constants: ConstantsType;
  let peersLogic: PeersLogic;
  let transactionLogic: TransactionLogic;
  let fakeAppState: { set: SinonStub };
  let peersModule: PeersModule;
  let transactionsModule: TransactionsModule;
  let container: Container;

  before(async () => {
    container    = await createContainer(['core-p2p', 'core-helpers', 'core-blocks', 'core-transactions', 'core', 'core-accounts']);
  });
  beforeEach(async () => {
    sandbox      = sinon.createSandbox({
      // useFakeTimers: true,
    });

    fakeAppState = { set: sandbox.stub() };
    loggerStub   = new LoggerStub();
    container.rebind(Symbols.logic.appState).toConstantValue(fakeAppState);
    container.rebind(Symbols.helpers.logger).toConstantValue(loggerStub);
    await container.get<BroadcasterLogic>(p2pSymbols.logic.broadcaster).cleanup();
    container.rebind(p2pSymbols.logic.broadcaster).to(BroadcasterLogic).inSingletonScope();

    constants = container.get(Symbols.generic.constants);
    jobsQueue = container.get(Symbols.helpers.jobsQueue);
    jobsQueue.unregister('broadcasterNextRelease');
    peersLogic         = container.get(Symbols.logic.peers);
    transactionLogic   = container.get(Symbols.logic.transaction);
    peersModule        = container.get(Symbols.modules.peers);
    transactionsModule = container.get(Symbols.modules.transactions);

    // Dependency injection
    instance = container.get(p2pSymbols.logic.broadcaster);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('afterConstruct', () => {

    it('should call JobsQueue.register', () => {
      const p2pConstants  = container.get<P2PConstantsType>(p2pSymbols.constants);
      const jobsQueuestub = sandbox.stub(jobsQueue, 'register');
      (instance as any).afterConstruct();
      expect(jobsQueuestub.calledOnce).to.be.true;
      expect(jobsQueuestub.firstCall.args.length).to.be.equal(3);
      expect(jobsQueuestub.firstCall.args[0]).to.be.equal('broadcasterNextRelease');
      expect(jobsQueuestub.firstCall.args[1]).to.be.a('function');
      expect(jobsQueuestub.firstCall.args[2]).to.be.equal(p2pConstants.broadcastInterval);
    });

    it('should call to releaseQueue()', async () => {
      const jobsQueuestub      = sandbox.stub(jobsQueue, 'register').callsFake((name: string, job: () => Promise<any>) => {
        return job();
      });
      const releaseQueueStub   = sandbox.stub().resolves(true);
      // tslint:disable-next-line no-string-literal
      instance['releaseQueue'] = releaseQueueStub;
      await instance.afterConstruct();
      expect(jobsQueuestub.called).to.be.true;
      expect(releaseQueueStub.calledOnce).to.be.true;
    });

    it('if releaseQueue() rejects should call to catch()', async () => {
      const jobsQueuestub      = sandbox.stub(jobsQueue, 'register').callsFake((name: string, job: () => Promise<any>) => {
        return job();
      });
      const releaseQueueStub   = sandbox.stub().rejects(new Error('Booo!'));
      // tslint:disable-next-line no-string-literal
      instance['releaseQueue'] = releaseQueueStub;
      await instance.afterConstruct();
      expect(jobsQueuestub.called).to.be.true;
      expect(releaseQueueStub.calledOnce).to.be.true;
    });
  });

  describe('getPeers', () => {
    let limit: number;
    let broadhash: string;
    let peers: any[];
    let consensus: number;
    let peersModuleListStub: SinonStub;

    beforeEach(() => {
      limit               = 100;
      broadhash           = 'asd';
      peers               = [];
      consensus           = 123;
      peersModuleListStub = sandbox.stub(peersModule, 'list').resolves({ peers, consensus });
    });

    it('should call peersModule.list', async () => {
      await instance.getPeers({ limit, broadhash });
      expect(peersModuleListStub.calledOnce).to.be.true;
      expect(peersModuleListStub.firstCall.args.length).to.be.equal(1);
      expect(peersModuleListStub.firstCall.args[0]).to.be.deep.equal({ limit, broadhash });
    });

    it('should call peersModule.list also with default params', async () => {
      await instance.getPeers({});
      expect(peersModuleListStub.calledOnce).to.be.true;
      expect(peersModuleListStub.firstCall.args.length).to.be.equal(1);
      expect(peersModuleListStub.firstCall.args[0]).to.be.deep.equal({
        broadhash: null,
        limit    : constants.maxPeers,
      });
    });

    it('should set consensus if limit is constants.maxPeers', async () => {
      await instance.getPeers({ limit: constants.maxPeers });
      expect(fakeAppState.set.calledOnce).to.be.true;
      expect(fakeAppState.set.firstCall.args[0]).to.be.equal('node.consensus');
      expect(fakeAppState.set.firstCall.args[1]).to.be.equal(consensus);
    });

    it('should set consensus in 100 if limit is constants.maxPeers and config.forging.force is true', async () => {
      await instance.getPeers({ limit: constants.maxPeers });
      expect(fakeAppState.set.calledOnce).to.be.true;
      expect(fakeAppState.set.firstCall.args[0]).to.be.equal('node.consensus');
      expect(fakeAppState.set.firstCall.args[1]).to.be.equal(123);
    });

    it('should return the right value', async () => {
      const result = await instance.getPeers({ limit: constants.maxPeers });
      expect(result).to.be.equal(peers);
    });
  });

  describe('enqueue', () => {
    let params: any;
    let options: BroadcastTaskOptions;
    // tslint:disable-next-line

    beforeEach(() => {
      params  = {};
      options = {
        requestHandler: new StubbedRequest(),
      };
    });

    it('should call queue.push called; immediate is set', () => {
      const spy = sandbox.spy(instance.queue, 'push');

      instance.enqueue(params, options);

      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.args.length).to.be.equal(1);
      expect(spy.firstCall.args[0]).to.be.deep.equal({
        options: options,
        params : params,
      });
    });

    it('build the queue as expected', () => {
      instance.enqueue(params, options);

      expect(instance.queue).to.be.deep.equal([{
        options: options,
        params : params,
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
    let createPeerStub: SinonStub;

    beforeEach(() => {
      params       = {
        broadhash: 'broadhash',
        limit    : 100,
        peers    : null,
      };
      options      = { requestHandler: new StubbedRequest() };
      peers        = [{}, {}];
      createdPeers = [
        { string: 'first', makeRequest: sandbox.stub().resolves(), },
        { string: 'second', makeRequest: sandbox.stub().resolves(), },
      ];

      getPeersStub = sandbox.stub(instance, 'getPeers');
      getPeersStub.resolves(peers);
      createPeerStub = sandbox.stub(peersLogic, 'create');
      peers.forEach((peer, index) => {
        createPeerStub.onCall(index).returns(createdPeers[index]);
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
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Begin broadcast');

      createdPeers.forEach((peer, index) => {
        expect(loggerStub.stubs.debug.getCall(index + 1).args.length).to.be.equal(2);
        expect(loggerStub.stubs.debug.getCall(index + 1).args[0]).to.be.equal(`Failed to broadcast to peer: ${peer.string}`);
        expect(loggerStub.stubs.debug.getCall(index + 1).args[1]).to.be.equal(error);
      });

      expect(loggerStub.stubs.debug.getCall(peers.length + 1).args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.getCall(peers.length + 1).args[0]).to.be.equal('End broadcast');
    });

    it('should call peersLogic.create for each peer', async () => {
      await instance.broadcast(params, options);
      expect(createPeerStub.callCount).to.be.equal(peers.length);
      peers.forEach((peer, index) => {
        expect(createPeerStub.getCall(index).args.length).to.be.equal(1);
        expect(createPeerStub.getCall(index).args[0]).to.be.equal(peer);
      });
    });

    it('should call peer.makeRequest per each created peer instance', async () => {
      createPeerStub.resetBehavior();
      const stubs              = [];
      let makeRequestCallCount = 0;
      createPeerStub.callsFake((p) => {
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
        expect(stubs[index].makeRequest.firstCall.args[0]).to.be.deep.equal(options.requestHandler);
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

    it('should return data from p2pConstants', () => {
      const p2pConstants = container.get<P2PConstantsType>(p2pSymbols.constants);
      const result       = instance.maxRelays();
      expect(result).eq(p2pConstants.relayLimit);

      const oldy = p2pConstants.relayLimit;
      p2pConstants.relayLimit = 15882;
      expect(instance.maxRelays()).eq(15882);
      p2pConstants.relayLimit = oldy;
    });
  });

  describe('filterQueue', () => {
    let task: any;
    let length: number;
    let filterStub: SinonStub;

    beforeEach(() => {
      task = {
        options: {
          immediate     : true,
          requestHandler: new StubbedRequest(),
        },
      };
      instance.queue.push(task);
      length = instance.queue.length;

      filterStub = sandbox.stub();
      filterStub.resolves(false);
      task.options.requestHandler.stubs.getOrigOptions.returns({
        data            : { transaction: 'transaction' },
        isRequestExpired: filterStub
      });
    });

    it('should call logger.debug', async () => {
      await (instance as any).filterQueue();
      expect(loggerStub.stubs.debug.calledTwice).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal(`Broadcast before filtering: ${length}`);
      expect(loggerStub.stubs.debug.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.secondCall.args[0]).to.be.equal(`Broadcasts after filtering: ${instance.queue.length}`);
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
      expect(instance.queue).to.be.deep.equal([task]);
    });

    it('should behave correctly when immediate false; data false', async () => {
      task.options.immediate = false;
      task.options.data      = false;
      await (instance as any).filterQueue();
      expect(instance.queue).to.be.deep.equal([task]);
    });
  });

  describe('squashQueue', () => {
    let broadcasts;
    let pt0: StubbedRequest2;
    let pt1: StubbedRequest2;
    let ps0: StubbedRequest;
    beforeEach(() => {
      pt0         = new StubbedRequest2();
      pt0.options = {
        data: {
          transaction: toBufferedTransaction(createRandomTransaction()),
        },
      };

      pt1         = new StubbedRequest2();
      pt1.options = {
        data:
          {
            transactions: createRandomTransactions(3)
              .map((tx) => toBufferedTransaction(tx))
              .concat(pt0.options.data.transaction),
          },
      };

      ps0        = new StubbedRequest();
      broadcasts = [{
        options: { requestHandler: pt0 },
      }, {
        options: { requestHandler: pt1 },
      }, {
        options: { requestHandler: ps0 },
      }];
    });

    it('should return the expected result', () => {
      const txResults = [
        pt0.options.data.transaction,
        ... pt1.options.data.transactions.slice(0, pt1.options.data.transactions.length - 1),
      ];
      const retObj    = {
        immediate     : false,
        requestHandler: {
          method          : 'POST',
          options         : {
            data: {
              transaction : null,
              transactions: txResults,
            },
          },
          supportsProtoBuf: true,
        },
      };
      const results   = (instance as any).squashQueue(broadcasts);
      expect(results[0].options).to.be.deep.eq(retObj);
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
        options: 'options1',
        params : { name: 'params1' },
      }, {
        options: 'options2',
        params : { name: 'params2' },
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
