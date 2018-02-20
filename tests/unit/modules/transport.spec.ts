import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container, postConstruct } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { Symbols } from '../../../src/ioc/symbols';
import { TransportModule } from '../../../src/modules/transport';
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
import { IAppState } from '../../../src/ioc/interfaces/logic';
import * as Throttle from 'promise-parallel-throttle';
import { PeerState } from '../../../src/logic';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
// tslint:disable no-unused-expression max-line-length

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
    container.rebind(Symbols.modules.transport).to(TransportModule);
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
    appState.stubs.setComputed.callsArgWith(1, postConstrA);
    appState.enqueueResponse('setComputed', true);
    postConstrA.enqueueResponse('get', 5);
    postConstrA.enqueueResponse('get', 5);

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

    let removePeerStub: SinonStub;

    beforeEach(() => {
      peer    = {};
      options = {
        method: 'put',
        url   : 'url.com',
      };
      thePeer = { applyHeaders: sandbox.stub() };
      peersLogic.enqueueResponse('create', thePeer);
      removePeerStub = sandbox.stub(inst as any, 'removePeer');
      //TODO create popsicle stubs
    });

    it('should call peersLogic.create');
    it('should call popsicle"s methods');
    it('check if options.api');
    it('check if options.data');
    it('should call removePeer and return rejected promise if popsicle throw');
    it('should call removePeer and return rejected promise if req.status !== 200');
    it('should call thePeer.applyHeaders');
    it('should call schema.validate');
    it('should call removePeer and return rejected promise if schema.validate returned false');
    it('should call systemModule.networkCompatible');
    it('should call removePeer and return rejected promise if systemModule.networkCompatible returned false');
    it('should call systemModule.versionCompatible');
    it('should call removePeer and return rejected promise if systemModule.versionCompatible returned false');
    it('should call peersModule.update');
    it('success');

  });

  describe('getFromRandomPeer', () => {
    it('should call peersModule.list');
    it('should call getFromPeer and return result');
  });

  describe('cleanup', () => {
    it('should set loaded in false and return promise.resolve');
  });

  describe('onBlockchainReady', () => {
    it('should set loaded in true');
  });

  describe('onPeersReady', () => {

    it('should call logger.trace');
    it('should call jobsQueue.register');
    it('should call discoverPeers');
    it('should call logger.error if discoverPeers throw');
    it('should call peersLogic.list');
    it('should call logger.trace with count info');
    it('should call Throttle.all');
    describe('Throttle.all"s callback(for each peer in peers)', () => {
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
    it('should call broadcasterLogic.maxRelays');
    it('should call broadcasterLogic.enqueue');
    it('should call io.sockets.emit');
    it('should not call broadcasterLogic.enqueue if broadcast is false');
    it('should not call broadcasterLogic.enqueue if this.broadcasterLogic.maxRelays returned true');
  });

  describe('onUnconfirmedTransaction', () => {
    it('should call broadcasterLogic.maxRelays');
    it('should call broadcasterLogic.enqueue');
    it('should call io.sockets.emit');
    it('should not call broadcasterLogic.enqueue if broadcast is false');
    it('should not call broadcasterLogic.enqueue if this.broadcasterLogic.maxRelays returned true');
  });

  describe('onNewBlock', () => {

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

  });

  describe('discoverPeers', () => {

  });

});
