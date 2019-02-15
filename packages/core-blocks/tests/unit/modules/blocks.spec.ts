import {
  ISystemModule,
  ITimeToEpoch,
  Symbols,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { IPeersModule } from '@risevision/core-p2p';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { peers } from 'dpos-api-wrapper/dist/es5/apis';
import { Container } from 'inversify';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { BlocksModule, BlocksSymbols } from '../../../src';
import { createFakeBlock } from '../utils/createFakeBlocks';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/blocks', () => {
  let timeToEpoch: ITimeToEpoch;
  let instance: BlocksModule;
  let container: Container;
  let sandbox: SinonSandbox;
  let getPeersStub: SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-blocks',
      'core-helpers',
      'core-crypto',
      'core',
      'core-accounts',
      'core-transactions',
    ]);
    instance = container.get(BlocksSymbols.modules.blocks);
    timeToEpoch = container.get(Symbols.helpers.timeToEpoch);

    // Patch the systems module so that there is no need to call update() on it
    const systemModule: ISystemModule = container.get(Symbols.modules.system);
    sandbox
      .stub(systemModule, 'getHeight')
      .callsFake(() => instance.lastBlock.height);
    sandbox
      .stub(systemModule.headers, 'height')
      .get(() => instance.lastBlock.height);

    const peersModule: IPeersModule = container.get(Symbols.modules.peers);
    getPeersStub = sandbox.stub(peersModule, 'getPeers').resolves([]);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('instanceance fields', () => {
    it('should set lastBlock to undefined', () => {
      expect(instance.lastBlock).to.be.undefined;
    });
  });

  describe('.cleanup', () => {
    it('should resolve', () => {
      return instance.cleanup();
    });
  });

  describe('.isStale', () => {
    it('should return boolean', async () => {
      getPeersStub.resolves([]);
      expect(await instance.isStale()).to.be.a('boolean');
    });
    it('should return true if lastBlock is undefined', async () => {
      getPeersStub.resolves([]);
      expect(await instance.isStale()).is.true;
    });
    it('should return true if lastBlock is old', async () => {
      instance.lastBlock = createFakeBlock(container, {});
      getPeersStub.resolves([]);
      getPeersStub.resolves([]);
      expect(await instance.isStale()).is.true;
    });
    it('should return false if lastBlock is recent and ahead of the network', async () => {
      instance.lastBlock = createFakeBlock(container, {
        timestamp: timeToEpoch.getTime(),
      });
      getPeersStub.resolves([]);
      expect(await instance.isStale()).is.false;
    });
    it('should return false if lastBlock is recent and the same with the network', async () => {
      instance.lastBlock = createFakeBlock(container, {
        timestamp: timeToEpoch.getTime(),
      });
      getPeersStub.resolves([
        { height: instance.lastBlock.height },
        { height: instance.lastBlock.height },
        { height: instance.lastBlock.height },
      ]);
      expect(await instance.isStale()).is.false;
    });
    it('should return false if lastBlock is recent but behind the network', async () => {
      instance.lastBlock = createFakeBlock(container, {
        timestamp: timeToEpoch.getTime(),
      });
      getPeersStub.resolves([
        { height: instance.lastBlock.height + 2 },
        { height: instance.lastBlock.height + 2 },
        { height: instance.lastBlock.height + 1 },
      ]);
      expect(await instance.isStale()).is.true;
    });
  });
});
