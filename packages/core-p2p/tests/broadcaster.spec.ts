import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { Symbols } from '../../../src/ioc/symbols';
import { BroadcasterLogic, BroadcastTaskOptions } from '../../../src/logic';
import {
  APIRequestStub, JobsQueueStub, LoggerStub, PeersLogicStub, PeersModuleStub,
  TransactionLogicStub, TransactionsModuleStub
} from '../../stubs';
import { createContainer } from '../../utils/containerCreator';
import { constants } from './../../../src/helpers/';
import { PostTransactionsRequest } from '../../../src/apis/requests/PostTransactionsRequest';
import { PostSignaturesRequest } from '../../../src/apis/requests/PostSignaturesRequest';

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
  let container: Container;

  beforeEach(() => {
    sandbox                = sinon.createSandbox({
      useFakeTimers: true,
    });
    container              = createContainer();
    fakeConfig             = {
      broadcasts: {
        broadcastInterval: 1,
        broadcastLimit   : 2,
        parallelLimit    : 3,
        relayLimit       : 5,
        releaseLimit     : 4,
      },
      forging   : {
        force: false,
      },
    };
    jobsQueueStub          = container.get(Symbols.helpers.jobsQueue);
    fakeAppState           = { set: sandbox.stub() };
    loggerStub             = container.get(Symbols.helpers.logger);
    peersLogicStub         = container.get(Symbols.logic.peers);
    transactionLogicStub   = container.get(Symbols.logic.transaction);
    peersModuleStub        = container.get(Symbols.modules.peers);
    transactionsModuleStub = container.get(Symbols.modules.transactions);

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
      jobsQueueStub.stubs.register.callsFake((name: string, job: () => Promise<any>) => {
        return job();
      });
      const releaseQueueStub   = sandbox.stub().resolves(true);
      // tslint:disable-next-line no-string-literal
      instance['releaseQueue'] = releaseQueueStub;
      await instance.afterConstruct();
      expect(jobsQueueStub.stubs.register.called).to.be.true;
      expect(releaseQueueStub.calledOnce).to.be.true;
    });

    it('if releaseQueue() rejects should call to catch()', async () => {
      jobsQueueStub.stubs.register.callsFake((name: string, job: () => Promise<any>) => {
        return job();
      });
      const releaseQueueStub   = sandbox.stub().rejects(new Error('Booo!'));
      // tslint:disable-next-line no-string-literal
      instance['releaseQueue'] = releaseQueueStub;
      await instance.afterConstruct();
      expect(jobsQueueStub.stubs.register.called).to.be.true;
      expect(releaseQueueStub.calledOnce).to.be.true;
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
        requestHandler: new APIRequestStub(),
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

    beforeEach(() => {
      params       = {
        broadhash: 'broadhash',
        limit    : 100,
        peers    : null,
      };
      options      = { requestHandler: new APIRequestStub() };
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
        expect(loggerStub.stubs.debug.getCall(index + 1).args[0]).to.be.equal(`Failed to broadcast to peer: ${peer.string}`);
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
          immediate     : true,
          requestHandler: new APIRequestStub(),
        },
      };
      task.options.requestHandler.stubs.getOrigOptions.returns({ data: { transaction: 'transaction' } });

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
      transactionsModuleStub.stubs.filterConfirmedIds.resolves([]);
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
      expect(transactionsModuleStub.stubs.filterConfirmedIds.called).to.be.false;
      expect(result).to.be.true;
    });

    it('should behave correctly when tx is not in pool not in db already confirmed', async () => {
      transactionsModuleStub.stubs.transactionInPool.returns(false);
      transactionsModuleStub.stubs.filterConfirmedIds.resolves([]);
      const result = await (instance as any).filterTransaction(tx);
      expect(transactionsModuleStub.stubs.transactionInPool.calledOnce).to.be.true;
      expect(transactionsModuleStub.stubs.transactionInPool.firstCall.args.length).to.be.equal(1);
      expect(transactionsModuleStub.stubs.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);
      expect(transactionsModuleStub.stubs.filterConfirmedIds.calledOnce).to.be.true;
      expect(transactionsModuleStub.stubs.filterConfirmedIds.firstCall.args.length).to.be.equal(1);
      expect(transactionsModuleStub.stubs.filterConfirmedIds.firstCall.args[0]).to.be.deep.equal([tx.id]);
      expect(result).to.be.true;
    });

    it('should behave correctly when tx is not in pool; but tx is in db confirmed', async () => {
      transactionsModuleStub.stubs.transactionInPool.returns(false);
      transactionsModuleStub.stubs.filterConfirmedIds.resolves(['ahah', tx.id, 'eheh']);
      const result = await (instance as any).filterTransaction(tx);
      expect(transactionsModuleStub.stubs.transactionInPool.calledOnce).to.be.true;
      expect(transactionsModuleStub.stubs.transactionInPool.firstCall.args.length).to.be.equal(1);
      expect(transactionsModuleStub.stubs.transactionInPool.firstCall.args[0]).to.be.equal(tx.id);
      expect(transactionsModuleStub.stubs.filterConfirmedIds.calledOnce).to.be.true;
      expect(transactionsModuleStub.stubs.filterConfirmedIds.firstCall.args.length).to.be.equal(1);
      expect(transactionsModuleStub.stubs.filterConfirmedIds.firstCall.args[0]).to.be.deep.equal([tx.id]);
      expect(result).to.be.false;
    });
  });

  describe('squashQueue', () => {
    let broadcasts;
    beforeEach(() => {
      const ps1 = new PostSignaturesRequest();
      ps1.options = {
        data:
          {
            signature:
              {
                signature: Buffer.from('aaaa', 'hex'),
                transaction: '111111',
              },
          },
      } as any;
      const ps2 = new PostSignaturesRequest();
      ps2.options = {
        data: {
          signatures: [
            {
              signature  : Buffer.from('bbbb', 'hex'),
              transaction: '222222',
            },
            {
              signature  : Buffer.from('cccc', 'hex'),
              transaction: '333333',
            },
          ],
        },
      } as any;

      const pt1   = new PostTransactionsRequest();
      pt1.options = {
        data:
          {
            transaction:
              {
                id: '444444',
                signature: Buffer.from('dddd', 'hex'),
              },
          },
      } as any;

      const pt2   = new PostTransactionsRequest();
      pt2.options = {
        data:
          {
            transactions: [
              {
                id: '555555',
                signature: Buffer.from('eeee', 'hex'),
              },
              {
                id: '666666',
                signature: Buffer.from('ffff', 'hex'),
              },
            ],
          },
      } as any;

      broadcasts  = [{
        options: { api: 'type1', requestHandler: ps1 },
      }, {
        options: { api: 'type2', requestHandler: pt1 },
      }, {
        options: { api: 'type1', requestHandler: ps2 },
      }, {
        options: { api: 'type2', requestHandler: pt2 },
      }];
    });

    it('should return the expected result', () => {
      const result = (instance as any).squashQueue(broadcasts);
      expect(result).to.be.deep.equal([{
          options: {
            immediate: false,
            requestHandler: {
              method: 'POST',
              options: {
                data: {
                  signature: null,
                  signatures: [
                    {
                      signature: Buffer.from('aaaa', 'hex'),
                      transaction: '111111',
                    },
                    {
                      signature  : Buffer.from('bbbb', 'hex'),
                      transaction: '222222',
                    },
                    {
                      signature  : Buffer.from('cccc', 'hex'),
                      transaction: '333333',
                    },
                  ],
                },
              },
              supportsProtoBuf: true,
            },
          },
        },
        {
          options: {
            immediate: false,
            requestHandler: {
              method: 'POST',
              options: {
                data: {
                  transaction: null,
                  transactions: [
                    {
                      id: '444444',
                      signature: Buffer.from('dddd', 'hex'),
                    },
                    {
                      id: '555555',
                      signature: Buffer.from('eeee', 'hex'),
                    },
                    {
                      id: '666666',
                      signature: Buffer.from('ffff', 'hex'),
                    },
                  ],
                },
              },
              supportsProtoBuf: true,
            },
          },
        }]
      );
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
