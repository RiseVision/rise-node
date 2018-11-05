import * as chai from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { P2pConfig, p2pSymbols, Peer, PeersLogic } from '../../src';
import { SystemModule } from '@risevision/core';
import { LoggerStub } from '@risevision/core-utils/tests/unit/stubs';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { Symbols } from '@risevision/core-interfaces';

const expect = chai.expect;

// tslint:disable no-unused-expression
describe('logic/peers', () => {
  let instance: PeersLogic;
  let loggerStub: LoggerStub;
  let peerLogicStub: Peer;
  let systemModuleStub: SystemModule;
  let peersFactoryStub: SinonStub;
  let container: Container;
  let sandbox: SinonSandbox;
  before(async () => {
    container = await createContainer([
      'core-p2p',
      'core-helpers',
      'core-crypto',
      'core-blocks',
      'core-transactions',
      'core',
      'core-accounts',
    ]);
    container.get(p2pSymbols.logic.peersLogic); // Should not throw
    container.rebind(p2pSymbols.logic.peersLogic).to(PeersLogic);
  });
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    peerLogicStub = new Peer();
    peersFactoryStub = sandbox.stub().returns(peerLogicStub);
    container
      .rebind(p2pSymbols.logic.peerFactory)
      .toConstantValue(peersFactoryStub);
    loggerStub = container.get(Symbols.helpers.logger);
    systemModuleStub = container.get(Symbols.modules.system);
    instance = container.get(p2pSymbols.logic.peersLogic);
  });

  afterEach(() => {
    sandbox.restore();
    loggerStub.stubReset();
  });

  describe('create', () => {
    it('should call peersFactory if a plain object is passed', () => {
      const peerObj = { test: 'test' };
      const retVal = instance.create(peerObj as any);
      expect(peersFactoryStub.called).to.be.true;
      expect(peersFactoryStub.firstCall.args[0]).to.be.deep.equal(peerObj);
      expect(retVal).to.be.deep.equal(peerLogicStub);
    });
    it('should not call peersFactory peer is instanceof Peer', () => {
      const peerObj = new Peer();
      const retVal = instance.create(peerObj);
      expect(peersFactoryStub.notCalled).to.be.true;
      expect(retVal).to.be.deep.equal(peerObj);
    });
  });

  describe('exists', () => {
    it('should return true if the peer exists', () => {
      (instance as any).peers[peerLogicStub.string] = peerLogicStub;
      expect(instance.exists(peerLogicStub)).to.equal(true);
    });

    it('should return false if the peer does not exist', () => {
      const retVal = instance.exists(peerLogicStub);
      expect(retVal).to.equal(false);
    });
  });

  describe('get', () => {
    it('should return peer if passed string', () => {
      (instance as any).peers[peerLogicStub.string] = peerLogicStub;
      const retVal = instance.get(peerLogicStub.string);
      expect(retVal).to.deep.equal(peerLogicStub);
    });

    it('should return undefined if peer not found', () => {
      expect(instance.get('nonExistingPeer')).to.be.undefined;
    });

    it('should call this.create if a non-string is passed', () => {
      const createSpy = sinon.spy(instance, 'create');
      instance.get({ test: 'test' } as any);
      expect(createSpy.called).to.be.true;
      expect(createSpy.firstCall.args[0]).to.be.deep.equal({ test: 'test' });
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
      const updateStub = sandbox.stub(peerLogicStub, 'update');
      (instance as any).peers[peerLogicStub.string] = peerLogicStub;
      const retVal = instance.upsert(peerLogicStub, false);
      expect(updateStub.calledOnce).to.be.true;
      expect(retVal).to.equal(true);
    });

    it('should call logger.debug if peer has changed', () => {
      existsStub.returns(true);
      (instance as any).peers[peerLogicStub.string] = peerLogicStub;
      // newPeer.string == peerLogicStub.string
      const newPeer = new Peer();
      // modify one of the default values
      newPeer.ip = newPeer.ip + '0';
      // make sure that create() doesn't modify our passed peer
      createStub.returns(newPeer);
      instance.upsert(newPeer, false);
      expect(loggerStub.stubs.debug.called).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args[1].ip).to.be.deep.equal(
        newPeer.ip
      );
    });

    it('should call logger.trace if peer has NOT changed', () => {
      existsStub.returns(true);
      (instance as any).peers[peerLogicStub.string] = peerLogicStub;
      instance.upsert(peerLogicStub, false);
      expect(loggerStub.stubs.trace.called).to.be.true;
      expect(loggerStub.stubs.trace.firstCall.args[1]).to.be.deep.equal(
        peerLogicStub.string
      );
    });

    it('should call wasRecentlyRemoved', () => {
      existsStub.returns(false);
      const wasRecentlyRemovedSpy = sinon.spy(
        instance as any,
        'wasRecentlyRemoved'
      );
      instance.upsert(peerLogicStub, false);
      expect(wasRecentlyRemovedSpy.calledOnce).to.be.true;
      expect(wasRecentlyRemovedSpy.firstCall.args.length).to.be.equal(1);
      expect(wasRecentlyRemovedSpy.firstCall.args[0]).to.be.deep.equal(
        peerLogicStub
      );
      wasRecentlyRemovedSpy.restore();
    });

    it('should not insert the peer if it was recently removed and return false', () => {
      existsStub.returns(false);
      acceptableStub.returns([peerLogicStub]);
      instance.upsert(peerLogicStub, true);
      // Make sure it was inserted
      expect((instance as any).peers[peerLogicStub.string]).to.be.deep.equal(
        peerLogicStub
      );
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

    it('should not insert the peer if this.acceptable([thePeer]) returns empty array', () => {
      existsStub.returns(false);
      acceptableStub.returns([]);
      instance.upsert(peerLogicStub, false);
      expect(createStub.calledOnce).to.equal(true);
      expect(createStub.firstCall.args[0]).to.deep.equal(peerLogicStub);
      expect((instance as any).peers).to.be.deep.equal({});
    });

    it('should insert the peer  if this.acceptable([thePeer]) returns our peer', () => {
      existsStub.returns(false);
      acceptableStub.returns([peerLogicStub]);
      instance.upsert(peerLogicStub, false);
      expect(createStub.calledOnce).to.equal(true);
      expect(createStub.firstCall.args[0]).to.deep.equal(peerLogicStub);
      const expectedPeers = {};
      expectedPeers[peerLogicStub.string] = peerLogicStub;
      expect((instance as any).peers).to.be.deep.equal(expectedPeers);
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
      expect(retVal).to.be.false;
    });

    it('should add the time of removal to the lastRemoved list', () => {
      existsStub.returns(true);
      (instance as any).peers[peerLogicStub.string] = peerLogicStub;
      instance.remove(peerLogicStub);
      expect((instance as any).lastRemoved[peerLogicStub.string]).to.exist;
      expect((instance as any).lastRemoved[peerLogicStub.string]).to.be.lte(
        Date.now()
      );
      expect((instance as any).lastRemoved[peerLogicStub.string]).to.be.gt(
        Date.now() - 1000
      );
    });

    it('should remove the peer from the list if exists', () => {
      existsStub.returns(true);
      (instance as any).peers[peerLogicStub.string] = peerLogicStub;
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
    let versionCompatibleStub: SinonStub;
    let getNonceStub: SinonStub;
    beforeEach(() => {
      versionCompatibleStub = sandbox
        .stub(systemModuleStub, 'versionCompatible')
        .returns(true);
      getNonceStub = sandbox.stub(systemModuleStub, 'getNonce');
    });
    it('should call systemModule.getNonce if ip is not private', () => {
      // non-private ip
      peerLogicStub.ip = '8.8.8.8';
      instance.acceptable([peerLogicStub]);
      expect(getNonceStub.called).to.be.true;
    });

    it('should call systemModule.getNonce if NODE_ENV === TEST', () => {
      const tmp = process.env.NODE_ENV;
      process.env.NODE_ENV = 'TEST';
      instance.acceptable([peerLogicStub]);
      expect(getNonceStub.called).to.be.true;
      process.env.NODE_ENV = tmp;
    });

    it('should filter out peers with same ip', () => {
      getNonceStub.returns('otherValue');
      const peer1 = new Peer();
      const peer2 = new Peer();
      peer1.ip = '8.8.8.8';
      peer2.ip = '8.8.8.8';
      const retVal = instance.acceptable([peer1, peer2]);
      expect(retVal).to.be.deep.equal([peer1]);
    });
    it('should filter out peers with incompatible version', () => {
      getNonceStub.returns('otherValue');
      const peer1 = new Peer();
      const peer2 = new Peer();
      peer1.ip = '8.8.8.8';
      peer2.ip = '8.8.8.7';
      versionCompatibleStub.onSecondCall().returns(false);
      const retVal = instance.acceptable([peer1, peer2]);
      expect(retVal).to.be.deep.eq([peer1]);
    });
    it('should filter out peers with my same nonce', () => {
      getNonceStub.returns('systemNonce');

      peerLogicStub.ip = '8.8.8.8';
      peerLogicStub.nonce = 'systemNonce';
      const retVal = instance.acceptable([peerLogicStub]);
      expect(retVal).to.be.deep.equal([]);
    });
  });

  describe('wasRecentlyRemoved', () => {
    let config: P2pConfig;
    beforeEach(() => {
      config = container.get(Symbols.generic.appConfig);
    });
    it('should return false if peer is not in lastRemoved ', () => {
      (instance as any).lastRemoved = {};
      expect((instance as any).wasRecentlyRemoved(peerLogicStub)).to.be.false;
    });

    it('should return true if removal was less than 15 minutes ago', () => {
      (instance as any).lastRemoved = {};
      (instance as any).lastRemoved[peerLogicStub.string] =
        Date.now() - config.peers.banTime + 1000;
      expect((instance as any).wasRecentlyRemoved(peerLogicStub)).to.be.true;
    });

    it('should return false if removal was more than 15 minutes ago', () => {
      (instance as any).lastRemoved = {};
      (instance as any).lastRemoved[peerLogicStub.string] =
        Date.now() - config.peers.banTime - 1000;
      expect((instance as any).wasRecentlyRemoved(peerLogicStub)).to.be.false;
    });
  });
});
