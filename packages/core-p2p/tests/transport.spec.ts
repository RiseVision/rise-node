import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as Throttle from 'promise-parallel-throttle';
import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { PostTransactionsRequest } from '../../../src/apis/requests/PostTransactionsRequest';
import { PostBlocksRequest } from '../../../src/apis/requests/PostBlocksRequest';
import { PeersListRequest } from '../../../src/apis/requests/PeersListRequest';
import { PostSignaturesRequest } from '../../../src/apis/requests/PostSignaturesRequest';
import { wait } from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { PeerState } from '../../../src/logic';
import { TransportModule } from '../../../src/modules';
import peersSchema from '../../../src/schema/peers';
import schema from '../../../src/schema/transport';
import {
  APIRequestStub,
  AppStateStub,
  BroadcasterLogicStub,
  JobsQueueStub,
  LoggerStub,
  MultisignaturesModuleStub,
  PeersLogicStub,
  PeersModuleStub,
  SequenceStub,
  SocketIOStub,
  SystemModuleStub,
  TransactionLogicStub,
  TransactionsModuleStub,
  ZSchemaStub,
} from '../../stubs';
import { createContainer } from '../../utils/containerCreator';
import { createRandomTransactions } from '../../utils/txCrafter';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
// tslint:disable no-unused-expression max-line-length

const popsicleStub         = {} as any;
const throttleStub         = {} as any;
const schemaImport         = Object.assign({}, schema);
const proxyTransportModule = proxyquire('../../../src/modules/transport', {
  'popsicle'                 : popsicleStub,
  'promise-parallel-throttle': throttleStub,
});

describe('src/modules/transport.ts', () => {

  let inst: TransportModule;
  let container: Container;
  let sandbox: SinonSandbox;
  const appConfig = {
    peers: { options: { timeout: 1000, }, },
  };

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    container = createContainer();
    container.rebind(Symbols.generic.appConfig).toConstantValue(appConfig);
    container.rebind(Symbols.modules.transport).to(proxyTransportModule.TransportModule);
  });

  let constants;
  let io: SocketIOStub;
  let schemaStub: ZSchemaStub;
  let balancesSequence: SequenceStub;
  let jobsQueue: JobsQueueStub;
  let logger: LoggerStub;
  let appState: AppStateStub;
  let broadcasterLogic: BroadcasterLogicStub;
  let transactionLogic: TransactionLogicStub;
  let peersLogic: PeersLogicStub;
  let peersModule: PeersModuleStub;
  let multisigModule: MultisignaturesModuleStub;
  let transactionModule: TransactionsModuleStub;
  let systemModule: SystemModuleStub;

  let postConstrA: AppStateStub;
  beforeEach(() => {
    io         = container.get(Symbols.generic.socketIO);
    schemaStub = container.get(Symbols.generic.zschema);

    constants        = container.get(Symbols.helpers.constants);
    balancesSequence = container.getTagged(Symbols.helpers.sequence,
      Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence);
    jobsQueue        = container.get(Symbols.helpers.jobsQueue);
    logger           = container.get(Symbols.helpers.logger);

    appState         = container.get(Symbols.logic.appState);
    broadcasterLogic = container.get(Symbols.logic.broadcaster);
    transactionLogic = container.get(Symbols.logic.transaction);
    peersLogic       = container.get(Symbols.logic.peers);

    peersModule       = container.get(Symbols.modules.peers);
    multisigModule    = container.get(Symbols.modules.multisignatures);
    transactionModule = container.get(Symbols.modules.transactions);
    systemModule      = container.get(Symbols.modules.system);

    // set appState.setComputed call for @postConstruct method
    postConstrA = new AppStateStub();
    postConstrA.enqueueResponse('get', 5);
    postConstrA.enqueueResponse('get', 5);
    appState.enqueueResponse('setComputed', true);
    appState.stubs.setComputed.callsArgWith(1, postConstrA);

    inst = container.get(Symbols.modules.transport);

    (inst as  any).sequence = {
      addAndPromise: sandbox.spy((w) => Promise.resolve(w())),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('postConstructor', () => {

    let instPostConstr: TransportModule;

    beforeEach(() => {
      postConstrA = new AppStateStub();
    });

    it('should call appState.setComputed', () => {
      postConstrA.enqueueResponse('get', 5);
      postConstrA.enqueueResponse('get', 5);
      appState.reset();
      appState.stubs.setComputed.callsArgWith(1, postConstrA);
      appState.enqueueResponse('setComputed', true);
      instPostConstr = container.get(Symbols.modules.transport);

      expect(appState.stubs.setComputed.calledOnce).to.be.true;
      expect(appState.stubs.setComputed.firstCall.args.length).to.be.equal(2);
      expect(appState.stubs.setComputed.firstCall.args[0]).to.be.equal('node.poorConsensus');
      expect(appState.stubs.setComputed.firstCall.args[1]).to.be.a('function');
    });

    it('should call IAppState.get twice', () => {
      postConstrA.enqueueResponse('get', 5);
      postConstrA.enqueueResponse('get', 5);
      appState.reset();
      appState.stubs.setComputed.callsArgWith(1, postConstrA);
      appState.enqueueResponse('setComputed', true);
      instPostConstr = container.get(Symbols.modules.transport);

      expect(postConstrA.stubs.get.calledTwice).to.be.true;

      expect(postConstrA.stubs.get.firstCall.args.length).to.be.equal(1);
      expect(postConstrA.stubs.get.firstCall.args[0]).to.be.equal('node.consensus');

      expect(postConstrA.stubs.get.secondCall.args.length).to.be.equal(1);
      expect(postConstrA.stubs.get.secondCall.args[0]).to.be.equal('node.consensus');
    });

    it('check if IAppState.get result is undefined', () => {
      postConstrA.enqueueResponse('get', undefined);
      appState.reset();
      appState.stubs.setComputed.callsArgWith(1, postConstrA);
      appState.enqueueResponse('setComputed', true);
      instPostConstr = container.get(Symbols.modules.transport);

      expect(postConstrA.stubs.get.calledOnce).to.be.true;
    });
  });

  describe('getFromPeer', function () {
    this.timeout(2100);

    let peer;
    let options;
    let thePeer;
    let res;
    let headers;
    let error;

    let popsicleUseStub;
    let removePeerStub: SinonStub;

    beforeEach(() => {
      peer    = { makeRequest: sandbox.stub()};
      options = {
        method: 'put',
        url   : 'url.com',
      };
      res     = {
        body   : {},
        headers: {},
        method : 'put',
        status : 200,
        url    : 'example.com',
      };
      headers = {
        nethash: 'as8776fsg76sd87',
        version: '1.1.1',
      };

      thePeer = { applyHeaders: sandbox.stub() };
      thePeer.applyHeaders.returns(headers);

      popsicleUseStub      = { use: sandbox.stub().resolves(res) };
      popsicleStub.plugins = { parse: sandbox.stub().returns(1) };
      popsicleStub.request = sandbox.stub().returns(popsicleUseStub);

      removePeerStub = sandbox.stub(inst as any, 'removePeer');

      peersLogic.enqueueResponse('create', thePeer);
      systemModule.enqueueResponse('networkCompatible', true);
      systemModule.enqueueResponse('versionCompatible', true);
      peersModule.enqueueResponse('update', {});
    });

    it('should call peersLogic.create', async () => {
      await   inst.getFromPeer(peer, options);

      expect(peersLogic.stubs.create.calledOnce).to.be.true;
      expect(peersLogic.stubs.create.firstCall.args.length).to.be.equal(1);
      expect(peersLogic.stubs.create.firstCall.args[0]).to.be.deep.equal(peer);
    });

    it('should call popsicle"s methods', async () => {
      await   inst.getFromPeer(peer, options);

      expect(popsicleStub.request.calledOnce).to.be.true;
      expect(popsicleStub.request.firstCall.args.length).to.be.equal(1);
      expect(popsicleStub.request.firstCall.args[0]).to.be.deep.equal({
        body   : null,
        headers: undefined,
        method : 'put',
        timeout: 1000,
        url    : 'http://undefined:undefinedurl.com',
      });

      expect(popsicleUseStub.use.calledOnce).to.be.true;
      expect(popsicleUseStub.use.firstCall.args.length).to.be.equal(1);
      expect(popsicleUseStub.use.firstCall.args[0]).to.be.equal(1);

      expect(popsicleStub.plugins.parse.calledOnce).to.be.true;
      expect(popsicleStub.plugins.parse.firstCall.args.length).to.be.equal(2);
      expect(popsicleStub.plugins.parse.firstCall.args[0]).to.be.deep.equal(['json']);
      expect(popsicleStub.plugins.parse.firstCall.args[1]).to.be.equal(false);
    });

    it('check if options.api', async () => {
      options.api = 'api';

      await inst.getFromPeer(peer, options);

      expect(popsicleStub.request.firstCall.args[0]).to.be.deep.equal({
        body   : null,
        headers: undefined,
        method : 'put',
        timeout: 1000,
        url    : 'http://undefined:undefined/peerapi',
      });
    });

    it('check if options.data', async () => {
      options.data = 'data';

      await inst.getFromPeer(peer, options);

      expect(popsicleStub.request.firstCall.args[0]).to.be.deep.equal({
        body   : 'data',
        headers: undefined,
        method : 'put',
        timeout: 1000,
        url    : 'http://undefined:undefinedurl.com',
      });
    });

    it('should call popsicle twice (retry) if rejects and return 2nd result', async function () {
      this.timeout(2100);
      const start = Date.now();
      popsicleUseStub.use.onFirstCall().rejects(error);
      popsicleUseStub.use.onSecondCall().resolves({status: 500});
      await expect(inst.getFromPeer(peer, options)).to.be.rejectedWith('bad response code 500');

      expect(popsicleUseStub.use.calledTwice).is.true;
      expect(Date.now() - start).gt(2000);
    });

    it('should call removePeer and return rejected promise if popsicle throw', async () => {
      error = new Error('error');
      popsicleUseStub.use.rejects(error);

      await expect(inst.getFromPeer(peer, options)).to.be.rejectedWith(error);

      expect(removePeerStub.calledOnce).to.be.true;
      expect(removePeerStub.firstCall.args.length).to.be.equal(2);
      expect(removePeerStub.firstCall.args[0]).to.be.deep.equal({ peer: thePeer, code: 'HTTPERROR' });
      expect(removePeerStub.firstCall.args[1]).to.be.equal(error.message);
    });

    it('should call removePeer and return rejected promise if req.status !== 200', async () => {
      res.status = 609;
      popsicleUseStub.use.resolves(res);
      error = new Error(`Received bad response code ${res.status} ${res.method} ${res.url}`);

      await expect(inst.getFromPeer(peer, options)).to.be.rejectedWith(error.message);

      expect(removePeerStub.calledOnce).to.be.true;
      expect(removePeerStub.firstCall.args.length).to.be.equal(2);
      expect(removePeerStub.firstCall.args[0]).to.be.deep.equal({ peer: thePeer, code: `ERESPONSE ${res.status}` });
      expect(removePeerStub.firstCall.args[1]).to.be.equal('put http://undefined:undefinedurl.com');
    });

    it('should call thePeer.applyHeaders', async () => {
      await inst.getFromPeer(peer, options);

      expect(thePeer.applyHeaders.calledOnce).to.be.true;
      expect(thePeer.applyHeaders.firstCall.args.length).to.be.equal(1);
      expect(thePeer.applyHeaders.firstCall.args[0]).to.be.equal(res.headers);
    });

    it('should call schemaStub.validate', async () => {
      await inst.getFromPeer(peer, options);

      expect(schemaStub.stubs.validate.calledOnce).to.be.true;
      expect(schemaStub.stubs.validate.firstCall.args.length).to.be.equal(2);
      expect(schemaStub.stubs.validate.firstCall.args[0]).to.be.equal(headers);
      expect(schemaStub.stubs.validate.firstCall.args[1]).to.be.equal(schemaImport.headers);
    });

    it('should call removePeer and return rejected promise if schemaStub.validate returned false', async () => {
      schemaStub.stubs.validate.returns(false);
      error = new Error('Invalid response headers {"nethash":"as8776fsg76sd87","version":"1.1.1"} put http://undefined:undefinedurl.com');

      await expect(inst.getFromPeer(peer, options)).to.be.rejectedWith(error.message);

      expect(removePeerStub.calledOnce).to.be.true;
      expect(removePeerStub.firstCall.args.length).to.be.equal(2);
      expect(removePeerStub.firstCall.args[0]).to.be.deep.equal({ peer: thePeer, code: 'EHEADERS' });
      expect(removePeerStub.firstCall.args[1]).to.be.equal('put http://undefined:undefinedurl.com');
    });

    it('should call systemModule.networkCompatible', async () => {
      await inst.getFromPeer(peer, options);

      expect(systemModule.stubs.networkCompatible.calledOnce).to.be.true;
      expect(systemModule.stubs.networkCompatible.firstCall.args.length).to.be.equal(1);
      expect(systemModule.stubs.networkCompatible.firstCall.args[0]).to.be.equal(headers.nethash);
    });

    it('should call removePeer and return rejected promise if systemModule.networkCompatible returned false', async () => {
      error = new Error('Peer is not on the same network as8776fsg76sd87 put http://undefined:undefinedurl.com');
      systemModule.reset();
      systemModule.enqueueResponse('networkCompatible', false);

      await expect(inst.getFromPeer(peer, options)).to.be.rejectedWith(error.message);

      expect(removePeerStub.calledOnce).to.be.true;
      expect(removePeerStub.firstCall.args.length).to.be.equal(2);
      expect(removePeerStub.firstCall.args[0]).to.be.deep.equal({ peer: thePeer, code: 'ENETHASH' });
      expect(removePeerStub.firstCall.args[1]).to.be.equal('put http://undefined:undefinedurl.com');
    });

    it('should call systemModule.versionCompatible', async () => {
      await inst.getFromPeer(peer, options);

      expect(systemModule.stubs.versionCompatible.calledOnce).to.be.true;
      expect(systemModule.stubs.versionCompatible.firstCall.args.length).to.be.equal(1);
      expect(systemModule.stubs.versionCompatible.firstCall.args[0]).to.be.equal(headers.version);
    });

    it('should call removePeer and return rejected promise if systemModule.versionCompatible returned false', async () => {
      error = new Error('Peer is using incompatible version 1.1.1 put http://undefined:undefinedurl.com');
      systemModule.reset();
      systemModule.enqueueResponse('networkCompatible', true);
      systemModule.enqueueResponse('versionCompatible', false);

      await expect(inst.getFromPeer(peer, options)).to.be.rejectedWith(error.message);

      expect(removePeerStub.calledOnce).to.be.true;
      expect(removePeerStub.firstCall.args.length).to.be.equal(2);
      expect(removePeerStub.firstCall.args[0]).to.be.deep.equal({ peer: thePeer, code: 'EVERSION 1.1.1' });
      expect(removePeerStub.firstCall.args[1]).to.be.equal('put http://undefined:undefinedurl.com');

    });

    it('should call peersModule.update', async () => {
      await inst.getFromPeer(peer, options);

      expect(peersModule.stubs.update.calledOnce).to.be.true;
      expect(peersModule.stubs.update.firstCall.args.length).to.be.equal(1);
      expect(peersModule.stubs.update.firstCall.args[0]).to.be.equal(thePeer);
    });

    it('should return an object with body and peer properties if everything is ok', async () => {
      expect(await inst.getFromPeer(peer, options)).to.be.deep.equal({
        body: res.body,
        peer: thePeer,
      });
    });
  });

  describe('getFromRandomPeer', () => {

    let config;
    let peers;
    let result;
    let requestHandler;

    let getFromPeerStub;

    beforeEach(() => {
      requestHandler = new APIRequestStub();
      result  = 'hehehe';
      config  = {};
      peers   = [{makeRequest: sandbox.stub().returns(result)}];

      peersModule.enqueueResponse('list', Promise.resolve({ peers }));
    });

    it('should call peersModule.list', async () => {
      await inst.getFromRandomPeer(config, requestHandler);

      expect(peersModule.stubs.list.calledOnce).to.be.true;
      expect(peersModule.stubs.list.firstCall.args.length).to.be.equal(1);
      expect(peersModule.stubs.list.firstCall.args[0]).to.be.deep.equal({
        allowedStates: [PeerState.CONNECTED, PeerState.DISCONNECTED],
        limit        : 1,
      });
    });

    it('should call makeRequest and return result', async () => {
      expect(await inst.getFromRandomPeer(config, requestHandler)).to.be.equal(result);
      expect(peers[0].makeRequest.calledOnce).to.be.true;
      expect(peers[0].makeRequest.firstCall.args.length).to.be.equal(1);
      expect(peers[0].makeRequest.firstCall.args[0]).to.be.deep.equal(requestHandler);
      expect(peers[0].makeRequest.firstCall.args[0]).to.be.instanceOf(APIRequestStub);
    });
  });

  describe('cleanup', () => {
    it('should set loaded in false and return promise.resolve', () => {
      expect(inst.cleanup()).to.be.fulfilled;
      expect((inst as any).loaded).to.be.false;
    });
  });

  describe('onBlockchainReady', () => {
    it('should set loaded in true', () => {
      inst.onBlockchainReady();

      expect((inst as any).loaded).to.be.true;
    });
  });

  describe('onPeersReady', () => {
    let peers;
    let discoverPeersStub: SinonStub;

    beforeEach(() => {
      peers = [{
        pingAndUpdate: sandbox.stub(),
        state        : PeerState.CONNECTED,
        string       : 'string',
        updated      : false,
      }];

      throttleStub.all = sandbox.stub().callsFake((fkArray) => {
        const promiseArray = [];
        for (const fk of fkArray) {
          promiseArray.push(fk());
        }
        return Promise.all(promiseArray);
      });

      jobsQueue.stubs.register.callsArg(1);
      discoverPeersStub = sandbox.stub(inst as any, 'discoverPeers');
      peersLogic.enqueueResponse('list', peers);
    });

    it('should call logger.trace', async () => {
      await inst.onPeersReady();

      // use to async call of jobsQueue.register callback
      process.nextTick(() => {
        const loggerTraceStub = logger.stubs.trace;

        expect(loggerTraceStub.callCount).to.be.equal(4);

        expect(loggerTraceStub.getCall(0).args.length).to.be.equal(1);
        expect(loggerTraceStub.getCall(0).args[0]).to.be.equal('Peers ready');

        expect(loggerTraceStub.getCall(1).args.length).to.be.equal(2);
        expect(loggerTraceStub.getCall(1).args[0]).to.be.equal('Updating peers');
        expect(loggerTraceStub.getCall(1).args[1]).to.be.deep.equal({ count: peers.length });

        expect(loggerTraceStub.getCall(2).args.length).to.be.equal(2);
        expect(loggerTraceStub.getCall(2).args[0]).to.be.equal('Updating peer');
        expect(loggerTraceStub.getCall(2).args[1]).to.be.equal(peers[0].string);

        expect(loggerTraceStub.getCall(3).args.length).to.be.equal(1);
        expect(loggerTraceStub.getCall(3).args[0]).to.be.equal('Updated Peers');
      });
    });

    it('should call jobsQueue.register', async () => {
      await inst.onPeersReady();

      expect(jobsQueue.stubs.register.calledOnce).to.be.true;
      expect(jobsQueue.stubs.register.firstCall.args.length).to.be.equal(3);
      expect(jobsQueue.stubs.register.firstCall.args[0]).to.be.equal('peersDiscoveryAndUpdate');
      expect(jobsQueue.stubs.register.firstCall.args[1]).to.be.a('function');
      expect(jobsQueue.stubs.register.firstCall.args[2]).to.be.equal(5000);
    });

    it('should call discoverPeers', async () => {
      await inst.onPeersReady();

      expect(discoverPeersStub.calledOnce).to.be.true;
      expect(discoverPeersStub.firstCall.args.length).to.be.equal(0);
    });

    it('should logger.error if discoverPeers throw', async () => {
      const error = new Error('error');
      discoverPeersStub.rejects(error);

      await inst.onPeersReady();

      process.nextTick(() => {
        expect(logger.stubs.error.calledOnce).to.be.true;
        expect(logger.stubs.error.firstCall.args.length).to.be.equal(2);
        expect(logger.stubs.error.firstCall.args[0]).to.be.equal('Discovering new peers failed');
        expect(logger.stubs.error.firstCall.args[1]).to.be.equal(error);
      });
    });

    it('should call peersLogic.list', async () => {
      await inst.onPeersReady();

      expect(peersLogic.stubs.list.calledOnce).to.be.true;
      expect(peersLogic.stubs.list.firstCall.args.length).to.be.equal(1);
      expect(peersLogic.stubs.list.firstCall.args[0]).to.be.equal(false);
    });

    it('should call Throttle.all', async () => {
      await inst.onPeersReady();

      expect(throttleStub.all.calledOnce).to.be.true;
      expect(throttleStub.all.firstCall.args.length).to.be.equal(2);
      expect(throttleStub.all.firstCall.args[0]).to.be.a('array');
      expect(throttleStub.all.firstCall.args[1]).to.be.deep.equal({ maxInProgress: 50 });
    });

    describe('Throttle.all callback(for each peer in peers)', () => {

      it('should call pingAndUpdate(check on p.updated is false)', async () => {
        await inst.onPeersReady();

        expect(peers[0].pingAndUpdate.calledOnce).to.be.true;
        expect(peers[0].pingAndUpdate.firstCall.args.length).to.be.equal(0);
      });

      it('should call pingAndUpdate(check on Date.now() - p.updated > 3000)', async () => {
        peers[0].updated = Date.now() - 3001;

        await inst.onPeersReady();
        await wait(10);
        expect(peers[0].pingAndUpdate.calledOnce).to.be.true;
        expect(peers[0].pingAndUpdate.firstCall.args.length).to.be.equal(0);
      });

      it('should call logger.debug if pingAndUpdate throw', async () => {
        const error = new Error('error');
        peers[0].pingAndUpdate.rejects(error);

        await inst.onPeersReady();
        await wait(10);
        expect(logger.stubs.debug.calledOnce).to.be.true;
        expect(logger.stubs.debug.firstCall.args.length).to.be.equal(2);
        expect(logger.stubs.debug.firstCall.args[0]).to.be.equal('Ping failed when updating peer string');
        expect(logger.stubs.debug.firstCall.args[1]).to.be.deep.equal(error);

      });

      describe('false in condition of Throttle.all"s callback', () => {

        it('p in null', async () => {
          peers[0] = null;

          await inst.onPeersReady();
          await wait(100);
          expect(logger.stubs.trace.callCount).to.be.equal(3);
        });

        it('p.state === PeerState.BANNED', async () => {
          peers[0].state = PeerState.BANNED;

          await inst.onPeersReady();
          await wait(10);
          expect(logger.stubs.trace.callCount).to.be.equal(3);
        });

        it('p.update is true and (Date.now() - p.updated) <= 3000', async () => {
          peers[0].updated = Date.now() - 2000;

          await inst.onPeersReady();
          await wait(10);

          expect(logger.stubs.trace.callCount).to.be.equal(3);
        });
      });
    });
  });

  describe('onSignature', () => {

    let broadcast;
    let signature;

    beforeEach(() => {
      signature = { transaction: '1111111', signature: 'aaaabbbb' };
      broadcast = true;
      broadcasterLogic.enqueueResponse('maxRelays', false);
      broadcasterLogic.enqueueResponse('enqueue', false);
      (inst as any).appState = {get: () => 1000};
      const p = new PostSignaturesRequest();
      (inst as any).psrFactory = (a) => {
        p.options = a;
        return p;
      };
    });

    it('should call broadcasterLogic.maxRelays', () => {
      inst.onSignature(signature, broadcast);
      expect(broadcasterLogic.stubs.maxRelays.calledOnce).to.be.true;
      expect(broadcasterLogic.stubs.maxRelays.firstCall.args.length).to.be.equal(1);
      expect(broadcasterLogic.stubs.maxRelays.firstCall.args[0]).to.be.deep.equal(signature);
    });

    it('should call broadcasterLogic.enqueue', async () => {
      inst.onSignature(signature, broadcast);

      expect(broadcasterLogic.stubs.enqueue.calledOnce).to.be.true;
      expect(broadcasterLogic.stubs.enqueue.firstCall.args.length).to.be.equal(2);
      expect(broadcasterLogic.stubs.enqueue.firstCall.args[0]).to.be.deep.equal({});
      expect(broadcasterLogic.stubs.enqueue.firstCall.args[1].requestHandler).to.be.instanceOf(PostSignaturesRequest);
      expect(broadcasterLogic.stubs.enqueue.firstCall.args[1].requestHandler.options).to.be.deep.equal({data: { signatures: [{
        signature: Buffer.from(signature.signature, 'hex'),
        transaction: signature.transaction,
      }] }});
    });

    it('should call io.sockets.emit', async () => {
      inst.onSignature(signature, broadcast);

      expect(io.sockets.emit.calledOnce).to.be.true;
      expect(io.sockets.emit.firstCall.args.length).to.be.equal(2);
      expect(io.sockets.emit.firstCall.args[0]).to.be.deep.equal('signature/change');
      expect(io.sockets.emit.firstCall.args[1]).to.be.deep.equal(signature);
    });

    it('should not call broadcasterLogic.enqueue if broadcast is false', () => {
      broadcast = false;

      inst.onSignature(signature, broadcast);

      expect(broadcasterLogic.stubs.enqueue.notCalled).to.be.true;
    });

    it('should not call broadcasterLogic.enqueue if this.broadcasterLogic.maxRelays returned true', () => {
      broadcasterLogic.reset();
      broadcasterLogic.enqueueResponse('maxRelays', true);

      inst.onSignature(signature, broadcast);

      expect(broadcasterLogic.stubs.enqueue.notCalled).to.be.true;
    });
  });

  describe('onUnconfirmedTransaction', () => {

    let broadcast;
    let transaction;

    beforeEach(() => {
      transaction = {};
      broadcast   = true;
      broadcasterLogic.enqueueResponse('maxRelays', false);
      broadcasterLogic.enqueueResponse('enqueue', false);
      const p = new PostTransactionsRequest();
      (inst as any).ptrFactory = (a) => {
        p.options = a;
        return p;
      };
    });

    it('should call broadcasterLogic.maxRelays', () => {
      inst.onUnconfirmedTransaction(transaction, broadcast);

      expect(broadcasterLogic.stubs.maxRelays.calledOnce).to.be.true;
      expect(broadcasterLogic.stubs.maxRelays.firstCall.args.length).to.be.equal(1);
      expect(broadcasterLogic.stubs.maxRelays.firstCall.args[0]).to.be.deep.equal(transaction);
    });

    it('should call broadcasterLogic.enqueue', async () => {
      inst.onUnconfirmedTransaction(transaction, broadcast);

      expect(broadcasterLogic.stubs.enqueue.calledOnce).to.be.true;
      expect(broadcasterLogic.stubs.enqueue.firstCall.args.length).to.be.equal(2);
      expect(broadcasterLogic.stubs.enqueue.firstCall.args[0]).to.be.deep.equal({});
      expect(broadcasterLogic.stubs.enqueue.firstCall.args[1].requestHandler.options).to.be.deep.equal({data: {transactions:[transaction]}});
    });

    it('should call io.sockets.emit', async () => {
      inst.onUnconfirmedTransaction(transaction, broadcast);

      expect(io.sockets.emit.calledOnce).to.be.true;
      expect(io.sockets.emit.firstCall.args.length).to.be.equal(2);
      expect(io.sockets.emit.firstCall.args[0]).to.be.deep.equal('transactions/change');
      expect(io.sockets.emit.firstCall.args[1]).to.be.deep.equal(transaction);
    });

    it('should not call broadcasterLogic.enqueue if broadcast is false', () => {
      broadcast = false;

      inst.onUnconfirmedTransaction(transaction, broadcast);

      expect(broadcasterLogic.stubs.enqueue.notCalled).to.be.true;
    });

    it('should not call broadcasterLogic.enqueue if this.broadcasterLogic.maxRelays returned true', () => {
      broadcasterLogic.reset();
      broadcasterLogic.enqueueResponse('maxRelays', true);

      inst.onUnconfirmedTransaction(transaction, broadcast);

      expect(broadcasterLogic.stubs.enqueue.notCalled).to.be.true;
    });
  });

  describe('onNewBlock', () => {

    let broadcast;
    let block;

    beforeEach(() => {
      block                                = {
        blockSignature    : Buffer.from('aa', 'hex'),
        generatorPublicKey: Buffer.from('bb', 'hex'),
        payloadHash       : Buffer.from('cc', 'hex'),
        transactions      : [],
      };
      broadcast                            = true;
      (inst as any).systemModule.broadhash = 'broadhash';
      systemModule.enqueueResponse('update', Promise.resolve());
      broadcasterLogic.enqueueResponse('maxRelays', false);
      broadcasterLogic.enqueueResponse('broadcast', Promise.resolve());
      const p = new PostBlocksRequest();
      (inst as any).pblocksFactory = (a) => {
        p.options = a;
        return p;
      };
    });

    it('should call systemModule.update', async () => {
      await inst.onNewBlock(block, broadcast);

      expect(systemModule.stubs.update.calledOnce).to.be.true;
      expect(systemModule.stubs.update.firstCall.args.length).to.be.equal(0);
    });

    it('should call broadcasterLogic.maxRelays', async () => {
      await inst.onNewBlock(block, broadcast);

      expect(broadcasterLogic.stubs.maxRelays.calledOnce).to.be.true;
      expect(broadcasterLogic.stubs.maxRelays.firstCall.args.length).to.be.equal(1);
      expect(broadcasterLogic.stubs.maxRelays.firstCall.args[0]).to.be.deep.equal(block);
    });

    it('should call broadcasterLogic.broadcast', async () => {
      await inst.onNewBlock(block, broadcast);

      expect(broadcasterLogic.stubs.broadcast.calledOnce).to.be.true;
      expect(broadcasterLogic.stubs.broadcast.firstCall.args.length).to.be.equal(2);
      expect(broadcasterLogic.stubs.broadcast.firstCall.args[0]).to.be.deep.equal({
        broadhash: 'broadhash',
        limit    : constants.maxPeers,
      });
      expect(broadcasterLogic.stubs.broadcast.firstCall.args[1].requestHandler.options).to.be.deep.equal({
          data     : {
            block: {
              blockSignature    : Buffer.from('aa', 'hex'),
              generatorPublicKey: Buffer.from('bb', 'hex'),
              payloadHash       : Buffer.from('cc', 'hex'),
              transactions      : [],
            },
          },
      });
    });

    it('should call io.sockets.emit', async () => {
      await inst.onNewBlock(block, broadcast);

      expect(io.sockets.emit.calledOnce).to.be.true;
      expect(io.sockets.emit.firstCall.args.length).to.be.equal(2);
      expect(io.sockets.emit.firstCall.args[0]).to.be.deep.equal('blocks/change');
      expect(io.sockets.emit.firstCall.args[1]).to.be.deep.equal(block);
    });

    it('should not call broadcasterLogic.broadcast if broadcasterLogic.maxRelays returns true', async () => {
      broadcasterLogic.reset();
      broadcasterLogic.enqueueResponse('maxRelays', true);

      await inst.onNewBlock(block, broadcast);

      expect(broadcasterLogic.stubs.broadcast.notCalled).to.be.true;
    });

    it('check if broadcast is false', () => {
      broadcast = false;

      const p = inst.onNewBlock(block, broadcast);

      expect(p).to.be.fulfilled;
      expect(broadcasterLogic.stubs.enqueue.notCalled).to.be.true;
    });
    it('should ignore broadcast error if any and, more importantly avoid waiting for broadcaster result', async () => {
      broadcasterLogic.reset();
      broadcasterLogic.enqueueResponse('maxRelays', false);
      let finished  = false;
      const promise = wait(1000)
        .then(() => finished = true);

      broadcasterLogic.enqueueResponse('broadcast', promise);

      await inst.onNewBlock(block, true);
      expect(finished).to.be.false;
      await promise;
    });
  });

  describe('receiveSignatures', () => {

    let receiveSignatureStub: SinonStub;
    let query;

    beforeEach(() => {
      query                = [{ transaction: 'transaction', signature: 'signature' }];
      receiveSignatureStub = sandbox.stub(inst as any, 'receiveSignature');
    });

    it('should call receiveSignature', async () => {
      await inst.receiveSignatures(query);

      expect(receiveSignatureStub.calledOnce).to.be.true;
      expect(receiveSignatureStub.firstCall.args.length).to.be.equal(1);
      expect(receiveSignatureStub.firstCall.args[0]).to.be.deep.equal(query[0]);
    });

    it('should call logger.debug if receiveSignature throw error', async () => {
      const error = new Error('error');
      receiveSignatureStub.rejects(error);

      await inst.receiveSignatures(query);

      expect(logger.stubs.debug.calledOnce).to.be.true;
      expect(logger.stubs.debug.firstCall.args.length).to.be.equal(2);
      expect(logger.stubs.debug.firstCall.args[0]).to.be.equal(error);
      expect(logger.stubs.debug.firstCall.args[1]).to.be.deep.equal(query[0]);
    });
  });

  describe('receiveSignature', () => {

    let signature;

    beforeEach(() => {
      signature = { transaction: 'transaction', signature: 'signature' };

      multisigModule.enqueueResponse('processSignature', Promise.resolve());
    });

    it('should call multisigModule.processSignature', async () => {
      await inst.receiveSignature(signature);

      expect(multisigModule.stubs.processSignature.calledOnce).to.be.true;
      expect(multisigModule.stubs.processSignature.firstCall.args.length).to.be.equal(1);
      expect(multisigModule.stubs.processSignature.firstCall.args[0]).to.be.deep.equal(signature);
    });

    it('should throw error multisigModule.processSignature throw error', async () => {
      const error = new Error('error');
      multisigModule.reset();
      multisigModule.enqueueResponse('processSignature', Promise.reject(error));

      await  expect(inst.receiveSignature(signature)).to.be.rejectedWith('Error processing signature: error');
    });
  });

  describe('receiveTransactions', () => {

    let transactions;
    let peer;
    let extraLogMessage;

    beforeEach(() => {
      transactions    = createRandomTransactions({send: 2});
      peer            = { ip: 'ip', port: 'port' };
      extraLogMessage = 'extraLogMessage';
      transactionLogic.stubs.objectNormalize.callsFake((tx) => tx);
      transactionModule.stubs.filterConfirmedIds.resolves([]);
      transactionModule.stubs.processUnconfirmedTransaction.resolves();
      peersModule.stubs.remove.returns(null);
    });

    describe('transactionLogic.objectNormalize throw error', () => {

      let error;

      beforeEach(() => {
        error = new Error('error');
        transactionLogic.stubs.objectNormalize.throws(error);
      });

      it('should throw error', async () => {
        await expect(inst.receiveTransactions(transactions, peer, false)).to.be.rejectedWith('Invalid transaction body error');
      });

      it('should call removePeer', async () => {
        await expect(inst.receiveTransactions(transactions, peer, false)).to.be.rejectedWith('Invalid transaction body error');

        expect(peersModule.stubs.remove.calledOnce).to.be.true;
        expect(peersModule.stubs.remove.firstCall.args.length).to.be.equal(2);
        expect(peersModule.stubs.remove.firstCall.args[0]).to.be.deep.equal(peer.ip);
        expect(peersModule.stubs.remove.firstCall.args[1]).to.be.deep.equal(peer.port);
      });

    });

    it('should call balancesSequence.addAndPromise', async () => {
      await inst.receiveTransactions(transactions, peer, false);

      expect(balancesSequence.spies.addAndPromise.calledOnce).to.be.true;
      expect(balancesSequence.spies.addAndPromise.firstCall.args.length).to.be.equal(1);
      expect(balancesSequence.spies.addAndPromise.firstCall.args[0]).to.be.a('function');
    });

    it('should call transactionModule.processUnconfirmedTransaction', async () => {
      await inst.receiveTransactions(transactions, peer, false);

      expect(transactionModule.stubs.processUnconfirmedTransaction.calledTwice).to.be.true;
      expect(transactionModule.stubs.processUnconfirmedTransaction.firstCall.args.length).to.be.equal(2);
      expect(transactionModule.stubs.processUnconfirmedTransaction.firstCall.args[0]).to.be.deep.equal(transactions[0]);
      expect(transactionModule.stubs.processUnconfirmedTransaction.firstCall.args[1]).to.be.equal(false);

      expect(transactionModule.stubs.processUnconfirmedTransaction.secondCall.args.length).to.be.equal(2);
      expect(transactionModule.stubs.processUnconfirmedTransaction.secondCall.args[0]).to.be.deep.equal(transactions[1]);
      expect(transactionModule.stubs.processUnconfirmedTransaction.secondCall.args[1]).to.be.equal(false);
    });

    it('should filter out already confirmed ids', async () => {
      transactionModule.stubs.filterConfirmedIds.resolves([transactions[1].id]);
      await inst.receiveTransactions(transactions, peer, true);
      expect(transactionModule.stubs.processUnconfirmedTransaction.calledOnce).is.true;
      expect(transactionModule.stubs.processUnconfirmedTransaction.firstCall.args).deep.eq([
        transactions[0],
        true,
      ]);
    });

    describe('peer null', () => {
      it('should not remove null peer if failed to objectNormalize', async () => {
        transactionLogic.stubs.objectNormalize.throws(new Error('error'));
        await expect(inst.receiveTransactions(transactions, null, false)).to.be
          .rejectedWith('Invalid transaction body error');

        expect(peersModule.stubs.remove.calledOnce).to.be.false;
      });
      it('not throw for peer.* access if txs are ok', async () => {
        await inst.receiveTransactions(transactions, null, false)
      });
    });
  });

  describe('removePeer', () => {

    let options;
    let extraMessage;

    beforeEach(() => {
      extraMessage = 'eeeemessage';
      options      = {
        code: 'code',
        peer: {
          ip  : 'ip',
          port: 'port',
        },
      };
      peersModule.enqueueResponse('remove', {});
    });

    it('should call logger.debug', () => {
      (inst as any).removePeer(options, extraMessage);

      expect(logger.stubs.debug.calledOnce).to.be.true;
      expect(logger.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(logger.stubs.debug.firstCall.args[0]).to.be.equal('code Removing peer undefined eeeemessage');
    });

    it('should call peersModule.remove', () => {
      (inst as any).removePeer(options, extraMessage);

      expect(peersModule.stubs.remove.calledOnce).to.be.true;
      expect(peersModule.stubs.remove.firstCall.args.length).to.be.equal(2);
      expect(peersModule.stubs.remove.firstCall.args[0]).to.be.equal('ip');
      expect(peersModule.stubs.remove.firstCall.args[1]).to.be.equal('port');
    });
  });

  describe('discoverPeers', () => {

    let response;
    let acceptablePeers;
    let peer;

    let getFromRandomPeerStub: SinonStub;

    beforeEach(() => {
      response        = {
        body: {
          peers: 'peers',
        },
      };
      acceptablePeers = [{}];
      peer            = { string: 'string' };

      schemaStub.stubs.validate.onCall(0).callsArg(2);
      peersLogic.enqueueResponse('acceptable', acceptablePeers);
      peersLogic.enqueueResponse('create', peer);
      peersLogic.enqueueResponse('upsert', true);
      getFromRandomPeerStub = sandbox.stub(inst as any, 'getFromRandomPeer').resolves(response);
      const p = new PeersListRequest();
      (inst as any).plFactory = (a) => {
        p.options = a;
        return p;
      };
    });

    it('should call logger.trace', async () => {
      await (inst as any).discoverPeers();

      expect(logger.stubs.trace.calledOnce).to.be.true;
      expect(logger.stubs.trace.firstCall.args.length).to.be.equal(1);
      expect(logger.stubs.trace.firstCall.args[0]).to.be.equal('Transport->discoverPeers');
    });

    it('should call getFromRandomPeer', async () => {
      await (inst as any).discoverPeers();

      expect(getFromRandomPeerStub.calledOnce).to.be.true;
      expect(getFromRandomPeerStub.firstCall.args.length).to.be.equal(2);
      expect(getFromRandomPeerStub.firstCall.args[0]).to.be.deep.equal({});
      expect(getFromRandomPeerStub.firstCall.args[1]).to.be.deep.equal(new PeersListRequest());
    });

    it('should call schemaStub.validate resolves', async () => {
      await (inst as any).discoverPeers();

      expect(schemaStub.stubs.validate.calledTwice).to.be.true;
      expect(schemaStub.stubs.validate.firstCall.args.length).to.be.equal(3);
      expect(schemaStub.stubs.validate.firstCall.args[0]).to.be.equal(response.body);
      expect(schemaStub.stubs.validate.firstCall.args[1]).to.be.equal(peersSchema.discover.peers);
      expect(schemaStub.stubs.validate.firstCall.args[2]).to.be.a('function');
    });

    it('should call peersLogic.acceptable', async () => {
      await (inst as any).discoverPeers();

      expect(peersLogic.stubs.acceptable.calledOnce).to.be.true;
      expect(peersLogic.stubs.acceptable.firstCall.args.length).to.be.equal(1);
      expect(peersLogic.stubs.acceptable.firstCall.args[0]).to.be.equal(response.body.peers);
    });

    it('should call peersLogic.create', async () => {
      await (inst as any).discoverPeers();

      expect(peersLogic.stubs.create.calledOnce).to.be.true;
      expect(peersLogic.stubs.create.firstCall.args.length).to.be.equal(1);
      expect(peersLogic.stubs.create.firstCall.args[0]).to.be.equal(acceptablePeers[0]);
    });

    it('should call schemaStub.validate', async () => {
      await (inst as any).discoverPeers();

      expect(schemaStub.stubs.validate.calledTwice).to.be.true;
      expect(schemaStub.stubs.validate.secondCall.args.length).to.be.equal(2);
      expect(schemaStub.stubs.validate.secondCall.args[0]).to.be.equal(peer);
      expect(schemaStub.stubs.validate.secondCall.args[1]).to.be.equal(peersSchema.discover.peer);
    });

    it('should call peersLogic.upsert', async () => {
      await (inst as any).discoverPeers();

      expect(peersLogic.stubs.upsert.calledOnce).to.be.true;
      expect(peersLogic.stubs.upsert.firstCall.args.length).to.be.equal(2);
      expect(peersLogic.stubs.upsert.firstCall.args[0]).to.be.equal(peer);
      expect(peersLogic.stubs.upsert.firstCall.args[1]).to.be.equal(true);
    });

    it('should call logger.debug', async () => {
      await (inst as any).discoverPeers();

      expect(logger.stubs.debug.calledOnce).to.be.true;
      expect(logger.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(logger.stubs.debug.firstCall.args[0]).to.be.equal('Discovered 1 peers - Rejected 0 - AlreadyKnown 0');
    });

    it('check if schemaStub.validate returns false then call logger.warn', async () => {
      schemaStub.stubs.validate.onCall(1).returns(false);

      await (inst as any).discoverPeers();

      expect(logger.stubs.warn.calledOnce).to.be.true;
      expect(logger.stubs.warn.firstCall.args.length).to.be.equal(1);
      expect(logger.stubs.warn.firstCall.args[0]).to.be.equal('Rejecting invalid peer: string');

      expect(logger.stubs.debug.calledOnce).to.be.true;
      expect(logger.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(logger.stubs.debug.firstCall.args[0]).to.be.equal('Discovered 0 peers - Rejected 1 - AlreadyKnown 0');
    });

    it('check if peersLogic.upsert check that current peer already known', async () => {
      peersLogic.reset();
      peersLogic.enqueueResponse('acceptable', acceptablePeers);
      peersLogic.enqueueResponse('create', peer);
      peersLogic.enqueueResponse('upsert', undefined);

      await (inst as any).discoverPeers();

      expect(logger.stubs.debug.calledOnce).to.be.true;
      expect(logger.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(logger.stubs.debug.firstCall.args[0]).to.be.equal('Discovered 0 peers - Rejected 0 - AlreadyKnown 1');
    });
  });

});
