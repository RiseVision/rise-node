import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { BlocksModule, BlocksSymbols } from '../../../src';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/blocks', () => {
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
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('instanceance fields', () => {
    it('should have lastReceipt', () => {
      expect(instance.lastReceipt).to.exist;
    });
    it('should set lastBlock to undefined', () => {
      expect(instance.lastBlock).to.be.undefined;
    });
  });

  describe('.cleanup', () => {
    it('should resolve', () => {
      return instance.cleanup();
    });
  });

  describe('.lastReceipt', () => {
    describe('.get', () => {
      it('should return undefined if never updated', () => {
        expect(instance.lastReceipt.get()).to.be.undefined;
      });
      it('should return a number if updated', () => {
        instance.lastReceipt.update();
        expect(instance.lastReceipt.get()).to.be.a('number');
      });
    });

    describe('.isStale', () => {
      it('should return boolean', () => {
        expect(instance.lastReceipt.isStale()).to.be.a('boolean');
      });
      it('should return true if never updated', () => {
        expect(instance.lastReceipt.isStale()).is.true;
      });
      it('should return true if updated was call more than 10secs ago (see before)', () => {
        const t = sinon.useFakeTimers();
        instance.lastReceipt.update();
        t.tick(10000);
        expect(instance.lastReceipt.isStale()).is.true;
        t.restore();
      });

      it('should return false if just updated', () => {
        instance.lastReceipt.update();
        expect(instance.lastReceipt.isStale()).is.false;
      });
    });

    describe('.update', () => {
      it('should allow passing time', () => {
        instance.lastReceipt.update(10);
        expect(instance.lastReceipt.get()).to.be.eq(10);
      });
      it('should use current time if not passed', () => {
        const fakeTimers = sinon.useFakeTimers();
        fakeTimers.setSystemTime(112233 * 1000);
        instance.lastReceipt.update();
        expect(instance.lastReceipt.get()).to.be.eq(112233);
        fakeTimers.restore();
      });
    });
  });
});
