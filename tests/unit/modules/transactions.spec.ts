import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import { OrderBy } from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { SignedAndChainedBlockType } from '../../../src/logic';
import { TransactionsModule } from '../../../src/modules';
import sql from '../../../src/sql/logic/transactions';
import {
  AccountsModuleStub,
  DbStub,
  LoggerStub,
  TransactionLogicStub,
  TransactionPoolStub,
} from '../../stubs';

import { createContainer } from '../../utils/containerCreator';

const RewiredTransactionsModule = rewire('../../../src/modules/transactions.ts');

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/transactions', () => {

  let instance: TransactionsModule;
  let container: Container;
  let sandbox: SinonSandbox;

  let accountsModuleStub: AccountsModuleStub;
  let loggerStub: LoggerStub;
  let dbStub: DbStub;
  let genesisBlock: SignedAndChainedBlockType;
  let transactionPoolStub: TransactionPoolStub;
  let transactionLogicStub: TransactionLogicStub;

  before(() => {
    container = createContainer();
  });

  beforeEach(() => {
    container.rebind(Symbols.modules.transactions).to(RewiredTransactionsModule.TransactionsModule);
    sandbox              = sinon.sandbox.create();
    instance             = container.get(Symbols.modules.transactions);
    accountsModuleStub   = container.get(Symbols.modules.accounts);
    loggerStub           = container.get(Symbols.helpers.logger);
    dbStub               = container.get(Symbols.generic.db);
    genesisBlock         = container.get(Symbols.generic.genesisBlock);
    transactionPoolStub  = container.get(Symbols.logic.transactionPool);
    transactionLogicStub = container.get(Symbols.logic.transaction);

    // Reset all stubs
    [accountsModuleStub, loggerStub, dbStub, transactionPoolStub, transactionLogicStub].forEach((stub: any) => {
      if (typeof stub.reset !== 'undefined') {
        stub.reset();
      }
      if (typeof stub.stubReset !== 'undefined') {
        stub.stubReset();
      }
    });
    transactionPoolStub.unconfirmed.reset();
    transactionPoolStub.multisignature.reset();
    transactionPoolStub.bundled.reset();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('cleanup', () => {
    it('should resolve', () => {
      expect(instance.cleanup()).to.be.fulfilled;
    });
  });

  describe('transactionInPool', () => {
    it('should call txPool.transactionInPool and return', () => {
      transactionPoolStub.stubs.transactionInPool.returns(true);
      const retVal = instance.transactionInPool('testTxId');
      expect(transactionPoolStub.stubs.transactionInPool.calledOnce).to.be.true;
      expect(transactionPoolStub.stubs.transactionInPool.firstCall.args.length).to.be.equal(1);
      expect(transactionPoolStub.stubs.transactionInPool.firstCall.args[0]).to.be.equal('testTxId');
      expect(retVal).to.be.true;
    });
  });

  describe('getUnconfirmedTransaction', () => {
    it('should call txPool.unconfirmed.get and return', () => {
      const returnedTx = { test: 'tx' };
      transactionPoolStub.unconfirmed.stubs.get.returns(returnedTx);
      const retVal = instance.getUnconfirmedTransaction('testTxId');
      expect(transactionPoolStub.unconfirmed.stubs.get.calledOnce).to.be.true;
      expect(transactionPoolStub.unconfirmed.stubs.get.firstCall.args.length).to.be.equal(1);
      expect(transactionPoolStub.unconfirmed.stubs.get.firstCall.args[0]).to.be.equal('testTxId');
      expect(retVal).to.be.deep.equal(returnedTx);
    });
  });

  describe('getQueuedTransaction', () => {
    it('should call txPool.queued.get and return', () => {
      const returnedTx = { test: 'tx' };
      transactionPoolStub.queued.stubs.get.returns(returnedTx);
      const retVal = instance.getQueuedTransaction('testTxId');
      expect(transactionPoolStub.queued.stubs.get.calledOnce).to.be.true;
      expect(transactionPoolStub.queued.stubs.get.firstCall.args.length).to.be.equal(1);
      expect(transactionPoolStub.queued.stubs.get.firstCall.args[0]).to.be.equal('testTxId');
      expect(retVal).to.be.deep.equal(returnedTx);
    });
  });

  describe('getQueuedTransaction', () => {
    it('should call txPool.queued.get and return', () => {
      it('should call txPool.unconfirmed.get and return', () => {
        const returnedTx = { test: 'tx' };
        transactionPoolStub.queued.stubs.get.returns(returnedTx);
        const retVal = instance.getQueuedTransaction('testTxId');
        expect(transactionPoolStub.queued.stubs.get.calledOnce).to.be.true;
        expect(transactionPoolStub.queued.stubs.get.firstCall.args.length).to.be.equal(1);
        expect(transactionPoolStub.queued.stubs.get.firstCall.args[0]).to.be.equal('testTxId');
        expect(retVal).to.be.deep.equal(returnedTx);
      });
    });
  });

  describe('getMultisignatureTransaction', () => {
    it('should call txPool.multisignature.get and return', () => {
      const returnedTx = { test: 'tx' };
      transactionPoolStub.multisignature.stubs.get.returns(returnedTx);
      const retVal = instance.getMultisignatureTransaction('testTxId');
      expect(transactionPoolStub.multisignature.stubs.get.calledOnce).to.be.true;
      expect(transactionPoolStub.multisignature.stubs.get.firstCall.args.length).to.be.equal(1);
      expect(transactionPoolStub.multisignature.stubs.get.firstCall.args[0]).to.be.equal('testTxId');
      expect(retVal).to.be.deep.equal(returnedTx);
    });
  });

  describe('getUnconfirmedTransactionList', () => {
    it('should call txPool.unconfirmed.list and return', () => {
      const returnedAr = [{ test: 'tx' }];
      transactionPoolStub.unconfirmed.stubs.list.returns(returnedAr);
      const retVal = instance.getUnconfirmedTransactionList(false, 10);
      expect(transactionPoolStub.unconfirmed.stubs.list.calledOnce).to.be.true;
      expect(transactionPoolStub.unconfirmed.stubs.list.firstCall.args.length).to.be.equal(2);
      expect(transactionPoolStub.unconfirmed.stubs.list.firstCall.args[0]).to.be.equal(false);
      expect(transactionPoolStub.unconfirmed.stubs.list.firstCall.args[1]).to.be.equal(10);
      expect(retVal).to.be.deep.equal(returnedAr);
    });
  });

  describe('getQueuedTransactionList', () => {
    it('should call txPool.queued.list and return', () => {
      const returnedAr = [{ test: 'tx' }];
      transactionPoolStub.queued.stubs.list.returns(returnedAr);
      const retVal = instance.getQueuedTransactionList(false, 10);
      expect(transactionPoolStub.queued.stubs.list.calledOnce).to.be.true;
      expect(transactionPoolStub.queued.stubs.list.firstCall.args.length).to.be.equal(2);
      expect(transactionPoolStub.queued.stubs.list.firstCall.args[0]).to.be.equal(false);
      expect(transactionPoolStub.queued.stubs.list.firstCall.args[1]).to.be.equal(10);
      expect(retVal).to.be.deep.equal(returnedAr);
    });
  });

  describe('getMultisignatureTransactionList', () => {
    it('should call txPool.multisignature.list and return', () => {
      const returnedAr = [{ test: 'tx' }];
      transactionPoolStub.multisignature.stubs.list.returns(returnedAr);
      const retVal = instance.getMultisignatureTransactionList(false, 10);
      expect(transactionPoolStub.multisignature.stubs.list.calledOnce).to.be.true;
      expect(transactionPoolStub.multisignature.stubs.list.firstCall.args.length).to.be.equal(2);
      expect(transactionPoolStub.multisignature.stubs.list.firstCall.args[0]).to.be.equal(false);
      expect(transactionPoolStub.multisignature.stubs.list.firstCall.args[1]).to.be.equal(10);
      expect(retVal).to.be.deep.equal(returnedAr);
    });
  });

  describe('getMergedTransactionList', () => {
    it('should call txPool.getMergedTransactionList and return', () => {
      const returnedAr = [{ test: 'tx' }];
      transactionPoolStub.stubs.getMergedTransactionList.returns(returnedAr);
      const retVal = instance.getMergedTransactionList(10);
      expect(transactionPoolStub.stubs.getMergedTransactionList.calledOnce).to.be.true;
      expect(transactionPoolStub.stubs.getMergedTransactionList.firstCall.args.length).to.be.equal(1);
      expect(transactionPoolStub.stubs.getMergedTransactionList.firstCall.args[0]).to.be.equal(10);
      expect(retVal).to.be.deep.equal(returnedAr);
    });
  });

  describe('removeUnconfirmedTransaction', () => {
    it('should call txPool.unconfirmed.remove, txPool.queued.remove, txPool.multisignature.remove', () => {
      instance.removeUnconfirmedTransaction('txId');
      expect(transactionPoolStub.unconfirmed.stubs.remove.calledOnce).to.be.true;
      expect(transactionPoolStub.unconfirmed.stubs.remove.firstCall.args.length).to.be.equal(1);
      expect(transactionPoolStub.unconfirmed.stubs.remove.firstCall.args[0]).to.be.equal('txId');
      expect(transactionPoolStub.queued.stubs.remove.calledOnce).to.be.true;
      expect(transactionPoolStub.queued.stubs.remove.firstCall.args.length).to.be.equal(1);
      expect(transactionPoolStub.queued.stubs.remove.firstCall.args[0]).to.be.equal('txId');
      expect(transactionPoolStub.multisignature.stubs.remove.calledOnce).to.be.true;
      expect(transactionPoolStub.multisignature.stubs.remove.firstCall.args.length).to.be.equal(1);
      expect(transactionPoolStub.multisignature.stubs.remove.firstCall.args[0]).to.be.equal('txId');
    });
  });

  describe('processUnconfirmedTransaction', () => {
    it('should call txPool.processNewTransaction and return', () => {
      const tx = { the: 'tx' };
      transactionPoolStub.stubs.processNewTransaction.returns('done');
      const retVal = instance.processUnconfirmedTransaction(tx as any, false, true);
      expect(transactionPoolStub.stubs.processNewTransaction.calledOnce).to.be.true;
      expect(transactionPoolStub.stubs.processNewTransaction.firstCall.args.length).to.be.equal(3);
      expect(transactionPoolStub.stubs.processNewTransaction.firstCall.args[0]).to.be.deep.equal(tx);
      expect(transactionPoolStub.stubs.processNewTransaction.firstCall.args[1]).to.be.equal(false);
      expect(transactionPoolStub.stubs.processNewTransaction.firstCall.args[2]).to.be.equal(true);
      expect(retVal).to.be.equal('done');
    });
  });

  describe('applyUnconfirmedIds', () => {
    it('should call txPool.applyUnconfirmedList and return', () => {
      const ids = ['id1', 'id2'];
      transactionPoolStub.stubs.applyUnconfirmedList.returns('done');
      const retVal = instance.applyUnconfirmedIds(ids);
      expect(transactionPoolStub.stubs.applyUnconfirmedList.calledOnce).to.be.true;
      expect(transactionPoolStub.stubs.applyUnconfirmedList.firstCall.args.length).to.be.equal(2);
      expect(transactionPoolStub.stubs.applyUnconfirmedList.firstCall.args[0]).to.be.deep.equal(ids);
      expect(transactionPoolStub.stubs.applyUnconfirmedList.firstCall.args[1]).to.be.deep.equal(instance);
      expect(retVal).to.be.equal('done');
    });
  });

  describe('applyUnconfirmedList', () => {
    it('should call unconfirmed.list and pass result to txPool.applyUnconfirmedList, then return', () => {
      const ids = ['id1', 'id2'];
      transactionPoolStub.unconfirmed.stubs.list.returns(ids);
      transactionPoolStub.stubs.applyUnconfirmedList.returns('done');
      const retVal = instance.applyUnconfirmedList();
      expect(transactionPoolStub.unconfirmed.stubs.list.calledOnce).to.be.true;
      expect(transactionPoolStub.unconfirmed.stubs.list.firstCall.args.length).to.be.equal(1);
      expect(transactionPoolStub.unconfirmed.stubs.list.firstCall.args[0]).to.be.deep.equal(true);
      expect(transactionPoolStub.stubs.applyUnconfirmedList.calledOnce).to.be.true;
      expect(transactionPoolStub.stubs.applyUnconfirmedList.firstCall.args.length).to.be.equal(2);
      expect(transactionPoolStub.stubs.applyUnconfirmedList.firstCall.args[0]).to.be.deep.equal(ids);
      expect(transactionPoolStub.stubs.applyUnconfirmedList.firstCall.args[1]).to.be.deep.equal(instance);
      expect(retVal).to.be.equal('done');
    });
  });

  describe('undoUnconfirmedList', () => {
    it('should call txPool.undoUnconfirmedList and return', async () => {
      const retPromise = Promise.resolve(['test']);
      transactionPoolStub.stubs.undoUnconfirmedList.returns(retPromise);
      const retVal = await instance.undoUnconfirmedList();
      expect(transactionPoolStub.stubs.undoUnconfirmedList.calledOnce).to.be.true;
      expect(transactionPoolStub.stubs.undoUnconfirmedList.firstCall.args.length).to.be.equal(1);
      expect(transactionPoolStub.stubs.undoUnconfirmedList.firstCall.args[0]).to.be.deep.equal(instance);
      expect(retVal).to.be.deep.equal(['test']);
    });
  });

  describe('apply', () => {
    const tx     = { the: 'tx', id: 'tx1' };
    const block  = { the: 'block' };
    const sender = { the: 'sender' };

    it('should call logger.debug', async () => {
      transactionLogicStub.stubs.apply.returns('done');
      await instance.apply(tx as any, block as any, sender as any);
      expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.deep.equal('Applying confirmed transaction');
      expect(loggerStub.stubs.debug.firstCall.args[1]).to.be.deep.equal(tx.id);
    });

    it('should call txPool.apply and return', async () => {
      transactionLogicStub.stubs.apply.returns('done');
      const retVal = await instance.apply(tx as any, block as any, sender as any);
      expect(transactionLogicStub.stubs.apply.calledOnce).to.be.true;
      expect(transactionLogicStub.stubs.apply.firstCall.args.length).to.be.equal(3);
      expect(transactionLogicStub.stubs.apply.firstCall.args[0]).to.be.deep.equal(tx);
      expect(transactionLogicStub.stubs.apply.firstCall.args[1]).to.be.deep.equal(block);
      expect(transactionLogicStub.stubs.apply.firstCall.args[2]).to.be.deep.equal(sender);
      expect(retVal).to.be.equal('done');
    });
  });

  describe('undo', () => {
    const tx     = { the: 'tx', id: 'tx1' };
    const block  = { the: 'block' };
    const sender = { the: 'sender' };
    it('should call logger.debug', async () => {
      transactionLogicStub.stubs.undo.returns('done');
      await instance.undo(tx as any, block as any, sender as any);
      expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.deep.equal('Undoing confirmed transaction');
      expect(loggerStub.stubs.debug.firstCall.args[1]).to.be.deep.equal(tx.id);
    });

    it('should call txPool.undo and return', async () => {
      transactionLogicStub.stubs.undo.returns('done');
      const retVal = await instance.undo(tx as any, block as any, sender as any);
      expect(transactionLogicStub.stubs.undo.calledOnce).to.be.true;
      expect(transactionLogicStub.stubs.undo.firstCall.args.length).to.be.equal(3);
      expect(transactionLogicStub.stubs.undo.firstCall.args[0]).to.be.deep.equal(tx);
      expect(transactionLogicStub.stubs.undo.firstCall.args[1]).to.be.deep.equal(block);
      expect(transactionLogicStub.stubs.undo.firstCall.args[2]).to.be.deep.equal(sender);
      expect(retVal).to.be.equal('done');
    });
  });

  describe('applyUnconfirmed', () => {
    let tx;
    let sender;
    const requester = { the: 'requester' };

    beforeEach(() => {
      tx     = { the: 'tx', id: 'tx1', blockId: 'blockId' };
      sender = { the: 'sender' };
      accountsModuleStub.stubs.getAccount.returns(requester);
      transactionLogicStub.stubs.applyUnconfirmed.returns('done');
    });

    it('should call logger.debug', async () => {
      await instance.applyUnconfirmed(tx as any, sender as any);
      expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.deep.equal('Applying unconfirmed transaction');
      expect(loggerStub.stubs.debug.firstCall.args[1]).to.be.deep.equal(tx.id);
    });

    it('should throw if sender not set and tx not in genesis block', async () => {
      await expect(instance.applyUnconfirmed(tx as any, undefined)).to.be.rejectedWith('Invalid block id');
    });

    it('should not throw if sender not set and tx IS in genesis block', async () => {
      tx.blockId = genesisBlock.id;
      await expect(instance.applyUnconfirmed(tx as any, undefined)).to.be.fulfilled;
    });

    describe('when requesterPublicKey is set', () => {
      beforeEach(() => {
        tx.requesterPublicKey = 'requesterPublicKey';
      });

      it('should call accountsModule.getAccount', async () => {
        await instance.applyUnconfirmed(tx as any, sender);
        expect(accountsModuleStub.stubs.getAccount.calledOnce).to.be.true;
        expect(accountsModuleStub.stubs.getAccount.firstCall.args.length).to.be.equal(1);
        expect(accountsModuleStub.stubs.getAccount.firstCall.args[0]).to.be.deep
          .equal({ publicKey: tx.requesterPublicKey });
      });

      it('should throw if requester not found', async () => {
        accountsModuleStub.stubs.getAccount.returns(false);
        await expect(instance.applyUnconfirmed(tx as any, sender)).to.be.rejectedWith('Requester not found');
      });

      it('should call transactionLogic.applyUnconfirmed with 3 parameters', async () => {
        await instance.applyUnconfirmed(tx as any, sender);
        expect(transactionLogicStub.stubs.applyUnconfirmed.calledOnce).to.be.true;
        expect(transactionLogicStub.stubs.applyUnconfirmed.firstCall.args.length).to.be.equal(3);
        expect(transactionLogicStub.stubs.applyUnconfirmed.firstCall.args[0]).to.be.deep.equal(tx);
        expect(transactionLogicStub.stubs.applyUnconfirmed.firstCall.args[1]).to.be.deep.equal(sender);
        expect(transactionLogicStub.stubs.applyUnconfirmed.firstCall.args[2]).to.be.deep.equal(requester);
      });
    });
    describe('when requesterPublicKey is NOT set', () => {
      it('should call transactionLogic.applyUnconfirmed with 2 parameters', async () => {
        await instance.applyUnconfirmed(tx as any, sender);
        expect(transactionLogicStub.stubs.applyUnconfirmed.calledOnce).to.be.true;
        expect(transactionLogicStub.stubs.applyUnconfirmed.firstCall.args.length).to.be.equal(2);
        expect(transactionLogicStub.stubs.applyUnconfirmed.firstCall.args[0]).to.be.deep.equal(tx);
        expect(transactionLogicStub.stubs.applyUnconfirmed.firstCall.args[1]).to.be.deep.equal(sender);
      });
    });
  });

  describe('undoUnconfirmed', () => {
    const tx     = {
      id             : 'txId',
      senderPublicKey: 'pubKey',
    };
    const sender = { account: 'id' };

    beforeEach(() => {
      accountsModuleStub.stubs.getAccount.resolves(sender);
      transactionLogicStub.stubs.undoUnconfirmed.resolves();
    });

    it('should call logger.debug', async () => {
      await instance.undoUnconfirmed(tx);
      expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Undoing unconfirmed transaction');
      expect(loggerStub.stubs.debug.firstCall.args[1]).to.be.equal(tx.id);
    });

    it('should call accountsModule.getAccount', async () => {
      await instance.undoUnconfirmed(tx);
      expect(accountsModuleStub.stubs.getAccount.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.getAccount.firstCall.args.length).to.be.equal(1);
      expect(accountsModuleStub.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({ publicKey: tx.senderPublicKey });
    });

    it('should call transactionLogic.undoUnconfirmed', async () => {
      await instance.undoUnconfirmed(tx);
      expect(transactionLogicStub.stubs.undoUnconfirmed.calledOnce).to.be.true;
      expect(transactionLogicStub.stubs.undoUnconfirmed.firstCall.args.length).to.be.equal(2);
      expect(transactionLogicStub.stubs.undoUnconfirmed.firstCall.args[0]).to.be.equal(tx);
      expect(transactionLogicStub.stubs.undoUnconfirmed.firstCall.args[1]).to.be.equal(sender);
    });
  });

  describe('receiveTransactions', () => {
    it('should call txPool.receiveTransactions', async () => {
      transactionPoolStub.stubs.receiveTransactions.returns(true);
      const transactions = ['tx1', 'tx2'];
      await instance.receiveTransactions(transactions as any, false, true);
      expect(transactionPoolStub.stubs.receiveTransactions.calledOnce).to.be.true;
      expect(transactionPoolStub.stubs.receiveTransactions.firstCall.args.length).to.be.equal(3);
      expect(transactionPoolStub.stubs.receiveTransactions.firstCall.args[0]).to.be.deep.equal(transactions);
      expect(transactionPoolStub.stubs.receiveTransactions.firstCall.args[1]).to.be.false;
      expect(transactionPoolStub.stubs.receiveTransactions.firstCall.args[2]).to.be.true;
    });
  });

  describe('count', () => {
    beforeEach(() => {
      dbStub.stubs.query.resolves([{ count: 12345 }]);
      transactionPoolStub.multisignature.count = 1;
      transactionPoolStub.queued.count         = 2;
      transactionPoolStub.unconfirmed.count    = 3;
    });

    it('should call db.query', async () => {
      await instance.count();
      expect(dbStub.stubs.query.calledOnce).to.be.true;
      expect(dbStub.stubs.query.firstCall.args.length).to.be.equal(1);
      expect(dbStub.stubs.query.firstCall.args[0]).to.be.deep.equal(sql.count);
    });

    it('should return the expected object', async () => {
      const retVal = await instance.count();
      expect(retVal).to.be.deep.equal({
        confirmed     : 12345,
        multisignature: transactionPoolStub.multisignature.count,
        queued        : transactionPoolStub.queued.count,
        unconfirmed   : transactionPoolStub.unconfirmed.count,
      });
    });
  });

  describe('fillPool', () => {
    const newUnconfirmedTXs = ['tx1', 'tx2'];
    beforeEach(() => {
      transactionPoolStub.stubs.fillPool.resolves(newUnconfirmedTXs);
      transactionPoolStub.stubs.applyUnconfirmedList.resolves();
    });

    it('should call txPool.fillPool', async () => {
      await instance.fillPool();
      expect(transactionPoolStub.stubs.fillPool.calledOnce).to.be.true;
      expect(transactionPoolStub.stubs.fillPool.firstCall.args.length).to.be.equal(0);
    });

    it('should call transactionPool.applyUnconfirmedList', async () => {
      await instance.fillPool();
      expect(transactionPoolStub.stubs.applyUnconfirmedList.calledOnce).to.be.true;
      expect(transactionPoolStub.stubs.applyUnconfirmedList.firstCall.args.length).to.be.equal(2);
      expect(transactionPoolStub.stubs.applyUnconfirmedList.firstCall.args[0]).to.be.deep.equal(newUnconfirmedTXs);
      expect(transactionPoolStub.stubs.applyUnconfirmedList.firstCall.args[1]).to.be.deep.equal(instance);
    });
  });

  describe('isLoaded', () => {
    it('should return true', () => {
      expect(instance.isLoaded()).to.be.true;
    });
  });

  describe('list', () => {
    let orderBySpy: SinonSpy;
    let countListSpy: SinonSpy;
    let listSpy: SinonSpy;
    let txList;

    beforeEach(() => {
      const helpers = RewiredTransactionsModule.__get__('_1');
      const txSQL   = RewiredTransactionsModule.__get__('transactions_1.default');
      txList        = ['rawTx1', 'rawTx2'];
      orderBySpy    = sandbox.spy(helpers, 'OrderBy');
      countListSpy  = sandbox.spy(txSQL, 'countList');
      listSpy       = sandbox.spy(txSQL, 'list');
      dbStub.enqueueResponse('query', Promise.resolve([{ count: 10 }]));
      dbStub.enqueueResponse('query', Promise.resolve(txList));
      transactionLogicStub.stubs.dbRead.callsFake((tx) => {
        return { dbRead: tx };
      });
    });

    describe('filter validation', () => {
      let params;
      let where;

      // Helper function to catch the where and params variables
      const doCall = async (filter) => {
        params = null;
        where  = null;
        await instance.list(filter);
        if (dbStub.stubs.query.called) {
          params = dbStub.stubs.query.firstCall.args[1];
        }
        if (countListSpy.called) {
          where = countListSpy.firstCall.args[0].where;
        }
      };

      it('should throw if filter item\'s condition is not OR or AND', async () => {
        const filter = { 'XOR:blockId': '12345' };
        await expect(instance.list(filter)).to.be.rejectedWith('Incorrect condition [XOR] for field: blockId');
      });

      it('should use OR in WHERE items if filter item has column char inside', async () => {
        const filter = { blockId: 12345, senderId: 54321 };
        await doCall(filter);
        expect(where[1]).to.match(/^OR\s/);
      });

      it('should throw if filter item contains more than two column-separated elements', async () => {
        const filter = { 'a:b:blockId': '12345' };
        await expect(instance.list(filter)).to.be.rejectedWith('Invalid parameter supplied: a:b:blockId');
      });

      it('should uppercase the or / and conditions', async () => {
        const filter = { 'blockId': 12345, 'and:senderId': 54321 };
        await doCall(filter);
        expect(where[1]).to.match(/^AND\s/);
      });

      it('should mutate fromUnixTime and toUnixTime to fromTimestamp and toTimestamp', async () => {
        const filter = { fromUnixTime: 0, toUnixTime: 10000 };
        await doCall(filter);
        expect(params).to.be.deep.equal({
          fromTimestamp: -1464109200,
          toTimestamp  : -1464099200,
          limit        : 100,
          offset       : 0,
        });
      });

      it('should throw if parameter value not supported', async () => {
        const filter = { unsupportedParameter: 12345 };
        await expect(doCall(filter)).to.be.rejectedWith('Parameter is not supported: unsupportedParameter');
      });

      it('should throw if parameter value is falsey', async () => {
        const filter = { blockId: undefined };
        await expect(doCall(filter)).to.be.rejectedWith('Value for parameter [blockId] cannot be empty');
      });

      it('should throw if parameter is zero', async () => {
        const filter = { blockId: 0 };
        await expect(doCall(filter)).to.be.rejectedWith('Value for parameter [blockId] cannot be empty');
      });

      it('should not throw if zero is passed as value for fromTimestamp', async () => {
        const filter = { fromTimestamp: 0 };
        await expect(doCall(filter)).to.be.fulfilled;
      });

      it('should not throw if zero is passed as value for minAmount', async () => {
        const filter = { minAmount: 0 };
        await expect(doCall(filter)).to.be.fulfilled;
      });

      it('should not throw if zero is passed as value for minConfirmations', async () => {
        const filter = { minConfirmations: 0 };
        await expect(doCall(filter)).to.be.fulfilled;
      });

      it('should not throw if zero is passed as value for type', async () => {
        const filter = { type: 0 };
        await expect(doCall(filter)).to.be.fulfilled;
      });

      it('should not throw if zero is passed as value for offset', async () => {
        const filter = { offset: 0 };
        await expect(doCall(filter)).to.be.fulfilled;
      });

      it('should add the boolean operator plus a space after non-first where clauses', async () => {
        const filter = { 'minConfirmations': 0, 'and:blockId': 33, 'or:minConfirmations': 1 };
        await doCall(filter);
        expect(where[0]).not.to.match(/^AND\s/);
        expect(where[0]).not.to.match(/^OR\s/);
        expect(where[1]).to.match(/^AND\s/);
        expect(where[2]).to.match(/^OR\s/);
      });

      it('should not include limit, offset, orderBy in WHERE clauses', async () => {
        const filter = { limit: 10, offset: 0, orderBy: 'blockId', blockId: 12345 };
        await doCall(filter);
        expect(where.length).to.be.equal(1);
        expect(where[0]).to.match(/blockId/);
      });

      it('should set limit to 100 if not specified', async () => {
        const filter = { blockId: 12345 };
        await doCall(filter);
        expect(params.limit).to.be.equal(100);
      });

      it('should abs the passed limit', async () => {
        const filter = { blockId: 12345, limit: -150 };
        await doCall(filter);
        expect(params.limit).to.be.equal(150);
      });

      it('should set offset to 0 if not specified', async () => {
        const filter = { blockId: 12345 };
        await doCall(filter);
        expect(params.offset).to.be.equal(0);
      });

      it('should abs the passed offset', async () => {
        const filter = { blockId: 12345, offset: -150 };
        await doCall(filter);
        expect(params.offset).to.be.equal(150);
      });

      it('should throw if limit more than 1000', async () => {
        const filter = { blockId: 12345, limit: 1001 };
        await expect(doCall(filter)).to.be.rejectedWith('Invalid limit, maximum is 1000');
      });
    });

    it('should call OrderBy', async () => {
      const filter = { blockId: 12345, orderBy: 'id' };
      await instance.list(filter);
      expect(orderBySpy.calledOnce).to.be.true;
      expect(orderBySpy.firstCall.args.length).to.be.equal(2);
      expect(orderBySpy.firstCall.args[0]).to.be.equal(filter.orderBy);
      expect(orderBySpy.firstCall.args[1].sortFields).to.be.deep.equal(sql.sortFields);
      expect(orderBySpy.firstCall.args[1].fieldPrefix).to.be.a('function');
    });

    describe('fieldPrefix', () => {
      let fieldPrefix: (s: string) => string;
      beforeEach(async () => {
        const filter = { blockId: 12345, orderBy: 'id' };
        await instance.list(filter);
        fieldPrefix = orderBySpy.firstCall.args[1].fieldPrefix;
      });

      it('should prepend b_ if field is height', () => {
        expect(fieldPrefix('height')).to.be.equal('b_height');
      });

      it('should return field as is if field is confirmations', () => {
        expect(fieldPrefix('confirmations')).to.be.equal('confirmations');
      });

      it('should else prepend t_', () => {
        expect(fieldPrefix('blockId')).to.be.equal('t_blockId');
      });
    });

    it('should throw if OrderBy retuns error state', async () => {
      const filter = { blockId: 12345, orderBy: 'minConfirmations' };
      await expect(instance.list(filter)).to.be.rejectedWith(orderBySpy.firstCall.returnValue.error);
    });

    describe('countList query', () => {
      it('should call db.query', async () => {
        const filter = { blockId: 12345 };
        await instance.list(filter);
        expect(dbStub.stubs.query.calledTwice).to.be.true;
        expect(dbStub.stubs.query.firstCall.args.length).to.be.equal(2);
        expect(dbStub.stubs.query.firstCall.args[0]).to.be
          .equal('SELECT COUNT(1) FROM trs_list WHERE ("t_blockId" = ${blockId})');
        expect(dbStub.stubs.query.firstCall.args[1]).to.be.deep
          .equal({ blockId: 12345, limit: 100, offset: 0 });
      });

      it('should call sql.countList', async () => {
        const filter = { blockId: 12345 };
        await instance.list(filter);
        expect(countListSpy.calledOnce).to.be.true;
        expect(countListSpy.firstCall.args.length).to.be.equal(1);
        expect(countListSpy.firstCall.args[0]).to.be.deep.equal({ where: ['"t_blockId" = ${blockId}'] });
      });

      it('should reject and call logger.error if db.query throws', async () => {
        const err = new Error('test');
        dbStub.stubs.query.onFirstCall().rejects(err);
        const filter = { blockId: 12345 };
        await expect(instance.list(filter)).to.be.rejectedWith('Transactions#list error');
        expect(loggerStub.stubs.error.calledOnce).to.be.true;
        expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.error.firstCall.args[0]).to.be.deep.equal(err.stack);
      });
    });

    describe('list query', () => {
      it('should call db.query', async () => {
        const filter = { blockId: 12345 };
        await instance.list(filter);
        expect(dbStub.stubs.query.calledTwice).to.be.true;
        expect(dbStub.stubs.query.secondCall.args.length).to.be.equal(2);
        expect(dbStub.stubs.query.secondCall.args[0]).to.be
          .equal('SELECT "t_id", "b_height", "t_blockId", "t_type", "t_timestamp", "t_senderId", "t_recipientId", ' +
            '"t_amount", "t_fee", "t_signature", "t_SignSignature", "t_signatures", "confirmations", ENCODE ' +
            '("t_senderPublicKey", \'hex\') AS "t_senderPublicKey", ENCODE ("m_recipientPublicKey", \'hex\') AS ' +
            '"m_recipientPublicKey" FROM trs_list WHERE ("t_blockId" = ${blockId}) LIMIT ${limit} OFFSET ${offset}'
          );
        expect(dbStub.stubs.query.secondCall.args[1]).to.be.deep
          .equal({ blockId: 12345, limit: 100, offset: 0 });
      });

      it('should call sql.list', async () => {
        const filter = { blockId: 12345 };
        await instance.list(filter);
        expect(listSpy.calledOnce).to.be.true;
        expect(listSpy.firstCall.args.length).to.be.equal(1);
        expect(listSpy.firstCall.args[0]).to.be.deep.equal({
          sortField : null,
          sortMethod: null,
          where     : ['"t_blockId" = ${blockId}'],
        });
      });

      it('should reject and call logger.error if db.query throws', async () => {
        const err = new Error('test2');
        dbStub.stubs.query.onSecondCall().rejects(err);
        const filter = { blockId: 12345 };
        await expect(instance.list(filter)).to.be.rejectedWith('Transactions#list error');
        expect(loggerStub.stubs.error.calledOnce).to.be.true;
        expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.error.firstCall.args[0]).to.be.deep.equal(err.stack);
      });
    });

    it('should call transactionLogic.dbRead for each transaction', async () => {
      const filter = { blockId: 12345 };
      await instance.list(filter);
      expect(transactionLogicStub.stubs.dbRead.callCount).to.be.equal(txList.length);
      expect(transactionLogicStub.stubs.dbRead.firstCall.args.length).to.be.equal(1);
      expect(transactionLogicStub.stubs.dbRead.firstCall.args[0]).to.be.equal(txList[0]);
      expect(transactionLogicStub.stubs.dbRead.secondCall.args.length).to.be.equal(1);
      expect(transactionLogicStub.stubs.dbRead.secondCall.args[0]).to.be.equal(txList[1]);
    });

    it('should return an object with count and transactions', async () => {
      const filter = { blockId: 12345 };
      const retVal = await instance.list(filter);
      expect(retVal).to.be.deep.equal({
        transactions: txList.map((tx) => transactionLogicStub.dbRead(tx)),
        count       : 10,
      });
    });
  });

  describe('getByID', () => {
    beforeEach(() => {
      dbStub.enqueueResponse('query', Promise.resolve(['tx']));
      transactionLogicStub.stubs.dbRead.callsFake((tx) => {
        return { dbRead: tx };
      });
    });

    it('should call db.query', async () => {
      await instance.getByID('12345');
      expect(dbStub.stubs.query.calledOnce).to.be.true;
      expect(dbStub.stubs.query.firstCall.args.length).to.be.equal(2);
      expect(dbStub.stubs.query.firstCall.args[0]).to.be.deep.equal(sql.getById);
      expect(dbStub.stubs.query.firstCall.args[1]).to.be.deep.equal({ id: '12345' });
    });

    it('should throw if tx not found', async () => {
      dbStub.stubs.query.resolves([]);
      await expect(instance.getByID('12345')).to.be.rejectedWith('Transaction not found: 12345');
    });

    it('should else call transactionLogic.dbRead and return', async () => {
      const retVal = await instance.getByID('12345');
      expect(transactionLogicStub.stubs.dbRead.calledOnce).to.be.true;
      expect(transactionLogicStub.stubs.dbRead.firstCall.args.length).to.be.equal(1);
      expect(transactionLogicStub.stubs.dbRead.firstCall.args[0]).to.be.deep.equal('tx');
      expect(retVal).to.be.deep.equal({ dbRead: 'tx' });
    });
  });
});
