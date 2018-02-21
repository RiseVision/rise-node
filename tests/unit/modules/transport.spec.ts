import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as Throttle from 'promise-parallel-throttle';
import * as rewire from 'rewire';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { Symbols } from '../../../src/ioc/symbols';
import { PeerState } from '../../../src/logic';
import { TransportModule } from '../../../src/modules/transport';
import schema from '../../../src/schema/transport';
import {
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

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
// tslint:disable no-unused-expression max-line-length

const schemaImport          = Object.assign({}, schema);
const rewireTransportModule = rewire('../../../src/modules/transport');

describe('src/modules/transport.ts', () => {

  let inst: TransportModule;
  let container: Container;
  let sandbox: SinonSandbox;

  const appConfig = {
    peers: { options: { timeout: 1000, }, },
  };

  beforeEach(() => {
    sandbox   = sinon.sandbox.create();
    container = createContainer();
    container.bind(Symbols.generic.appConfig).toConstantValue(appConfig);
    container.bind(Symbols.modules.peers).to(PeersModuleStub).inSingletonScope();
    container.rebind(Symbols.modules.transport).to(rewireTransportModule.TransportModule);
  });

  let constants;
  let io: SocketIOStub;
  let schema: ZSchemaStub;
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
    io     = container.get(Symbols.generic.socketIO);
    schema = container.get(Symbols.generic.zschema);

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

  describe('getFromPeer', () => {

    let peer;
    let options;
    let thePeer;
    let res;
    let headers;
    let error;

    let popsicleStub;
    let popsicleUseStub;

    let removePeerStub: SinonStub;

    beforeEach(() => {
      peer    = {};
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

      popsicleUseStub = { use: sandbox.stub().resolves(res) };
      popsicleStub    = {
        plugins: { parse: sandbox.stub().returns(1) },
        request: sandbox.stub().returns(popsicleUseStub),
      };
      rewireTransportModule.__set__('popsicle', popsicleStub);

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

    it('should call schema.validate', async () => {
      await inst.getFromPeer(peer, options);

      expect(schema.stubs.validate.calledOnce).to.be.true;
      expect(schema.stubs.validate.firstCall.args.length).to.be.equal(2);
      expect(schema.stubs.validate.firstCall.args[0]).to.be.equal(headers);
      expect(schema.stubs.validate.firstCall.args[1]).to.be.equal(schemaImport.headers);
    });

    it('should call removePeer and return rejected promise if schema.validate returned false', async () => {
      schema.stubs.validate.returns(false);
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

    it('success', async () => {
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
    let options;

    let getFromPeerStub;

    beforeEach(() => {
      options = { fieldhohoho: 'hohohohoho' };
      result  = 'hehehe';
      config  = {};
      peers   = [{}];
      peersModule.enqueueResponse('list', Promise.resolve({ peers }));
      getFromPeerStub = sandbox.stub(inst, 'getFromPeer').returns(result);
    });

    it('should call peersModule.list', async () => {
      await inst.getFromRandomPeer(config, options);

      expect(peersModule.stubs.list.calledOnce).to.be.true;
      expect(peersModule.stubs.list.firstCall.args.length).to.be.equal(1);
      expect(peersModule.stubs.list.firstCall.args[0]).to.be.deep.equal({
        allowedStates: [PeerState.CONNECTED, PeerState.DISCONNECTED],
        limit        : 1,
      });
    });

    it('should call getFromPeer and return result', async () => {
      expect(await inst.getFromRandomPeer(config, options)).to.be.equal(result);
      expect(getFromPeerStub.calledOnce).to.be.true;
      expect(getFromPeerStub.firstCall.args.length).to.be.equal(2);
      expect(getFromPeerStub.firstCall.args[0]).to.be.deep.equal(peers[0]);
      expect(getFromPeerStub.firstCall.args[1]).to.be.deep.equal(options);
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

    it('should call logger.trace');
    it('should call jobsQueue.register');
    it('should call discoverPeers');
    it('should call logger.error if discoverPeers throw');
    it('should call peersLogic.list');
    it('should call logger.trace with count info');
    it('should call Throttle.all');
    describe('Throttle.all callback(for each peer in peers)', () => {
      it('should call logger.trace');
      it('should call pingAndUpdate(check on p.updated is false)');
      it('should call pingAndUpdate(check on Date.now() - p.updated > 3000)');
      it('should call logger.debug if pingAndUpdate throw');
      describe('false in condition of Throttle.all"s callback', () => {
        it('p in null');
        it('p.state === PeerState.BANNED');
        it('p.update is true and (Date.now() - p.updated) <= 3000');
      });
    });
    it('should call logger.trace');

  });

  describe('onSignature', () => {

    let broadcast;
    let signature;

    beforeEach(() => {
      signature = { transaction: 'trans', signature: 'sign' };
      broadcast = true;
      broadcasterLogic.enqueueResponse('maxRelays', false);
      broadcasterLogic.enqueueResponse('enqueue', false);
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
      expect(broadcasterLogic.stubs.enqueue.firstCall.args[1]).to.be.deep.equal({
        api   : '/signatures',
        data  : { signature },
        method: 'POST',
      });
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
      expect(broadcasterLogic.stubs.enqueue.firstCall.args[1]).to.be.deep.equal({
        api   : '/transactions',
        data  : { transaction },
        method: 'POST',
      });
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

    it('should call systemModule.update');
    it('should call broadcasterLogic.maxRelays');
    it('should call this.broadcasterLogic.broadcast');
    it('should call io.sockets.emit');
    it('should not call broadcasterLogic.broadcast if broadcasterLogic.maxRelays returns true');
    it('check if broadcast is false');
  });

  describe('receiveSignatures', () => {

  });

  describe('receiveSignature', () => {

  });

  describe('receiveTransactions', () => {

  });

  describe('receiveTransaction', () => {

  });

  describe('removePeer', () => {
    it('should call logger.debug');
    it('should call peersModule.remove');
  });

  describe('discoverPeers', () => {
    it('should call logger.trace');
    it('should call getFromRandomPeer');
    it('should call cbToPromise and schema.validate resolves');
    it('should call peersLogic.acceptable');
    it('should call peersLogic.create ');
    it('should call schema.validate');
    it('should call peersLogic.upsert');
    it('should call logger.debug');
    it('check if schema.validate returns false then call logger.warn');
    it('check if peersLogic.upsert check that current peer already known');
  });

});
