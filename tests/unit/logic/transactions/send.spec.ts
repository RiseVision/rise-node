'use strict';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {Container} from 'inversify';
import {Symbols} from '../../../../src/ioc/symbols';
import { SendTransaction } from '../../../../src/logic/transactions';
import { AccountsModuleStub, RoundsLogicStub, SystemModuleStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';

const expect = chai.expect;
chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('logic/transactions/send', () => {
  let roundsLogicStub: RoundsLogicStub;
  let accountsModuleStub: AccountsModuleStub;
  let systemModuleStub: SystemModuleStub;
  let container: Container;

  let instance: SendTransaction;
  let tx: any;
  let sender: any;
  let block: any;

  beforeEach(() => {
    container = createContainer();
    accountsModuleStub = container.get(Symbols.modules.accounts);
    accountsModuleStub.stubs.setAccountAndGet.resolves();
    accountsModuleStub.stubs.mergeAccountAndGet.resolves();

    systemModuleStub = container.get(Symbols.modules.system);
    systemModuleStub.stubs.getFees.returns({
      fees: {
        send: 1,
      },
    });
    roundsLogicStub = container.get(Symbols.logic.rounds);
    roundsLogicStub.stubs.calcRound.returns(10);

    tx       = {
      amount     : 10,
      recipientId: '1234567890R',
    };
    sender   = { publicKey: '123' };
    block    = {
      height: 123456,
      id    : 'blockId',
    };
    instance = new SendTransaction();

    (instance as any).roundsLogic    = roundsLogicStub;
    (instance as any).accountsModule = accountsModuleStub;
    (instance as any).systemModule   = systemModuleStub;
  });

  describe('calculateFee', () => {
    it('should call systemModule.getFees', () => {
      instance.calculateFee(tx, sender, 10);
      expect(systemModuleStub.stubs.getFees.calledOnce).to.be.true;
      expect(systemModuleStub.stubs.getFees.firstCall.args.length).to.equal(1);
      expect(systemModuleStub.stubs.getFees.firstCall.args[0]).to.equal(10);
    });
  });

  describe('verify', () => {
    it('should throw Missing recipient when !tx.recipientId', async () => {
      await expect(instance.verify({} as any, sender)).to.be.rejectedWith('Missing recipient');
    });

    it('throws Invalid transaction amount when tx.amount <= 0', async () => {
      tx.amount = 0;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should resolce on successful execution', () => {
      expect(instance.verify(tx, sender)).to.be.fulfilled;
    });
  });

  describe('apply', () => {
    it('should call setAccountAndGet, that throws error', () => {
      accountsModuleStub.stubs.setAccountAndGet.rejects('error');
      expect(instance.apply(tx, block, sender)).to.be.rejected;
    });

    it('should call setAccountAndGet is called and execute successfully when it does not throw', async () => {
      await expect(instance.apply(tx, block, sender)).to.be.fulfilled;
      expect(accountsModuleStub.stubs.setAccountAndGet.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.setAccountAndGet.firstCall.args.length).to.equal(1);
      expect(accountsModuleStub.stubs.setAccountAndGet.firstCall.args[0]).to.deep.equal({ address: tx.recipientId });
    });

    it('should call mergeAccountAndGet, which rejects the promise', async () => {
      accountsModuleStub.stubs.mergeAccountAndGet.rejects(new Error('Error'));
      await expect(instance.apply(tx, block, sender)).to.be.rejectedWith('Error');
    });

    it('should call mergeAccountAndGet and calcRound', async () => {
      await expect(instance.apply(tx, block, sender)).to.be.fulfilled;
      expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args.length).to.equal(1);
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.equal(block.height);

      expect(accountsModuleStub.stubs.mergeAccountAndGet.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.mergeAccountAndGet.firstCall.args.length).to.equal(1);
      expect(accountsModuleStub.stubs.mergeAccountAndGet.firstCall.args[0]).to.deep.equal({
        address  : tx.recipientId,
        balance  : tx.amount,
        blockId  : block.id,
        round    : 10,
        u_balance: tx.amount,
      });
    });
  });

  describe('undo', () => {
    it('should call setAccountAndGet, that throws error', async () => {
      accountsModuleStub.stubs.setAccountAndGet.rejects('error');
      await expect(instance.undo(tx, block, sender)).to.be.rejected;
    });

    it('should call setAccountAndGet and execute successfully', () => {
      expect(instance.undo(tx, block, sender)).to.be.fulfilled;
      expect(accountsModuleStub.stubs.setAccountAndGet.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.setAccountAndGet.firstCall.args.length).to.equal(1);
      expect(accountsModuleStub.stubs.setAccountAndGet.firstCall.args[0]).to.deep.equal({ address: tx.recipientId });
    });

    it('should call mergeAccountAndGet, that rejects the promise', async () => {
      accountsModuleStub.stubs.mergeAccountAndGet.rejects('error');
      await expect(instance.undo(tx, block, sender)).to.be.rejected;
    });

    it('should call mergeAccountAndGet, that resolves the promise', () => {
      return expect(instance.undo(tx, block, sender)).to.be.fulfilled
        .then(() => {
          expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
          expect(roundsLogicStub.stubs.calcRound.firstCall.args.length).to.equal(1);
          expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.equal(block.height);
          expect(accountsModuleStub.stubs.mergeAccountAndGet.calledOnce).to.be.true;
          expect(accountsModuleStub.stubs.mergeAccountAndGet.firstCall.args.length).to.equal(1);
          expect(accountsModuleStub.stubs.mergeAccountAndGet.firstCall.args[0]).to.deep.equal({
            address  : tx.recipientId,
            balance  : -tx.amount,
            blockId  : block.id,
            round    : 10,
            u_balance: -tx.amount,
          });
        });
    });
  });

  describe('objectNormalize', () => {
    it('should return the tx', () => {
      expect(instance.objectNormalize(tx)).to.deep.equal(tx);
    });
  });

  describe('dbRead', () => {
    it('should return null', () => {
      expect(instance.dbRead({})).to.deep.equal(null);
    });
  });

  describe('dbSave', () => {
    it('should return null', () => {
      expect(instance.dbSave({} as any)).to.deep.equal(null);
    });
  });
});
