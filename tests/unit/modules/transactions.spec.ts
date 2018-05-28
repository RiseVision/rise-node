import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as helpers from '../../../src/helpers';
import { OrderBy } from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { SignedAndChainedBlockType } from '../../../src/logic';
import { TransactionsModule } from '../../../src/modules';
import {
  AccountsModuleStub,
  LoggerStub,
  TransactionLogicStub,
  TransactionPoolStub,
} from '../../stubs';

import { createContainer } from '../../utils/containerCreator';
import DbStub from '../../stubs/helpers/DbStub';
import { TransactionsModel } from '../../../src/models';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/transactions', () => {

  let instance: TransactionsModule;
  let container: Container;
  let sandbox: SinonSandbox;

  let accountsModuleStub: AccountsModuleStub;
  let loggerStub: LoggerStub;
  let dbHelperStub: DbStub;
  let genesisBlock: SignedAndChainedBlockType;
  let transactionPoolStub: TransactionPoolStub;
  let transactionLogicStub: TransactionLogicStub;

  beforeEach(() => {
    sandbox              = sinon.createSandbox();
    container = createContainer();
    container.rebind(Symbols.modules.transactions).to(TransactionsModule);
    instance             = container.get(Symbols.modules.transactions);
    accountsModuleStub   = container.get(Symbols.modules.accounts);
    loggerStub           = container.get(Symbols.helpers.logger);
    dbHelperStub           = container.get(Symbols.helpers.db);
    genesisBlock         = container.get(Symbols.generic.genesisBlock);
    transactionPoolStub  = container.get(Symbols.logic.transactionPool);
    transactionLogicStub = container.get(Symbols.logic.transaction);

    // Reset all stubs
    [accountsModuleStub, loggerStub, dbHelperStub, transactionPoolStub, transactionLogicStub].forEach((stub: any) => {
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
    it('should resolve', async () => {
      await expect(instance.cleanup()).to.be.fulfilled;
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

  describe('applyUnconfirmed', () => {
    let tx;
    let sender;
    const requester = { the: 'requester' };

    beforeEach(() => {
      tx     = { the: 'tx', id: 'tx1', blockId: 'blockId' };
      sender = { the: 'sender' };
      accountsModuleStub.stubs.getAccount.returns(requester);
      transactionLogicStub.stubs.applyUnconfirmed.returns('done');
      dbHelperStub.enqueueResponse('performOps', Promise.resolve());

    });

    it('should call logger.debug', async () => {
      await instance.applyUnconfirmed(tx as any, sender as any);
      expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.contain('Applying unconfirmed transaction');
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
      dbHelperStub.enqueueResponse('performOps', Promise.resolve());
    });

    it('should call logger.debug', async () => {
      await instance.undoUnconfirmed(tx);
      expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.contain('Undoing unconfirmed transaction');
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
    let txModel: typeof TransactionsModel;
    let txCountStub: SinonStub;
    beforeEach(() => {
      txModel = container.get(Symbols.models.transactions);
      txCountStub = sandbox.stub(txModel, 'count').resolves(12345);
      transactionPoolStub.multisignature.count = 1;
      transactionPoolStub.queued.count         = 2;
      transactionPoolStub.unconfirmed.count    = 3;
    });

    it('should call db.query', async () => {
      await instance.count();
      expect(txCountStub.called).is.true;
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


  describe('getByID', () => {
    let txModel: typeof TransactionsModel;
    let findByIDStub: SinonStub;
    beforeEach(() => {
      txModel = container.get(Symbols.models.transactions);
      findByIDStub = sandbox.stub(txModel, 'findById').resolves('tx');
      transactionLogicStub.stubs.dbRead.callsFake((tx) => {
        return { dbRead: tx };
      });
    });

    it('should call db.query', async () => {
      await instance.getByID('12345');
      expect(findByIDStub.called).is.true;
      expect(findByIDStub.firstCall.args[0]).to.be.deep.equal('12345');
    });

    it('should throw if tx not found', async () => {
      findByIDStub.resolves(null);
      await expect(instance.getByID('12345')).to.be.rejectedWith('Transaction not found');
    });

    it('should return tx obj', async () => {
      const retVal = await instance.getByID('12345');
      expect(retVal).to.be.deep.equal('tx');
    });
  });
});
