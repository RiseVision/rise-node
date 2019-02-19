// tslint:disable no-unused-expression
import { AccountsModel, AccountsSymbols } from '@risevision/core-accounts';
import { ApplyBlockDBOps, RollbackBlockDBOps } from '@risevision/core-blocks';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { InMemoryFilterModel, WordPressHookSystem } from 'mangiafuoco';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import {
  VerifyBlock,
  VerifyReceipt,
} from '../../../../../core-blocks/src/hooks';
import { dPoSSymbols } from '../../../../src/helpers';
import { DelegatesHooks } from '../../../../src/hooks/subscribers';
import { DelegatesModel } from '../../../../src/models';
import { DelegatesModule } from '../../../../src/modules';

chai.use(chaiAsPromised);

// tslint:disable no-identical-functions no-big-function
describe('hooks/subscribers/delegates', () => {
  let container: Container;
  let instance: DelegatesHooks;
  let wphooksystem: WordPressHookSystem;
  let sandbox: SinonSandbox;
  let delegatesModule: DelegatesModule;
  let accountsModel: typeof AccountsModel;
  let delegatesModel: typeof DelegatesModel;
  before(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-consensus-dpos',
      'core-transactions',
      'core',
      'core-helpers',
      'core-crypto',
    ]);
    instance = container.get(dPoSSymbols.hooksSubscribers.delegates);
    wphooksystem = new WordPressHookSystem(new InMemoryFilterModel());
    accountsModel = container.getNamed(
      ModelSymbols.model,
      AccountsSymbols.model
    );
    delegatesModel = container.getNamed(
      ModelSymbols.model,
      dPoSSymbols.models.delegates
    );
    await instance.unHook();
    delete instance.__wpuid;
    instance.hookSystem = wphooksystem;
    await instance.hookMethods();

    delegatesModule = container.get(dPoSSymbols.modules.delegates);
  });
  beforeEach(() => {
    sandbox.restore();
  });

  // it('should throw in OnCheckIntegrity if there is some unapplied round in db', async () => {
  //   const queryStub = sandbox
  //     .stub(delegatesModel.sequelize, 'query')
  //     .resolves([{ count: 1 }]);
  //   const stub = sandbox.stub(accountsModel, 'count').resolves(0);
  //   await expect(wphooksystem.do_action(OnCheckIntegrity.name, 1)).rejectedWith(
  //     'No delegates found'
  //   );
  //
  //   stub.resolves(1);
  //   await expect(wphooksystem.do_action(OnCheckIntegrity.name, 1)).rejectedWith(
  //     'Delegates table corrupted with duplicated entries'
  //   );
  //
  //   // all good
  //   queryStub.resolves([{ count: 0 }]);
  //   await wphooksystem.do_action(OnCheckIntegrity.name, 1);
  // });

  describe('verifyReceipt', () => {
    let assertValidBlockSlotStub: SinonStub;

    beforeEach(() => {
      assertValidBlockSlotStub = sandbox.stub(
        delegatesModule,
        'assertValidBlockSlot'
      );
    });

    it('should add error if block is too old', async () => {
      assertValidBlockSlotStub.resolves();
      const r = await wphooksystem.apply_filters(
        VerifyReceipt.name,
        { errors: [], verified: true },
        { timestamp: 0 }
      );
      expect(r.errors).deep.eq(['Block slot is too old']);
    });

    it('should add error if block is in the future', async () => {
      const r = await wphooksystem.apply_filters(
        VerifyReceipt.name,
        { errors: [], verified: true },
        { timestamp: Date.now() + 50 },
        { timestamp: 30 }
      );
      expect(r.errors).deep.eq(['Block slot is in the future']);
    });

    it('should add error if block is from wrong generator', async () => {
      assertValidBlockSlotStub.throws(new Error('Failed to verify slot 123'));
      const oldvbsw = (instance as any).verifyBlockSlotWindow;
      (instance as any).verifyBlockSlotWindow = async (
        payload: any,
        block: any
      ) => payload;
      const r = await wphooksystem.apply_filters(
        VerifyReceipt.name,
        { errors: [], verified: true },
        { timestamp: 0 }
      );
      expect(r.errors).deep.eq(['Failed to verify slot 123']);
      (instance as any).verifyBlockSlotWindow = oldvbsw;
    });

    it('should not add any error if block was already marked as unverified', async () => {
      const r = await wphooksystem.apply_filters(
        VerifyReceipt.name,
        { errors: ['first error'], verified: false },
        { timestamp: 0 }
      );
      expect(r).deep.eq({ errors: ['first error'], verified: false });
    });
  });

  describe('verifyBlock', () => {
    let assertValidBlockSlotStub: SinonStub;
    let getTimeStub: SinonStub;
    beforeEach(() => {
      assertValidBlockSlotStub = sandbox.stub(
        delegatesModule,
        'assertValidBlockSlot'
      );
    });

    it('should add error if block is from wrong generator', async () => {
      assertValidBlockSlotStub.throws(new Error('Failed to verify slot 123'));
      const oldvbs = (instance as any).verifyBlockSlot;
      (instance as any).verifyBlockSlot = async (payload: any, block: any) =>
        payload;
      const r = await wphooksystem.apply_filters(
        VerifyBlock.name,
        { errors: [], verified: true },
        { timestamp: 30 }, // block
        { timestamp: 0 } //
      );
      expect(r.errors).deep.eq(['Failed to verify slot 123']);
      (instance as any).verifyBlockSlot = oldvbs;
    });

    it('should add error if block has slot less than lastblockslot', async () => {
      assertValidBlockSlotStub.resolves();
      const r = await wphooksystem.apply_filters(
        VerifyBlock.name,
        { errors: [], verified: true },
        { timestamp: 100 * 30 }, // block
        { timestamp: 101 * 30 } // lastBlock
      );
      expect(r.errors).deep.eq(['Invalid block timestamp']);
    });
    it('should add error if block has slot in future', async () => {
      getTimeStub = sandbox.stub((instance as any).slots, 'getTime');
      getTimeStub.returns(102 * 30 - 3);
      assertValidBlockSlotStub.resolves();
      const r = await wphooksystem.apply_filters(
        VerifyBlock.name,
        { errors: [], verified: true },
        { timestamp: 102 * 30 }, // block
        { timestamp: 101 * 30 } // lastBlock
      );
      expect(r.errors).deep.eq(['Invalid block timestamp']);
    });

    it('should NOT add error if block has slot in future but within timeDriftCorrection', async () => {
      getTimeStub = sandbox.stub((instance as any).slots, 'getTime');
      getTimeStub.returns(102 * 30 - 2);
      assertValidBlockSlotStub.resolves();
      const r = await wphooksystem.apply_filters(
        VerifyBlock.name,
        { errors: [], verified: true },
        { timestamp: 102 * 30 }, // block
        { timestamp: 101 * 30 } // lastBlock
      );
      expect(r.errors).deep.eq([]);
    });

    it('should not add any error if block was already marked as unverified', async () => {
      assertValidBlockSlotStub.resolves();
      const r = await wphooksystem.apply_filters(
        VerifyBlock.name,
        { errors: ['first error'], verified: false },
        { timestamp: 102 * 30 }, // block
        { timestamp: 101 * 30 } // lastBlock
      );
      expect(r.errors).deep.eq(['first error']);
    });
  });

  describe('applyBlock', () => {
    let dmStub: SinonStub;
    beforeEach(() => {
      dmStub = sandbox.stub(delegatesModule, 'onBlockChanged');
    });
    it('should run delegatesModuleCode for forward round change', async () => {
      const r = await wphooksystem.apply_filters(ApplyBlockDBOps.name, ['a'], {
        height: 101,
      });
      expect(dmStub.calledWith('forward', 101)).is.true;
      expect(r).deep.eq(['a']);
    });
    it('should run delegatesModuleCode for backward round change', async () => {
      const r = await wphooksystem.apply_filters(
        RollbackBlockDBOps.name,
        ['a'],
        { height: 101 },
        { height: 100 }
      );
      expect(dmStub.calledWith('backward', 100)).is.true;
      expect(r).deep.eq(['a']);
    });
  });
});
