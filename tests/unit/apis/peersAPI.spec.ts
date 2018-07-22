import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { PeersAPI } from '../../../src/apis';
import { Symbols } from '../../../src/ioc/symbols';
import { PeerState } from '../../../src/logic/';
import { PeersModuleStub, SystemModuleStub } from '../../stubs';
import { createContainer } from '../../utils/containerCreator';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/peersAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: any;
  let result: any;
  const versionBuild = '1.2.3';
  let peersModuleStub: PeersModuleStub;
  let systemModuleStub: SystemModuleStub;

  beforeEach(() => {
    container = createContainer();
    sandbox = sinon.createSandbox();
    container.bind(Symbols.generic.versionBuild).toConstantValue(versionBuild);
    container
      .bind(Symbols.api.peers)
      .to(PeersAPI)
      .inSingletonScope();
    peersModuleStub = container.get(Symbols.modules.peers);
    peersModuleStub.enqueueResponse('getByFilter', [{object: () => ({ hello: 'world' })}]);
    systemModuleStub = container.get(Symbols.modules.system);
    systemModuleStub.enqueueResponse('getMinVersion', '1.0');
    instance = container.get(Symbols.api.peers);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('getPeers()', () => {
    it('Failed to get peers', async () => {
      peersModuleStub.stubs.getByFilter.throws(new Error('MyError'));
      await expect(instance.getPeers({ a: 1, b: 2 })).to.be.rejectedWith(
        'Failed to get peers'
      );
      expect(peersModuleStub.stubs.getByFilter.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.getByFilter.args[0][0]).to.deep.equal({
        a: 1,
        b: 2,
      });
    });

    it('should return an object with a peers property', async () => {
      result = await instance.getPeers({ a: 1, b: 2 });
      expect(result).to.deep.equal({ peers: [{ hello: 'world' }] });
      expect(peersModuleStub.stubs.getByFilter.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.getByFilter.args[0][0]).to.deep.equal({
        a: 1,
        b: 2,
      });
    });
  });

  describe('getPeer()', () => {
    it('Peer not found', async () => {
      peersModuleStub.stubs.getByFilter.returns([]);
      await expect(
        instance.getPeer({ ip: '8.8.8.8', port: 1234 })
      ).to.be.rejectedWith('Peer not found');
      expect(peersModuleStub.stubs.getByFilter.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.getByFilter.args[0][0]).to.deep.equal({
        ip: '8.8.8.8',
        port: 1234,
      });
    });

    it('Failed to get peers', async () => {
      peersModuleStub.stubs.getByFilter.throws(new Error('MyError'));
      await expect(
        instance.getPeer({ ip: '8.8.8.8', port: 1234 })
      ).to.be.rejectedWith('Failed to get peers');
      expect(peersModuleStub.stubs.getByFilter.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.getByFilter.args[0][0]).to.deep.equal({
        ip: '8.8.8.8',
        port: 1234,
      });
    });

    it('should return an object with a peer property', async () => {
      peersModuleStub.stubs.getByFilter.returns([{ a: 1 }, { b: 2 }]);
      result = await instance.getPeer({ ip: '8.8.8.8', port: 1234 });
      expect(result).to.deep.equal({ peer: { a: 1 } });
      expect(peersModuleStub.stubs.getByFilter.calledOnce).to.be.true;
      expect(peersModuleStub.stubs.getByFilter.args[0][0]).to.deep.equal({
        ip: '8.8.8.8',
        port: 1234,
      });
    });
  });

  describe('count()', () => {
    it('Failed to get peer count', async () => {
      peersModuleStub.stubs.getByFilter.throws(new Error('MyError'));
      await expect(instance.count()).to.be.rejectedWith(
        'Failed to get peer count'
      );
    });

    it('should return an object with the properties: banned, connected and disconnected', async () => {
      peersModuleStub.stubs.getByFilter.onCall(0).returns([{ a: 1 }]);
      peersModuleStub.stubs.getByFilter.onCall(1).returns([{ a: 1 }, { b: 2 }]);
      peersModuleStub.stubs.getByFilter
        .onCall(2)
        .returns([{ a: 1 }, { b: 2 }, { c: 3 }]);
      result = await instance.count();
      expect(result).to.deep.equal({
        banned: 3,
        connected: 1,
        disconnected: 2,
      });
      expect(peersModuleStub.stubs.getByFilter.args[0][0]).to.deep.equal({
        state: PeerState.CONNECTED,
      });
      expect(peersModuleStub.stubs.getByFilter.args[1][0]).to.deep.equal({
        state: PeerState.DISCONNECTED,
      });
      expect(peersModuleStub.stubs.getByFilter.args[2][0]).to.deep.equal({
        state: PeerState.BANNED,
      });
    });
  });

  describe('version()', () => {
    it('should return an object with the properties: build, minVersion and version', async () => {
      result = await instance.version();
      expect(result).to.deep.equal({
        build: '1.2.3',
        minVersion: '1.0',
        version: '0.1.0',
      });
      expect(systemModuleStub.stubs.getMinVersion.calledOnce).to.be.true;
    });
  });
});
