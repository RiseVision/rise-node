import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as Throttle from 'promise-parallel-throttle';
import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { TransportModule } from '../src/transport';
import { createContainer } from '../../core-launchpad/tests/utils/createContainer';
import { Symbols } from '../../core-interfaces/src';
import * as SocketIO from 'socket.io';
import { AppState, JobsQueue, Sequence } from '../../core-helpers/src';
import { LoggerStub } from '../../core-utils/tests/stubs';
import { BroadcasterLogic } from '../src/broadcaster';
import { TransactionLogic, TransactionsModule } from '../../core-transactions/src';
import { PeersModule } from '../src/peersModule';
import { SystemModule } from '../../core/src/modules';
import { PeersLogic } from '../src/peersLogic';
import { IBlocksModule } from '../../core-interfaces/src/modules';
import { createFakeBlock } from '../../core-blocks/tests/utils/createFakeBlocks';
import { StubbedRequest } from './utils/StubbedRequest';
import { PeerState } from '../../core-types/src';
import { wait } from '../../core-utils/src';
import { p2pSymbols } from '../src/helpers';
import { PingRequest } from '../src/requests';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
// tslint:disable no-unused-expression max-line-length

const popsicleStub         = {} as any;
const throttleStub         = {} as any;
const proxyTransportModule = proxyquire('../src/transport', {
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

  before(async () => {
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core-p2p', 'core-helpers', 'core-blocks', 'core-transactions', 'core', 'core-accounts']);

    container.rebind(Symbols.generic.appConfig).toConstantValue(appConfig);
    container.rebind(Symbols.modules.transport).to(proxyTransportModule.TransportModule);
  });

  let constants;
  let io: SocketIO.Server;
  let schemaStub: any;
  let blocksModule: IBlocksModule;
  let balancesSequence: Sequence;
  let jobsQueue: JobsQueue;
  let logger: LoggerStub;
  let appState: AppState;
  let broadcasterLogic: BroadcasterLogic;
  let transactionLogic: TransactionLogic;
  let peersLogic: PeersLogic;
  let peersModule: PeersModule;
  let transactionModule: TransactionsModule;
  let systemModule: SystemModule;

  beforeEach(() => {
    io         = container.get(Symbols.generic.socketIO);
    schemaStub = container.get(Symbols.generic.zschema);

    constants        = container.get(Symbols.generic.constants);
    balancesSequence = container.getNamed(Symbols.helpers.sequence, Symbols.names.helpers.balancesSequence);
    jobsQueue        = container.get(Symbols.helpers.jobsQueue);
    logger           = container.get(Symbols.helpers.logger);

    appState         = container.get(Symbols.logic.appState);
    broadcasterLogic = container.get(Symbols.logic.broadcaster);
    transactionLogic = container.get(Symbols.logic.transaction);
    peersLogic       = container.get(Symbols.logic.peers);

    peersModule = container.get(Symbols.modules.peers);

    transactionModule = container.get(Symbols.modules.transactions);
    systemModule      = container.get(Symbols.modules.system);
    blocksModule      = container.get(Symbols.modules.blocks);

    blocksModule.lastBlock = createFakeBlock(container);
    // set appState.setComputed call for @postConstruct method
    inst                   = container.get(Symbols.modules.transport);

    (inst as  any).sequence = {
      addAndPromise: sandbox.spy((w) => Promise.resolve(w())),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('postConstructor', () => {

    it('should set computed', () => {
      sandbox.stub(appState, 'get').returns(19);
      expect(appState.getComputed('node.poorConsensus')).eq(true);
    });
  });

  describe('getFromPeer', function () {
    this.timeout(3000);

    let peer;
    let options;
    let thePeer;
    let res;
    let headers;
    let error;

    let popsicleUseStub;
    let removePeerStub: SinonStub;

    beforeEach(() => {
      peer    = { makeRequest: sandbox.stub(), ip: '127.0.0.1', port: Math.ceil(Math.random() * 10000) };
      options = {
        method: 'put',
        url   : 'url.com',
      };
      headers = {
        nethash: systemModule.headers.nethash,
        version: '1.1.1',
        port   : peer.port,
        height : 100,
      };
      res     = {
        body   : {},
        headers: { ...headers },
        method : 'put',
        status : 200,
        url    : 'example.com',
      };

      thePeer = { applyHeaders: sandbox.stub() };
      thePeer.applyHeaders.returns(headers);

      popsicleUseStub      = { use: sandbox.stub().resolves(res) };
      popsicleStub.plugins = { parse: sandbox.stub().returns(1) };
      popsicleStub.request = sandbox.stub().returns(popsicleUseStub);

      removePeerStub = sandbox.stub(inst as any, 'removePeer');

    });

    it('should call peersLogic.create', async () => {
      const createSpy = sandbox.spy(peersLogic, 'create');
      await inst.getFromPeer(peer, options);
      expect(createSpy.called).to.be.true;
      expect(createSpy.firstCall.args.length).to.be.equal(1);
      expect(createSpy.firstCall.args[0]).to.be.deep.equal(peer);
    });

    it('should call popsicle"s methods', async () => {
      await inst.getFromPeer(peer, options);

      expect(popsicleStub.request.calledOnce).to.be.true;
      expect(popsicleStub.request.firstCall.args.length).to.be.equal(1);
      delete popsicleStub.request.firstCall.args[0].transport;
      expect(popsicleStub.request.firstCall.args[0]).to.be.deep.equal({
        body   : null,
        headers: {
          ...systemModule.headers,
          accept: 'application/octet-stream',
          'content-type': 'application/octet-stream',
        },
        method : 'put',
        timeout: 1000,
        url    : `http://127.0.0.1:${peer.port}url.com`,
      });

      expect(popsicleUseStub.use.calledOnce).to.be.true;
      expect(popsicleUseStub.use.firstCall.args.length).to.be.equal(1);
      expect(popsicleUseStub.use.firstCall.args[0]).to.be.a('function');
    });


    it('should call popsicle twice (retry) if rejects and return 2nd result', async function () {
      this.timeout(2100);
      const start = Date.now();
      popsicleUseStub.use.onFirstCall().rejects(error);
      popsicleUseStub.use.onSecondCall().resolves({ status: 500 });
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
      expect(removePeerStub.firstCall.args[0].peer.string).to.be.deep.equal(`127.0.0.1:${peer.port}`);
      expect(removePeerStub.firstCall.args[0].code).to.be.deep.equal('HTTPERROR');
      expect(removePeerStub.firstCall.args[1]).to.be.equal(error.message);
    });

    it('should call removePeer and return rejected promise if req.status !== 200', async () => {
      res.status = 609;
      popsicleUseStub.use.resolves(res);
      error = new Error(`Received bad response code ${res.status} ${res.method} ${res.url}`);

      await expect(inst.getFromPeer(peer, options)).to.be.rejectedWith(error.message);

      expect(removePeerStub.calledOnce).to.be.true;
      expect(removePeerStub.firstCall.args.length).to.be.equal(2);
      expect(removePeerStub.firstCall.args[0].peer.string).to.be.deep.equal(`127.0.0.1:${peer.port}`);
      expect(removePeerStub.firstCall.args[0].code).to.be.deep.equal(`ERESPONSE ${res.status}`);
      expect(removePeerStub.firstCall.args[1]).to.be.equal(`put http://127.0.0.1:${peer.port}url.com`);
    });
    //
    // it('should call thePeer.applyHeaders', async () => {
    //   await inst.getFromPeer(peer, options);
    //   expect(thePeer.applyHeaders.calledOnce);
    // });

    it('should validate response headers against schema and eventually removePeer', async () => {
      res.headers.nethash = 'meow';
      await expect(inst.getFromPeer(peer, options)).to.be
        .rejectedWith('Invalid response headers {"nethash":"meow","version":"1.1.1","port":' + peer.port + ',"height":100,"state":1} put http://127.0.0.1:' + peer.port + 'url.com');

      expect(removePeerStub.calledOnce).to.be.true;
      expect(removePeerStub.firstCall.args.length).to.be.equal(2);
      expect(removePeerStub.firstCall.args[0].code).eq('EHEADERS');
      expect(removePeerStub.firstCall.args[0].peer.string).to.be.deep.equal(`127.0.0.1:${peer.port}`);
      expect(removePeerStub.firstCall.args[0].code).to.be.deep.equal('EHEADERS');
      expect(removePeerStub.firstCall.args[1]).to.be.equal(`put http://127.0.0.1:${peer.port}url.com`);
    });

    it('should call removePeer and return rejected promise if systemModule.networkCompatible returned false', async () => {
      res.headers.nethash = Array(64).fill('a').join('');
      error               = new Error('Peer is not on the same network aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa put http://127.0.0.1:' + peer.port + 'url.com');
      await expect(inst.getFromPeer(peer, options)).to.be.rejectedWith(error.message);

      expect(removePeerStub.calledOnce).to.be.true;
      expect(removePeerStub.firstCall.args.length).to.be.equal(2);
      expect(removePeerStub.firstCall.args[0].peer.string).eq(`127.0.0.1:${peer.port}`);
      expect(removePeerStub.firstCall.args[0].code).eq('ENETHASH');
      expect(removePeerStub.firstCall.args[1]).to.be.equal(`put http://127.0.0.1:${peer.port}url.com`);
    });

    it('should call systemModule.versionCompatible', async () => {
      sandbox.stub(systemModule, 'versionCompatible').returns(false);
      await expect(inst.getFromPeer(peer, options))
        .to.be.rejectedWith('Peer is using incompatible version 1.1.1 put http://127.0.0.1:' + peer.port + 'url.com');
      expect(removePeerStub.calledOnce).to.be.true;
      expect(removePeerStub.firstCall.args.length).to.be.equal(2);
      expect(removePeerStub.firstCall.args[0].peer.string).eq(`127.0.0.1:${peer.port}`);
      expect(removePeerStub.firstCall.args[0].code).eq('EVERSION 1.1.1');
      expect(removePeerStub.firstCall.args[1]).to.be.equal(`put http://127.0.0.1:${peer.port}url.com`);
    });

    it('should call peersModule.update', async () => {
      const peersModuleUpdate = sandbox.stub(peersModule, 'update');
      await inst.getFromPeer(peer, options);

      expect(peersModuleUpdate.calledOnce).to.be.true;
      expect(peersModuleUpdate.firstCall.args.length).to.be.equal(1);
      expect(peersModuleUpdate.firstCall.args[0].string).to.be.equal(`127.0.0.1:${peer.port}`);
    });

    it('should return an object with body and peer properties if everything is ok', async () => {
      const target = await inst.getFromPeer(peer, options);
      expect(target.body).to.be.deep.equal(res.body);
      expect(target.peer.string).to.be.deep.equal(`127.0.0.1:${peer.port}`);
    });
  });

  describe('getFromRandomPeer', () => {

    let config;
    let peers;
    let result;
    let requestHandler;

    let getFromPeerStub;
    let peersModuleListStub;

    beforeEach(() => {
      requestHandler = new StubbedRequest();
      result         = 'hehehe';
      config         = {};
      peers          = [{ makeRequest: sandbox.stub().returns(result) }];

      peersModuleListStub = sandbox.stub(peersModule, 'list').resolves({ peers });
    });

    it('should call peersModule.list', async () => {
      await inst.getFromRandomPeer(config, requestHandler, {});

      expect(peersModuleListStub.calledOnce).to.be.true;
      expect(peersModuleListStub.firstCall.args.length).to.be.equal(1);
      expect(peersModuleListStub.firstCall.args[0]).to.be.deep.equal({
        allowedStates: [PeerState.CONNECTED, PeerState.DISCONNECTED],
        limit        : 1,
      });
    });

    it('should call makeRequest and return result', async () => {
      expect(await inst.getFromRandomPeer(config, requestHandler, {body: {my: 'payload'}} )).to.be.equal(result);
      expect(peers[0].makeRequest.calledOnce).to.be.true;
      expect(peers[0].makeRequest.firstCall.args.length).to.be.equal(2);
      expect(peers[0].makeRequest.firstCall.args[0]).deep.eq(requestHandler);
      expect(peers[0].makeRequest.firstCall.args[0]).to.be.instanceOf(StubbedRequest);
      expect(peers[0].makeRequest.firstCall.args[1]).deep.eq({body: {my: 'payload'}});
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
    let registerStub: SinonStub;
    let peerListStub: SinonStub;
    let pingRequest: PingRequest;
    beforeEach(() => {
      peers = [{
        makeRequest: sandbox.stub(),
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
      registerStub     = sandbox.stub(jobsQueue, 'register').callsArg(1);

      discoverPeersStub = sandbox.stub(inst as any, 'discoverPeers');
      peerListStub      = sandbox.stub(peersLogic, 'list').returns(peers);
      pingRequest = container.getNamed(p2pSymbols.transportMethod, p2pSymbols.requests.ping);
    });

    it('should call logger.trace', async () => {
      const loggerTraceStub = logger.stubs.trace;
      loggerTraceStub.resetHistory();
      await inst.onPeersReady();

      // use to async call of jobsQueue.register callback
      await new Promise((resolve) => setTimeout(resolve, 10));


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

    it('should call jobsQueue.register', async () => {
      await inst.onPeersReady();

      expect(registerStub.calledOnce).to.be.true;
      expect(registerStub.firstCall.args.length).to.be.equal(3);
      expect(registerStub.firstCall.args[0]).to.be.equal('peersDiscoveryAndUpdate');
      expect(registerStub.firstCall.args[1]).to.be.a('function');
      expect(registerStub.firstCall.args[2]).to.be.equal(5000);
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

      expect(peerListStub.calledOnce).to.be.true;
      expect(peerListStub.firstCall.args.length).to.be.equal(1);
      expect(peerListStub.firstCall.args[0]).to.be.equal(false);
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

        expect(peers[0].makeRequest.calledOnce).to.be.true;
        expect(peers[0].makeRequest.firstCall.args.length).to.be.equal(1);
        expect(peers[0].makeRequest.firstCall.args[0]).deep.eq(pingRequest);
      });

      it('should call pingAndUpdate(check on Date.now() - p.updated > 3000)', async () => {
        peers[0].updated = Date.now() - 3001;

        await inst.onPeersReady();
        await wait(10);
        expect(peers[0].makeRequest.calledOnce).to.be.true;
        expect(peers[0].makeRequest.firstCall.args[0]).deep.eq(pingRequest);
      });

      it('should call logger.debug if pingAndUpdate throw', async () => {
        const error = new Error('error');
        logger.stubs.debug.resetHistory();
        peers[0].makeRequest.rejects(error);

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
          logger.stubs.trace.resetHistory();
          await inst.onPeersReady();
          await wait(100);
          expect(logger.stubs.trace.callCount).to.be.equal(3);
        });

        it('p.state === PeerState.BANNED', async () => {
          peers[0].state = PeerState.BANNED;
          logger.stubs.trace.resetHistory();
          await inst.onPeersReady();
          await wait(10);
          expect(logger.stubs.trace.callCount).to.be.equal(3);
        });

        it('p.update is true and (Date.now() - p.updated) <= 3000', async () => {
          peers[0].updated = Date.now() - 2000;
          logger.stubs.trace.resetHistory();
          await inst.onPeersReady();
          await wait(10);

          expect(logger.stubs.trace.callCount).to.be.equal(3);
        });
      });
    });
  });

  // describe('onSignature', () => {
  //
  //   let broadcast;
  //   let signature;
  //
  //   beforeEach(() => {
  //     signature = { transaction: '1111111', signature: 'aaaabbbb' };
  //     broadcast = true;
  //     broadcasterLogic.enqueueResponse('maxRelays', false);
  //     broadcasterLogic.enqueueResponse('enqueue', false);
  //     (inst as any).appState = {get: () => 1000};
  //     const p = new PostSignaturesRequest();
  //     (inst as any).psrFactory = (a) => {
  //       p.options = a;
  //       return p;
  //     };
  //   });
  //
  //   it('should call broadcasterLogic.maxRelays', () => {
  //     inst.onSignature(signature, broadcast);
  //     expect(broadcasterLogic.stubs.maxRelays.calledOnce).to.be.true;
  //     expect(broadcasterLogic.stubs.maxRelays.firstCall.args.length).to.be.equal(1);
  //     expect(broadcasterLogic.stubs.maxRelays.firstCall.args[0]).to.be.deep.equal(signature);
  //   });
  //
  //   it('should call broadcasterLogic.enqueue', async () => {
  //     inst.onSignature(signature, broadcast);
  //
  //     expect(broadcasterLogic.stubs.enqueue.calledOnce).to.be.true;
  //     expect(broadcasterLogic.stubs.enqueue.firstCall.args.length).to.be.equal(2);
  //     expect(broadcasterLogic.stubs.enqueue.firstCall.args[0]).to.be.deep.equal({});
  //     expect(broadcasterLogic.stubs.enqueue.firstCall.args[1].requestHandler).to.be.instanceOf(PostSignaturesRequest);
  //     expect(broadcasterLogic.stubs.enqueue.firstCall.args[1].requestHandler.options).to.be.deep.equal({data: { signatures: [{
  //       relays: 1,
  //       signature: Buffer.from(signature.signature, 'hex'),
  //       transaction: signature.transaction,
  //     }] }});
  //   });
  //
  //   it('should call io.sockets.emit', async () => {
  //     inst.onSignature(signature, broadcast);
  //
  //     expect(io.sockets.emit.calledOnce).to.be.true;
  //     expect(io.sockets.emit.firstCall.args.length).to.be.equal(2);
  //     expect(io.sockets.emit.firstCall.args[0]).to.be.deep.equal('signature/change');
  //     expect(io.sockets.emit.firstCall.args[1]).to.be.deep.equal(signature);
  //   });
  //
  //   it('should not call broadcasterLogic.enqueue if broadcast is false', () => {
  //     broadcast = false;
  //
  //     inst.onSignature(signature, broadcast);
  //
  //     expect(broadcasterLogic.stubs.enqueue.notCalled).to.be.true;
  //   });
  //
  //   it('should not call broadcasterLogic.enqueue if this.broadcasterLogic.maxRelays returned true', () => {
  //     broadcasterLogic.reset();
  //     broadcasterLogic.enqueueResponse('maxRelays', true);
  //
  //     inst.onSignature(signature, broadcast);
  //
  //     expect(broadcasterLogic.stubs.enqueue.notCalled).to.be.true;
  //   });
  // });

  // TODO: lerna move to core-transactions
  // describe('onUnconfirmedTransaction', () => {
  //
  //   let broadcast;
  //   let transaction;
  //   let enqueueStub: SinonStub;
  //
  //   beforeEach(() => {
  //     transaction              = {};
  //     broadcast                = true;
  //     const p                  = new StubbedRequest();
  //     (inst as any).ptrFactory = (a) => {
  //       p.options = a;
  //       return p;
  //     };
  //     enqueueStub              = sandbox.stub(broadcasterLogic, 'enqueue');
  //   });
  //
  //   it('should NOT enqueue only if tx passed maxRelays', () => {
  //     transaction.relays = 1000;
  //     enqueueStub.resetHistory();
  //     inst.onUnconfirmedTransaction(transaction, broadcast);
  //     expect(enqueueStub.called).false;
  //   });
  //
  //   it('should call broadcasterLogic.enqueue', async () => {
  //     inst.onUnconfirmedTransaction(transaction, broadcast);
  //     expect(enqueueStub.called).true;
  //   });
  //   // TODO: Migrate to core-apis
  //   // it('should call io.sockets.emit', async () => {
  //   //   const emitStub = sandbox.stub(io.sockets, 'emit');
  //   //   inst.onUnconfirmedTransaction(transaction, broadcast);
  //   //   expect(emitStub.calledOnce).to.be.true;
  //   //   expect(emitStub.firstCall.args.length).to.be.equal(2);
  //   //   expect(emitStub.firstCall.args[0]).to.be.deep.equal('transactions/change');
  //   //   expect(emitStub.firstCall.args[1]).to.be.deep.equal(transaction);
  //   // });
  //
  //   it('should not call broadcasterLogic.enqueue if broadcast is false', () => {
  //     broadcast = false;
  //
  //     inst.onUnconfirmedTransaction(transaction, broadcast);
  //
  //     expect(enqueueStub.notCalled).to.be.true;
  //   });
  //
  //   it('should not call broadcasterLogic.enqueue if this.broadcasterLogic.maxRelays returned true', () => {
  //     inst.onUnconfirmedTransaction({ ...transaction, relays: broadcasterLogic.maxRelays() }, broadcast);
  //
  //     expect(enqueueStub.notCalled).to.be.true;
  //   });
  // });
  //
  // describe('onNewBlock', () => {
  //
  //   let broadcast;
  //   let block;
  //   let broadcastStub: SinonStub;
  //   let socketIOEmitStub: SinonStub;
  //   let maxRelaysSpy: SinonSpy;
  //
  //   beforeEach(() => {
  //     block                          = {
  //       blockSignature    : Buffer.from('aa', 'hex'),
  //       generatorPublicKey: Buffer.from('bb', 'hex'),
  //       payloadHash       : Buffer.from('cc', 'hex'),
  //       transactions      : [],
  //     };
  //     broadcast                      = true;
  //     systemModule.headers.broadhash = 'broadhash';
  //     broadcastStub                  = sandbox.stub(broadcasterLogic, 'broadcast').resolves();
  //     maxRelaysSpy                   = sandbox.spy(broadcasterLogic, 'maxRelays');
  //     socketIOEmitStub               = sandbox.stub(io.sockets, 'emit');
  //     const p                        = new StubbedRequest();
  //     (inst as any).pblocksFactory   = (a) => {
  //       p.options = a;
  //       return p;
  //     };
  //   });
  //
  //   // it('should call systemModule.update', async () => {
  //   //   await inst.onNewBlock(block, broadcast);
  //   //
  //   //   expect(systemModule.stubs.update.calledOnce).to.be.true;
  //   //   expect(systemModule.stubs.update.firstCall.args.length).to.be.equal(0);
  //   // });
  //
  //   it('should not call broadcast if relays exhausted', async () => {
  //     await inst.onNewBlock({ ...block, relays: 10 }, broadcast);
  //
  //     expect(maxRelaysSpy.calledOnce).to.be.true;
  //     expect(broadcastStub.called).false;
  //   });
  //
  //   it('should call broadcasterLogic.broadcast and increment relays', async () => {
  //     await inst.onNewBlock({ ...block, relays: 1 }, broadcast);
  //
  //     expect(broadcastStub.calledOnce).to.be.true;
  //     expect(broadcastStub.firstCall.args.length).to.be.equal(2);
  //     expect(broadcastStub.firstCall.args[0]).to.be.deep.equal({
  //       broadhash: 'broadhash',
  //       limit    : constants.maxPeers,
  //     });
  //     expect(broadcastStub.firstCall.args[1].requestHandler.options).to.be.deep.equal({
  //       data: {
  //         block: {
  //           blockSignature    : Buffer.from('aa', 'hex'),
  //           generatorPublicKey: Buffer.from('bb', 'hex'),
  //           payloadHash       : Buffer.from('cc', 'hex'),
  //           transactions      : [],
  //           relays            : 2
  //         },
  //       },
  //     });
  //   });
  //   // TODO: Migrate to core-apis
  //   // it('should call io.sockets.emit', async () => {
  //   //   await inst.onNewBlock(block, broadcast);
  //   //
  //   //   expect(socketIOEmitStub.calledOnce).to.be.true;
  //   //   expect(socketIOEmitStub.firstCall.args.length).to.be.equal(2);
  //   //   expect(socketIOEmitStub.firstCall.args[0]).to.be.deep.equal('blocks/change');
  //   //   expect(socketIOEmitStub.firstCall.args[1]).to.be.deep.equal(block);
  //   // });
  //
  //   it('should not call broadcasterLogic.broadcast if broadcasterLogic.maxRelays returns true', async () => {
  //
  //     await inst.onNewBlock({ ...block, relays: broadcasterLogic.maxRelays() }, broadcast);
  //
  //     expect(broadcastStub.notCalled).to.be.true;
  //   });
  //
  //   it('check if broadcast is false', () => {
  //     broadcast = false;
  //
  //     const p = inst.onNewBlock(block, broadcast);
  //
  //     expect(p).to.be.fulfilled;
  //     expect(broadcastStub.notCalled).to.be.true;
  //   });
  //   it('should ignore broadcast error if any and, more importantly avoid waiting for broadcaster result', async () => {
  //     let finished  = false;
  //     const promise = wait(1000)
  //       .then(() => finished = true);
  //
  //     broadcastStub.returns(promise);
  //
  //     await inst.onNewBlock(block, true);
  //     expect(finished).to.be.false;
  //     await promise;
  //   });
  // });
  /*
       // describe('receiveSignatures', () => {
       //
       //   let receiveSignatureStub: SinonStub;
       //   let query;
       //
       //   beforeEach(() => {
       //     query                = [{ transaction: 'transaction', signature: 'signature' }];
       //     receiveSignatureStub = sandbox.stub(inst as any, 'receiveSignature');
       //   });
       //
       //   it('should call receiveSignature', async () => {
       //     await inst.receiveSignatures(query);
       //
       //     expect(receiveSignatureStub.calledOnce).to.be.true;
       //     expect(receiveSignatureStub.firstCall.args.length).to.be.equal(1);
       //     expect(receiveSignatureStub.firstCall.args[0]).to.be.deep.equal(query[0]);
       //   });
       //
       //   it('should call logger.debug if receiveSignature throw error', async () => {
       //     const error = new Error('error');
       //     receiveSignatureStub.rejects(error);
       //
       //     await inst.receiveSignatures(query);
       //
       //     expect(logger.stubs.debug.calledOnce).to.be.true;
       //     expect(logger.stubs.debug.firstCall.args.length).to.be.equal(2);
       //     expect(logger.stubs.debug.firstCall.args[0]).to.be.equal(error);
       //     expect(logger.stubs.debug.firstCall.args[1]).to.be.deep.equal(query[0]);
       //   });
       // });

       // describe('receiveSignature', () => {
       //
       //   let signature;
       //
       //   beforeEach(() => {
       //     signature = { transaction: 'transaction', signature: 'signature' };
       //
       //     multisigModule.enqueueResponse('processSignature', Promise.resolve());
       //   });
       //
       //   it('should call multisigModule.processSignature', async () => {
       //     await inst.receiveSignature(signature);
       //
       //     expect(multisigModule.stubs.processSignature.calledOnce).to.be.true;
       //     expect(multisigModule.stubs.processSignature.firstCall.args.length).to.be.equal(1);
       //     expect(multisigModule.stubs.processSignature.firstCall.args[0]).to.be.deep.equal(signature);
       //   });
       //
       //   it('should throw error multisigModule.processSignature throw error', async () => {
       //     const error = new Error('error');
       //     multisigModule.reset();
       //     multisigModule.enqueueResponse('processSignature', Promise.reject(error));
       //
       //     await  expect(inst.receiveSignature(signature)).to.be.rejectedWith('Error processing signature: error');
       //   });
       // });

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
           expect(schemaStub.stubs.validate.firstCall.args[0]).to.be.equal(response);
           expect(schemaStub.stubs.validate.firstCall.args[1]).to.be.equal(peersSchema.discover.peers);
           expect(schemaStub.stubs.validate.firstCall.args[2]).to.be.a('function');
         });

         it('should call peersLogic.acceptable', async () => {
           await (inst as any).discoverPeers();

           expect(peersLogic.stubs.acceptable.calledOnce).to.be.true;
           expect(peersLogic.stubs.acceptable.firstCall.args.length).to.be.equal(1);
           expect(peersLogic.stubs.acceptable.firstCall.args[0]).to.be.equal(response.peers);
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
     */
});
