import { expect } from 'chai';
import 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { IBlocksModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';
import { BlocksModule } from '../../../src/modules';
import LoggerStub from '../../stubs/LoggerStub';

// tslint:disable no-unused-expression
describe('modules/blocks', () => {
  let inst: IBlocksModule;
  let instB: BlocksModule;
  let container: Container;
  before(() => {
    container = new Container();
    container.bind(Symbols.helpers.logger).to(LoggerStub);
    container.bind(Symbols.modules.blocks).to(BlocksModule);
    container.bind(Symbols.helpers.constants).toConstantValue({ blockReceiptTimeOut: 10 });
  });

  beforeEach(() => {
    inst = instB = container.get(Symbols.modules.blocks);
  });
  describe('instance fields', () => {
    it('should have lastReceipt', () => {
      expect(inst.lastReceipt).to.exist;
    });
    it('should set isActive to false', () => {
      expect(inst.isActive).to.be.false;
    });
    it('should set lastBlock to undefined', () => {
      expect(inst.lastBlock).to.be.undefined;
    });
    it('should set isCleaning to false', () => {
      expect(inst.isCleaning).to.be.false;
    });
  });

  describe('.cleanup', () => {
    it('should set isCleaning to true and return immediately if isActive is false', async () => {
      await instB.cleanup();
      expect(inst.isCleaning).to.be.true;
    });
    it('should wait until isActive is false and then return', () => {
      const timers   = sinon.useFakeTimers();
      instB.isActive = true;
      const p        = instB.cleanup();
      expect(p).to.not.be.fulfilled;

      timers.tick(10000);
      expect(p).to.not.be.fulfilled;

      instB.isActive = false;
      timers.tick(10000);
      expect(p).to.be.fulfilled;
      timers.restore();
    });
  });

  describe('.lastReceipt', () => {
    describe('.get', () => {
      it('should return undefined if never updated', () => {
        expect(inst.lastReceipt.get()).to.be.undefined;
      });
      it('should return a number if updated', () => {
        inst.lastReceipt.update();
        expect(inst.lastReceipt.get()).to.be.a('number');
      });
    });

    describe('.isStale', () => {
      it('should return boolean');
      it('should return true if never updated');
      it('should return true if updated was call more than 10secs ago (see before)');
    });

    describe('.update', () => {
      it('should allow passing time', () => {
        inst.lastReceipt.update(10);
        expect(inst.lastReceipt.get()).to.be.eq(10);
      });
      it('should use current time if not passed', () => {
        const fakeTimers = sinon.useFakeTimers();
        fakeTimers.setSystemTime(112233 * 1000);
        inst.lastReceipt.update();
        expect(inst.lastReceipt.get()).to.be.eq(112233);
        fakeTimers.restore();
      });
    });
  });
});
