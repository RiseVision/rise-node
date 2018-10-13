import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { ISystemModule, Symbols } from '@risevision/core-interfaces';
import { p2pSymbols, PeersModule } from '../../../src/';
import { PeerState } from '@risevision/core-types';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';

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
  let peersModuleStub: PeersModule;
  let systemModuleStub: ISystemModule;

  let getByFilterStub: SinonStub;
  let getMinVersionStub: SinonStub;
  beforeEach(async () => {
    container    = await createContainer(['core-p2p', 'core-helpers', 'core-blocks', 'core-transactions', 'core', 'core-accounts']);
    sandbox = sinon.createSandbox();
    container.bind(Symbols.generic.versionBuild).toConstantValue(versionBuild);
    peersModuleStub = container.get(Symbols.modules.peers);
    systemModuleStub = container.get(Symbols.modules.system);

    getMinVersionStub = sandbox.stub(systemModuleStub, 'getMinVersion').returns('1.0');
    getByFilterStub = sandbox.stub(peersModuleStub, 'getByFilter').returns([{object: () => ({ hello: 'world' })}]);
    instance = container.getNamed(p2pSymbols.controller, p2pSymbols.api.peersAPI);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('getPeers()', () => {
    it('Failed to get peers', async () => {
      getByFilterStub.throws(new Error('MyError'));
      await expect(instance.getPeers({ a: 1, b: 2 })).to.be.rejectedWith(
        'Failed to get peers'
      );
      expect(getByFilterStub.calledOnce).to.be.true;
      expect(getByFilterStub.args[0][0]).to.deep.equal({
        a: 1,
        b: 2,
      });
    });

    it('should return an object with a peers property', async () => {
      result = await instance.getPeers({ a: 1, b: 2 });
      expect(result).to.deep.equal({ peers: [{ hello: 'world' }] });
      expect(getByFilterStub.calledOnce).to.be.true;
      expect(getByFilterStub.args[0][0]).to.deep.equal({
        a: 1,
        b: 2,
      });
    });
  });

  describe('getPeer()', () => {
    it('Peer not found', async () => {
      getByFilterStub.returns([]);
      await expect(
        instance.getPeer({ ip: '8.8.8.8', port: 1234 })
      ).to.be.rejectedWith('Peer not found');
      expect(getByFilterStub.calledOnce).to.be.true;
      expect(getByFilterStub.args[0][0]).to.deep.equal({
        ip: '8.8.8.8',
        port: 1234,
      });
    });

    it('Failed to get peers', async () => {
      getByFilterStub.throws(new Error('MyError'));
      await expect(
        instance.getPeer({ ip: '8.8.8.8', port: 1234 })
      ).to.be.rejectedWith('Failed to get peers');
      expect(getByFilterStub.calledOnce).to.be.true;
      expect(getByFilterStub.args[0][0]).to.deep.equal({
        ip: '8.8.8.8',
        port: 1234,
      });
    });

    it('should return an object with a peer property', async () => {
      getByFilterStub.returns([{ a: 1 }, { b: 2 }]);
      result = await instance.getPeer({ ip: '8.8.8.8', port: 1234 });
      expect(result).to.deep.equal({ peer: { a: 1 } });
      expect(getByFilterStub.calledOnce).to.be.true;
      expect(getByFilterStub.args[0][0]).to.deep.equal({
        ip: '8.8.8.8',
        port: 1234,
      });
    });
  });

  describe('count()', () => {
    it('Failed to get peer count', async () => {
      getByFilterStub.throws(new Error('MyError'));
      await expect(instance.count()).to.be.rejectedWith(
        'Failed to get peer count'
      );
    });

    it('should return an object with the properties: banned, connected and disconnected', async () => {
      getByFilterStub.onCall(0).returns([{ a: 1 }]);
      getByFilterStub.onCall(1).returns([{ a: 1 }, { b: 2 }]);
      getByFilterStub
        .onCall(2)
        .returns([{ a: 1 }, { b: 2 }, { c: 3 }]);
      result = await instance.count();
      expect(result).to.deep.equal({
        banned: 3,
        connected: 1,
        disconnected: 2,
      });
      expect(getByFilterStub.args[0][0]).to.deep.equal({
        state: PeerState.CONNECTED,
      });
      expect(getByFilterStub.args[1][0]).to.deep.equal({
        state: PeerState.DISCONNECTED,
      });
      expect(getByFilterStub.args[2][0]).to.deep.equal({
        state: PeerState.BANNED,
      });
    });
  });

  describe('version()', () => {
    it('should return an object with the properties: build, minVersion and version', async () => {
      result = await instance.version();
      expect(result).to.deep.equal({
        build: 'test',
        minVersion: '1.0',
        version: '0.1.0',
      });
      expect(getMinVersionStub.calledOnce).to.be.true;
    });
  });
});
