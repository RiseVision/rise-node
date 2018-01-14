import * as chai from 'chai';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { PeersLogic } from '../../../src/logic';
import { LoggerStub, PeerLogicStub, SystemModuleStub } from '../../stubs';

const expect = chai.expect;

// tslint:disable no-unused-expression
describe('logic/peers', () => {
  let instance: PeersLogic;
  let loggerStub: LoggerStub;
  let peerLogicStub: PeerLogicStub;
  let systemModuleStub: SystemModuleStub;
  let peersFactoryStub: SinonStub;

  beforeEach(() => {
    loggerStub = new LoggerStub();
    instance = new PeersLogic();
    peerLogicStub = new PeerLogicStub();
    systemModuleStub = new SystemModuleStub();
    peersFactoryStub = sinon.stub().returns(peerLogicStub);
    (instance as any).logger = loggerStub;
    (instance as any).peersFactory = peersFactoryStub;
    (instance as any).systemModule = systemModuleStub;
  });

  describe('create', () => {
    it('should call peersFactory if a plain object is passed', () => {
      const peerObj = { test: 'test'};
      const retVal = instance.create(peerObj as any);
      expect(peersFactoryStub.called).to.be.true;
      expect(peersFactoryStub.firstCall.args[0]).to.be.deep.equal(peerObj);
      expect(retVal).to.be.deep.equal(peerLogicStub);
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
      systemModuleStub.stubConfig.getNonce.return = 'otherValue';
      const peer1 = new PeerLogicStub();
      const peer2 = new PeerLogicStub();
      peer1.ip = '8.8.8.8';
      peer2.ip = '8.8.8.8';
      const retVal = instance.acceptable([peer1, peer2]);
      expect(retVal).to.be.deep.equal([peer1]);
    });

    it('should filter out peers with my same nonce', () => {
      systemModuleStub.stubConfig.getNonce.return = 'systemNonce';
      peerLogicStub.ip = '8.8.8.8';
      peerLogicStub.nonce = 'systemNonce';
      const retVal = instance.acceptable([peerLogicStub]);
      expect(retVal).to.be.deep.equal([]);
    });
  });
});
