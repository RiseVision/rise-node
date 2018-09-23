import * as chai from 'chai';
import {Container} from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { Symbols } from '../../../src/ioc/symbols';
import { PeerLogic } from '../../../src/logic';
import { PeersLogic } from '../../../src/logic';
import { AppConfig } from '../../../src/types/genericTypes';
import { LoggerStub, PeerLogicStub, SystemModuleStub } from '../../stubs';
import { createContainer } from '../../utils/containerCreator';

const expect = chai.expect;

// tslint:disable no-unused-expression
describe('logic/peers', () => {
  let instance: PeersLogic;
  let loggerStub: LoggerStub;
  let peerLogicStub: PeerLogicStub;
  let systemModuleStub: SystemModuleStub;
  let peersFactoryStub: SinonStub;
  let container: Container;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    container = createContainer();
    loggerStub = container.get(Symbols.helpers.logger);
    peerLogicStub = new PeerLogicStub();
    systemModuleStub = container.get(Symbols.modules.system);
    peersFactoryStub = sandbox.stub().returns(peerLogicStub);
    instance = new PeersLogic();
    (instance as any).config = container.get(Symbols.generic.appConfig);
    (instance as any).logger = loggerStub;
    (instance as any).peersFactory = peersFactoryStub;
    (instance as any).systemModule = systemModuleStub;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('create', () => {
    it('should call peersFactory if a plain object is passed', () => {
      const peerObj = { test: 'test'};
      const retVal = instance.create(peerObj as any);
      expect(peersFactoryStub.called).to.be.true;
      expect(peersFactoryStub.firstCall.args[0]).to.be.deep.equal(peerObj);
      expect(retVal).to.be.deep.equal(peerLogicStub);
    });
    it('should not call peersFactory peer is instanceof PeerLogic', () => {
      const peerObj = new PeerLogic();
      const retVal = instance.create(peerObj);
      expect(peersFactoryStub.notCalled).to.be.true;
      expect(retVal).to.be.deep.equal(peerObj);
    });
  });

  describe('exists', () => {
    it('should return true if the peer exists', () => {
      (instance as any).peers[peerLogicStub.defaults.string] = peerLogicStub;
      expect(instance.exists(peerLogicStub)).to.equal(true);
    });

    it('should return false if the peer does not exist', () => {
      const retVal = instance.exists(peerLogicStub);
      expect(retVal).to.equal(false);
    });
  });

  describe('get', () => {
    it('should return peer if passed string', () => {
      (instance as any).peers[peerLogicStub.defaults.string] = peerLogicStub;
      const retVal = instance.get(peerLogicStub.defaults.string);
      expect(retVal).to.deep.equal(peerLogicStub);
    });

    it('should return undefined if peer not found', () => {
      expect(instance.get('nonExistingPeer')).to.be.undefined;
    });

    it('should call this.create if a non-string is passed', () => {
      const createSpy = sinon.spy(instance, 'create');
      instance.get({test: 'test'} as any);
      expect(createSpy.called).to.be.true;
      expect(createSpy.firstCall.args[0]).to.be.deep.equal({test: 'test'});
      createSpy.restore();
    });
  });

  describe('upsert', () => {
    let createStub: SinonStub;
    let existsStub: SinonStub;
    let acceptableStub: SinonStub;

    beforeEach(() => {
      createStub = sinon.stub(instance, 'create').returns(peerLogicStub);
      existsStub = sinon.stub(instance, 'exists');
      acceptableStub = sinon.stub(instance, 'acceptable');
    });

    afterEach(() => {
      createStub.restore();
      existsStub.restore();
      acceptableStub.restore();
    });

    it('should call create to normalize peer', () => {
      instance.upsert({} as any, true);
      expect(createStub.called).to.be.true;
    });

    it('it should return false if peer exists and insertOnly=true', () => {
      existsStub.returns(true);
      const retVal = instance.upsert({} as any, true);
      expect(createStub.calledOnce).to.equal(true);
      expect(createStub.firstCall.args[0]).to.deep.equal({});
      expect(retVal).to.equal(false);
    });

    it('should call update on peer and return false if peer exists and, insertOnly=false', () => {
      existsStub.returns(true);
      (instance as any).peers[peerLogicStub.defaults.string] = peerLogicStub;
      const retVal = instance.upsert(peerLogicStub, false);
      expect(peerLogicStub.stubs.update.calledOnce).to.be.true;
      expect(retVal).to.equal(true);
    });

    it ('should call logger.debug if peer has changed', () => {
      existsStub.returns(true);
      (instance as any).peers[peerLogicStub.defaults.string] = peerLogicStub;
      // newPeer.string == peerLogicStub.string
      const newPeer = new PeerLogicStub();
      // modify one of the default values
      newPeer.ip = newPeer.ip + '0';
      // make sure that create() doesn't modify our passed peer
      createStub.returns(newPeer);
      instance.upsert(newPeer, false);
      expect(loggerStub.stubs.debug.called).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args[1].ip).to.be.deep.equal(newPeer.ip);
    });

    it ('should call logger.trace if peer has NOT changed', () => {
      existsStub.returns(true);
      (instance as any).peers[peerLogicStub.defaults.string] = peerLogicStub;
      instance.upsert(peerLogicStub, false);
      expect(loggerStub.stubs.trace.called).to.be.true;
      expect(loggerStub.stubs.trace.firstCall.args[1]).to.be.deep.equal(peerLogicStub.string);
    });

    it('should call wasRecentlyRemoved', () => {
      existsStub.returns(false);
      const wasRecentlyRemovedSpy = sinon.spy(instance as any, 'wasRecentlyRemoved');
      instance.upsert(peerLogicStub, false);
      expect(wasRecentlyRemovedSpy.calledOnce).to.be.true;
      expect(wasRecentlyRemovedSpy.firstCall.args.length).to.be.equal(1);
      expect(wasRecentlyRemovedSpy.firstCall.args[0]).to.be.deep.equal(peerLogicStub);
      wasRecentlyRemovedSpy.restore();
    });

    it('should not insert the peer if it was recently removed and return false', () => {
      existsStub.returns(false);
      acceptableStub.returns([peerLogicStub]);
      instance.upsert(peerLogicStub, true);
      // Make sure it was inserted
      expect((instance as any).peers[peerLogicStub.string]).to.be.deep.equal(peerLogicStub);
      existsStub.returns(true);
      instance.remove(peerLogicStub);
      // Make sure it was removed
      expect((instance as any).peers).to.be.deep.equal({});
      existsStub.returns(false);
      acceptableStub.returns([peerLogicStub]);
      instance.upsert(peerLogicStub, true);
      expect(instance.upsert(peerLogicStub, true)).to.be.equal(false);
      // Make sure it was not added
      expect((instance as any).peers).to.be.deep.equal({});
    });

    it('should not insert the peer and call logger.debug if this.acceptable([thePeer]) returns empty array', () => {
      existsStub.returns(false);
      acceptableStub.returns([]);
      instance.upsert(peerLogicStub, false);
      expect(createStub.calledOnce).to.equal(true);
      expect(createStub.firstCall.args[0]).to.deep.equal(peerLogicStub);
      expect(loggerStub.stubs.debug.calledOnce).to.equal(true);
      expect(loggerStub.stubs.debug.firstCall.args.length).to.equal(2);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.equal('Rejecting unacceptable peer');
      expect((instance as any).peers).to.be.deep.equal({});
    });

    it('should insert the peer and call logger.debug if this.acceptable([thePeer]) returns our peer', () => {
      existsStub.returns(false);
      acceptableStub.returns([peerLogicStub]);
      instance.upsert(peerLogicStub, false);
      expect(createStub.calledOnce).to.equal(true);
      expect(createStub.firstCall.args[0]).to.deep.equal(peerLogicStub);
      expect(loggerStub.stubs.debug.calledOnce).to.equal(true);
      expect(loggerStub.stubs.debug.firstCall.args.length).to.equal(2);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.equal('Inserted new peer');
      expect(loggerStub.stubs.debug.firstCall.args[1]).to.equal(peerLogicStub.string);
      const expectedPeers = {};
      expectedPeers[peerLogicStub.string] = peerLogicStub;
      expect((instance as any).peers).to.be.deep.equal(expectedPeers);
    });

    it('should call logger.trace with PeerStats', () => {
      existsStub.returns(false);
      acceptableStub.returns([peerLogicStub]);
      instance.upsert(peerLogicStub, false);
      expect(loggerStub.stubs.trace.calledOnce).to.equal(true);
      expect(loggerStub.stubs.trace.firstCall.args[0]).to.equal('PeerStats');
      expect(loggerStub.stubs.trace.firstCall.args[1]).to.deep.equal({
        alive         : 1,
        emptyBroadhash: 0,
        emptyHeight   : 0,
        total         : 1,
      });
    });

    it('should call logger.trace with PeerStats without height and broadhash fields', () => {
      delete (peerLogicStub as any).height;
      delete (peerLogicStub as any).broadhash;
      existsStub.returns(false);
      acceptableStub.returns([peerLogicStub]);
      instance.upsert(peerLogicStub, false);
      expect(loggerStub.stubs.trace.calledOnce).to.equal(true);
      expect(loggerStub.stubs.trace.firstCall.args[0]).to.equal('PeerStats');
      expect(loggerStub.stubs.trace.firstCall.args[1]).to.deep.equal({
        alive         : 1,
        emptyBroadhash: 1,
        emptyHeight   : 1,
        total         : 1,
      });
    });
  });

  describe('remove', () => {
    let existsStub: SinonStub;
    let createStub: SinonStub;
    beforeEach(() => {
      existsStub = sinon.stub(instance, 'exists');
      createStub = sinon.stub(instance, 'create').returns(peerLogicStub);
    });

    afterEach(() => {
      existsStub.restore();
      createStub.restore();
    });
    it('should call logger.debug and return false if not exists', () => {
      existsStub.returns(false);
      const retVal = instance.remove(peerLogicStub);
      expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.eq('Failed to remove peer');
      expect(retVal).to.be.false;
    });

    it('should add the time of removal to the lastRemoved list', () => {
      existsStub.returns(true);
      (instance as any).peers[peerLogicStub.defaults.string] = peerLogicStub;
      instance.remove(peerLogicStub);
      expect((instance as any).lastRemoved[peerLogicStub.string]).to.exist;
      expect((instance as any).lastRemoved[peerLogicStub.string]).to.be.lte(Date.now());
      expect((instance as any).lastRemoved[peerLogicStub.string]).to.be.gt(Date.now() - 1000);
    });

    it('should remove the peer from the list if exists', () => {
      existsStub.returns(true);
      (instance as any).peers[peerLogicStub.defaults.string] = peerLogicStub;
      const toRet = instance.remove(peerLogicStub);
      expect((instance as any).peers).to.be.deep.equal({});
      expect(toRet).to.be.eq(true);
    });

  });

  describe('list', () => {
    it('should return objects intact if normalize is false', () => {
      (instance as any).peers.a = 'b';
      (instance as any).peers.b = 'c';

      // no transformations!
      expect((instance as any).list(false)).to.be.deep.eq(['b', 'c']);
    });
    it('should call object on each peer if normalize is true', () => {
      (instance as any).peers.a = { object: sinon.stub().returns('b') };
      (instance as any).peers.b = { object: sinon.stub().returns('c') };

      // no transformations!
      expect((instance as any).list(true)).to.be.deep.eq(['b', 'c']);
      expect((instance as any).peers.a.object.calledOnce).is.true;
      expect((instance as any).peers.b.object.calledOnce).is.true;
    });
  });

  describe('acceptable', () => {
    beforeEach(() => {
      systemModuleStub.stubs.versionCompatible.returns(true);
    });
    it('should call systemModule.getNonce if ip is not private', () => {
      // non-private ip
      peerLogicStub.ip = '8.8.8.8';
      instance.acceptable([peerLogicStub]);
      expect(systemModuleStub.stubs.getNonce.called).to.be.true;
    });

    it('should call systemModule.getNonce if NODE_ENV === TEST', () => {
      const tmp = process.env.NODE_ENV;
      process.env.NODE_ENV = 'TEST';
      instance.acceptable([peerLogicStub]);
      expect(systemModuleStub.stubs.getNonce.called).to.be.true;
      process.env.NODE_ENV = tmp;
    });

    it('should filter out peers with same ip', () => {
      systemModuleStub.enqueueResponse('getNonce', 'otherValue');
      const peer1 = new PeerLogicStub();
      const peer2 = new PeerLogicStub();
      peer1.ip = '8.8.8.8';
      peer2.ip = '8.8.8.8';
      const retVal = instance.acceptable([peer1, peer2]);
      expect(retVal).to.be.deep.equal([peer1]);
    });
    it('should filter out peers with incompatible version', () => {
      systemModuleStub.enqueueResponse('getNonce', 'otherValue');
      const peer1 = new PeerLogicStub();
      const peer2 = new PeerLogicStub();
      peer1.ip = '8.8.8.8';
      peer2.ip = '8.8.8.7';
      systemModuleStub.stubs.versionCompatible.onSecondCall().returns(false);
      const retVal = instance.acceptable([peer1, peer2]);
      expect(retVal).to.be.deep.eq([peer1]);

    });
    it('should filter out peers with my same nonce', () => {
      systemModuleStub.enqueueResponse('getNonce', 'systemNonce');

      peerLogicStub.ip = '8.8.8.8';
      peerLogicStub.nonce = 'systemNonce';
      const retVal = instance.acceptable([peerLogicStub]);
      expect(retVal).to.be.deep.equal([]);
    });
  });

  describe('wasRecentlyRemoved', () => {
    let config: AppConfig;
    beforeEach(() => {
      config = container.get(Symbols.generic.appConfig);
    });
    it('should return false if peer is not in lastRemoved ', () => {
      (instance as any).lastRemoved = {};
      expect((instance as any).wasRecentlyRemoved(peerLogicStub)).to.be.false;
    });

    it('should return true if removal was less than 15 minutes ago', () => {
      (instance as any).lastRemoved = {};
      (instance as any).lastRemoved[peerLogicStub.string] = Date.now() - config.peers.banTime + 1000;
      expect((instance as any).wasRecentlyRemoved(peerLogicStub)).to.be.true;
    });

    it('should return false if removal was more than 15 minutes ago', () => {
      (instance as any).lastRemoved = {};
      (instance as any).lastRemoved[peerLogicStub.string] = Date.now() - config.peers.banTime - 1000;
      expect((instance as any).wasRecentlyRemoved(peerLogicStub)).to.be.false;
    });
  });
});
