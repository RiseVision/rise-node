'use strict';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Address, RiseV2 } from 'dpos-offline';
import { Container } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { Symbols } from '../../../../core-interfaces/src';
import { IAccountLogic } from '../../../../core-interfaces/src/logic';
import { IAccountsModel } from '../../../../core-interfaces/src/models';
import { ISystemModule } from '../../../../core-interfaces/src/modules';
import { createContainer } from '../../../../core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '../../../../core-models/src/helpers';
import { DBUpsertOp, IBaseTransaction } from '../../../../core-types/src';
import { SendTxApplyFilter, SendTxUndoFilter, TXSymbols } from '../../../src';
import { SendTransaction } from '../../../src/sendTransaction';
import { createSendTransaction, toNativeTx } from '../utils/txCrafter';

const expect = chai.expect;
chai.use(chaiAsPromised);

// tslint:disable no-unused-expression no-big-function
describe('logic/transactions/send', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let AccountsModel: typeof IAccountsModel;
  let systemModule: ISystemModule;
  let accountLogic: IAccountLogic;
  let instance: SendTransaction;
  let tx: IBaseTransaction<any, bigint>;
  let sender: IAccountsModel;
  let block: any;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-transactions',
      'core-helpers',
      'core-crypto',
      'core-blocks',
      'core',
      'core-accounts',
    ]);
    instance = container.getNamed(TXSymbols.transaction, TXSymbols.sendTX);
    accountLogic = container.get(Symbols.logic.account);
    AccountsModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.accounts
    );

    systemModule = container.get(Symbols.modules.system);

    sender = new AccountsModel({});
    tx = toNativeTx(
      createSendTransaction(RiseV2.deriveKeypair('meow'), '1R' as Address, 10, {
        amount: 10,
      })
    );
    block = {
      height: 123456,
      id: 'blockId',
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('calculateFee', () => {
    let systemModuleStub: SinonStub;
    beforeEach(() => {
      systemModuleStub = sandbox.stub(systemModule, 'getFees').returns({
        fees: { send: 101n, sendDataMultiplier: 1n },
        fromHeight: 1,
        height: 10,
        toHeight: 100000,
      });
    });
    it('should call systemModule.getFees', () => {
      const fee = instance.calculateMinFee(tx, sender, 10);
      expect(systemModuleStub.calledOnce).to.be.true;
      expect(systemModuleStub.firstCall.args.length).to.equal(1);
      expect(systemModuleStub.firstCall.args[0]).to.equal(10);
      expect(fee).eq(101n);
    });
    it('should use the multiplier if some data is sent');
  });

  describe('verify', () => {
    it('should throw Missing recipient when !tx.recipientId', async () => {
      await expect(instance.verify({} as any, sender)).to.be.rejectedWith(
        'Missing recipient'
      );
    });

    it('throws Invalid transaction amount when tx.amount <= 0', async () => {
      tx.amount = 0n;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Invalid transaction amount'
      );
    });

    it('should resolve on successful execution', () => {
      expect(instance.verify(tx, sender)).to.be.fulfilled;
    });

    it('should throw if asset length is > 128');
  });

  describe('apply', () => {
    it('should return an array of objects', async () => {
      const accountMergeStub = sandbox
        .stub(accountLogic, 'mergeBalanceDiff')
        .returns([{ foo: 'bar' }] as any);
      const result = await instance.apply(tx as any, block, sender);
      expect(result).to.be.an('array');
      expect(result[0]).to.deep.equal({ foo: 'bar' });
      expect(accountMergeStub.calledOnce).to.be.true;
      expect(accountMergeStub.args[0][0]).to.equal(tx.recipientId);
      expect(accountMergeStub.args[0][1]).to.deep.equal({
        balance: BigInt(tx.amount),
        u_balance: BigInt(tx.amount),
      });
      // expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
    });

    it('should to be rejected if accountLogic.merge() throws an error', async () => {
      const accountMergeStub = sandbox
        .stub(accountLogic, 'mergeBalanceDiff')
        .returns([]);

      const error = new Error('Fake Error!');
      accountMergeStub.throws(error);
      await expect(instance.apply(tx as any, block, sender)).to.be.rejectedWith(
        error
      );
    });
    it('should go through SendTxUndoFilter', async () => {
      const stub = sandbox.stub();
      const accountMergeStub = sandbox
        .stub(accountLogic, 'mergeBalanceDiff')
        .returns(['a'] as any);

      class A extends WPHooksSubscriber(Object) {
        public hookSystem: WordPressHookSystem = container.get(
          Symbols.generic.hookSystem
        );

        @SendTxApplyFilter()
        public applyFilter(...args: any[]) {
          return stub(...args);
        }
      }

      const a = new A();
      await a.hookMethods();
      await instance.apply(tx as any, block, sender);
      expect(stub.calledOnce).is.true;
      expect(stub.firstCall.args[0]).deep.eq(['a']);
      expect(stub.firstCall.args[1]).deep.eq(tx);
      expect(stub.firstCall.args[2]).deep.eq(block);
      expect(stub.firstCall.args[3]).deep.eq(sender);
      await a.unHook();
    });
  });

  describe('undo', () => {
    it('should return an array of objects', async () => {
      const accountMergeStub = sandbox
        .stub(accountLogic, 'mergeBalanceDiff')
        .returns([{ foo: 'bar' }] as any);

      const result: DBUpsertOp<any> = (await instance.undo(
        tx as any,
        block,
        sender
      )) as any;
      expect(result).to.be.an('array');
      expect(result[0]).to.deep.equal({ foo: 'bar' });
      expect(accountMergeStub.calledOnce).to.be.true;
      expect(accountMergeStub.args[0][0]).to.equal(tx.recipientId);
      expect(accountMergeStub.args[0][1]).to.deep.equal({
        balance: BigInt(-tx.amount),
        u_balance: BigInt(-tx.amount),
      });
      // expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
    });

    it('should to be rejected if accountLogic.merge() throws an error', async () => {
      const accountMergeStub = sandbox
        .stub(accountLogic, 'mergeBalanceDiff')
        .returns([]);
      const error = new Error('Fake Error!');
      accountMergeStub.throws(error);
      await expect(instance.undo(tx as any, block, sender)).to.be.rejectedWith(
        error
      );
    });

    it('should go through SendTxUndoFilter', async () => {
      const stub = sandbox.stub();
      const accountMergeStub = sandbox
        .stub(accountLogic, 'mergeBalanceDiff')
        .returns(['a'] as any);
      // tslint:disable-next-line
      class A extends WPHooksSubscriber(Object) {
        public hookSystem: WordPressHookSystem = container.get(
          Symbols.generic.hookSystem
        );

        @SendTxUndoFilter()
        public applyFilter(...args: any[]) {
          return stub(...args);
        }
      }

      const a = new A();
      await a.hookMethods();
      await instance.undo(tx as any, block, sender);
      expect(stub.calledOnce).is.true;
      expect(stub.firstCall.args[0]).deep.eq(['a']);
      expect(stub.firstCall.args[1]).deep.eq(tx);
      expect(stub.firstCall.args[2]).deep.eq(block);
      expect(stub.firstCall.args[3]).deep.eq(sender);
      await a.unHook();
    });
  });

  describe('objectNormalize', () => {
    it('should return the tx', () => {
      expect(instance.objectNormalize(tx)).to.deep.equal(tx);
    });
  });

  describe('dbSave', () => {
    it('should return null if no asset', () => {
      expect(instance.dbSave({} as any)).to.deep.equal(null);
    });
    it('should return proper dbOp if some data');
    it('should return null if asset but data length is zero');
  });
});
