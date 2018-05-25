import { expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { IBlocksModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';
import { BlocksModule } from '../../../src/modules';
import { createContainer } from '../../utils/containerCreator';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/blocks', () => {
  let inst: IBlocksModule;
  let instB: BlocksModule;
  let container: Container;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox   = sinon.createSandbox();
    container = createContainer();
    container.rebind(Symbols.modules.blocks).to(BlocksModule);
    inst = instB = container.get<any>(Symbols.modules.blocks);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('instance fields', () => {
    it('should have lastReceipt', () => {
      expect(inst.lastReceipt).to.exist;
    });
    it('should set lastBlock to undefined', () => {
      expect(inst.lastBlock).to.be.undefined;
    });
  });

  describe('.cleanup', () => {
    it('should resolve', () => {
      return instB.cleanup();
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
      it('should return boolean', () => {
        expect(inst.lastReceipt.isStale()).to.be.a('boolean');
      });
      it('should return true if never updated', () => {
        expect(inst.lastReceipt.isStale()).is.true;
      });
      it('should return true if updated was call more than 10secs ago (see before)', () => {
        const t = sinon.useFakeTimers();
        inst.lastReceipt.update();
        t.tick(10000);
        expect(inst.lastReceipt.isStale()).is.true;
        t.restore();
      });

      it('should return false if just updated', () => {
        inst.lastReceipt.update();
        expect(inst.lastReceipt.isStale()).is.false;
      });
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
