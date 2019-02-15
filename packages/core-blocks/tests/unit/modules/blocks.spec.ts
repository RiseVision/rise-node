import { ITimeToEpoch, Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { BlocksModule, BlocksSymbols } from '../../../src';
import { createFakeBlock } from '../utils/createFakeBlocks';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/blocks', () => {
  let timeToEpoch: ITimeToEpoch;
  let instance: BlocksModule;
  let container: Container;
  let sandbox: SinonSandbox;

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
      expect(await instance.isStale()).to.be.a('boolean');
    });
    it('should return true if lastBlock is undefined', async () => {
      expect(await instance.isStale()).is.true;
    });
    it('should return true if lastBlock is old', async () => {
      instance.lastBlock = createFakeBlock(container, {});
      expect(await instance.isStale()).is.true;
    });
    it('should return false if lastBlock is recent', async () => {
      instance.lastBlock = createFakeBlock(container, {
        timestamp: timeToEpoch.getTime(),
      });
      expect(await instance.isStale()).is.false;
    });
  });
});
