// tslint:disable no-unused-expression
import { OnBlockchainReady } from '@risevision/core';
import { Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { AppConfig } from '@risevision/core-types';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { p2pSymbols, PeersLoaderSubscriber, PeersLogic } from '../../../src';

chai.use(chaiAsPromised);
describe('p2p/hooks/loader', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let resolveTxtStub: SinonStub;
  let instance: PeersLoaderSubscriber;
  let hookSystem: WordPressHookSystem;
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-p2p',
      'core-helpers',
      'core-crypto',
      'core-blocks',
      'core-transactions',
      'core',
      'core-accounts',
    ]);
    hookSystem = new WordPressHookSystem(new InMemoryFilterModel());
    instance = container.get(p2pSymbols.__internals.loadSubscriber);
    // de-register current hooks and register a new hookSystem to isolate tests.
    await instance.unHook();
    instance.hookSystem = hookSystem;
    delete instance.__wpuid;
    await instance.hookMethods();

    resolveTxtStub = sandbox.stub(instance, 'resolveTxt');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('parseTxtRecords', () => {
    it('parses expected record formats', () => {
      const records = instance.parseTxtRecords([
        ['ip=111.112.113.114;', 'port=5544'],
        ['ip= 112.113.114.115; port = 1243'],
        ['IP=113.114.115.116; Port=9878'],
        ['ip= 2001:db8:85a3::8a2e:370:7334; port= 11123'],
      ]);
      expect(records.map((m) => Array.from(m))).to.deep.equal([
        [['ip', '111.112.113.114'], ['port', '5544']],
        [['ip', '112.113.114.115'], ['port', '1243']],
        [['ip', '113.114.115.116'], ['port', '9878']],
        [['ip', '2001:db8:85a3::8a2e:370:7334'], ['port', '11123']],
      ]);
    });

    it('parses invalid record formats', () => {
      const records = instance.parseTxtRecords([
        ['ip=111.112.113.114,', 'port=5544'],
        ['ip= 112.113.114.115'],
        ['IP 113.114.115.116; Port 9878'],
        ['ip 2001:db8:85a3::8a2e:370:7334, port 11123'],
      ]);
      expect(records.map((m) => Array.from(m))).to.deep.equal([
        [],
        [['ip', '112.113.114.115']],
        [],
        [],
      ]);
    });
  });

  describe('resolveSeeds', () => {
    it('should resolve explicit peers without DNS queries', async () => {
      resolveTxtStub.rejects();

      const peers = await instance.resolveSeeds([
        '111.112.113.114:5544',
        '112.113.114.115:5555',
      ]);
      expect(resolveTxtStub.notCalled).is.true;
      expect(peers).to.deep.equal([
        { ip: '111.112.113.114', port: 5544 },
        { ip: '112.113.114.115', port: 5555 },
      ]);
    });

    it('should resolve peers from DNS seed', async () => {
      resolveTxtStub.resolves([
        ['ip=45.63.91.77; port=5566'],
        ['ip=108.61.99.202; port=5566'],
        ['ip=194.135.95.105; port=5566'],
      ]);

      const peers = await instance.resolveSeeds(['testnet.seeds.rise.vision']);
      expect(resolveTxtStub.calledOnce).is.true;
      expect(peers).to.deep.equal([
        { ip: '45.63.91.77', port: 5566 },
        { ip: '108.61.99.202', port: 5566 },
        { ip: '194.135.95.105', port: 5566 },
      ]);
    });

    it('should deduplicate peers', async () => {
      resolveTxtStub
        .withArgs('testnet.seeds.rise.vision')
        .resolves([
          ['ip=45.63.91.77; port=5566'],
          ['ip=108.61.99.202; port=5566'],
          ['ip=194.135.95.105; port=5555'],
        ]);
      resolveTxtStub
        .withArgs('seeds.example.com')
        .resolves([
          ['ip=108.61.99.202; port=5566'],
          ['ip=194.135.95.106; port=5566'],
        ]);

      const peers = await instance.resolveSeeds([
        'testnet.seeds.rise.vision',
        '45.63.91.77:5566',
        'seeds.example.com',
        '45.63.91.78:5566',
      ]);
      expect(peers).to.deep.equal([
        { ip: '45.63.91.77', port: 5566 },
        { ip: '108.61.99.202', port: 5566 },
        { ip: '194.135.95.105', port: 5555 },
        { ip: '194.135.95.106', port: 5566 },
        { ip: '45.63.91.78', port: 5566 },
      ]);
    });

    it('should survive DNS errors', async () => {
      resolveTxtStub.rejects();

      const peers = await instance.resolveSeeds([
        'testnet.seeds.rise.vision',
        '45.63.91.77:5566',
      ]);
      expect(peers).to.deep.equal([{ ip: '45.63.91.77', port: 5566 }]);
    });
  });

  describe('bootstrapPeers', () => {
    let appConfig: AppConfig;
    let peerCreateStub: SinonStub;

    beforeEach(() => {
      appConfig = container.get(Symbols.generic.appConfig);
      const peersLogic: PeersLogic = container.get(p2pSymbols.logic.peersLogic);
      peerCreateStub = sandbox.stub(peersLogic, 'create');
    });

    it('should succeed with valid peers', () => {
      resolveTxtStub.rejects();
      appConfig.peers.seeds = ['45.63.91.77:5566'];
      peerCreateStub.callsFake(() => {
        return {
          makeRequest: () => Promise.resolve(),
        };
      });
      expect(instance.bootstrapPeers()).to.be.fulfilled;
    });

    it('should throw with no valid peers', () => {
      resolveTxtStub.rejects();
      appConfig.peers.seeds = ['45.63.91.77:5566', 'testnet.seeds.rise.vision'];
      peerCreateStub.callsFake(() => {
        return {
          makeRequest: () => Promise.reject(),
        };
      });
      expect(instance.bootstrapPeers()).to.be.rejected;
    });
  });
});
