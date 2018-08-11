import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { TransactionPool, TransactionsModel, TransactionsModule, TXSymbols } from '../../src';
import { IAccountsModule } from '../../../core-interfaces/src/modules';
import { IDBHelper } from '../../../core-interfaces/src/helpers';
import { IBaseTransaction, SignedAndChainedBlockType } from '../../../core-types/src';
import { ITransactionLogic } from '../../../core-interfaces/src/logic';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { Symbols } from '../../../core-interfaces/src';
import { StubbedInstance } from '../../../core-test-utils/src/stubCreator';
import { InnerTXQueue } from '../../src/poolTXsQueue';
import { createRandomTransaction } from '../utils/txCrafter';
import { toBufferedTransaction } from '../../../core-test-utils/dist/utils/txCrafter';
import { IAccountsModel } from '../../../core-interfaces/src/models';
import { ModelSymbols } from '../../../core-models/src/helpers';


chai.use(chaiAsPromised);

class StubTxQueue extends StubbedInstance(InnerTXQueue) {
}

class StubTxPool extends StubbedInstance(TransactionPool) {
  public unconfirmed = new StubTxQueue();
  public bundled     = new StubTxQueue();
  public queued      = new StubTxQueue();
  public pending     = new StubTxQueue() as any;
}

// tslint:disable no-unused-expression
describe('modules/transactions', () => {

  let instance: TransactionsModule;
  let container: Container;
  let sandbox: SinonSandbox;

  let accountsModule: IAccountsModule;
  let AccountsModel: typeof IAccountsModel;
  let dbHelper: IDBHelper;
  let genesisBlock: SignedAndChainedBlockType;
  let txPool: StubTxPool;
  let txLogic: ITransactionLogic;

  beforeEach(async () => {
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core-transactions', 'core-helpers', 'core-blocks', 'core', 'core-accounts']);
    container.rebind(Symbols.logic.txpool).to(StubTxPool).inSingletonScope();
    instance                    = container.get(TXSymbols.module);
    txPool                      = container.get(TXSymbols.pool);
    instance['transactionPool'] = txPool
    accountsModule              = container.get(Symbols.modules.accounts);
    AccountsModel               = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    dbHelper                    = container.get(Symbols.helpers.db);
    genesisBlock                = container.get(Symbols.generic.genesisBlock);
    txLogic                     = container.get(Symbols.logic.transaction);
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
      txPool.stubs.transactionInPool.returns(true);
      const retVal = instance.transactionInPool('testTxId');
      expect(txPool.stubs.transactionInPool.calledOnce).to.be.true;
      expect(txPool.stubs.transactionInPool.firstCall.args.length).to.be.equal(1);
      expect(txPool.stubs.transactionInPool.firstCall.args[0]).to.be.equal('testTxId');
      expect(retVal).to.be.true;
    });
  });

  describe('getUnconfirmedTransaction', () => {
    it('should call txPool.unconfirmed.get and return', () => {
      const returnedTx = { test: 'tx' };
      txPool.unconfirmed.stubs.get.returns(returnedTx);
      const retVal = instance.getUnconfirmedTransaction('testTxId');
      expect(txPool.unconfirmed.stubs.get.calledOnce).to.be.true;
      expect(txPool.unconfirmed.stubs.get.firstCall.args.length).to.be.equal(1);
      expect(txPool.unconfirmed.stubs.get.firstCall.args[0]).to.be.equal('testTxId');
      expect(retVal).to.be.deep.equal(returnedTx);
    });
  });

  describe('getQueuedTransaction', () => {
    it('should call txPool.queued.get and return', () => {
      const returnedTx = { test: 'tx' };
      txPool.queued.stubs.get.returns(returnedTx);
      const retVal = instance.getQueuedTransaction('testTxId');
      expect(txPool.queued.stubs.get.calledOnce).to.be.true;
      expect(txPool.queued.stubs.get.firstCall.args.length).to.be.equal(1);
      expect(txPool.queued.stubs.get.firstCall.args[0]).to.be.equal('testTxId');
      expect(retVal).to.be.deep.equal(returnedTx);
    });
  });

  describe('getQueuedTransaction', () => {
    it('should call txPool.queued.get and return', () => {
      it('should call txPool.unconfirmed.get and return', () => {
        const returnedTx = { test: 'tx' };
        txPool.queued.stubs.get.returns(returnedTx);
        const retVal = instance.getQueuedTransaction('testTxId');
        expect(txPool.queued.stubs.get.calledOnce).to.be.true;
        expect(txPool.queued.stubs.get.firstCall.args.length).to.be.equal(1);
        expect(txPool.queued.stubs.get.firstCall.args[0]).to.be.equal('testTxId');
        expect(retVal).to.be.deep.equal(returnedTx);
      });
    });
  });

  // describe('getMultisignatureTransaction', () => {
  //   it('should call txPool.multisignature.get and return', () => {
  //     const returnedTx = { test: 'tx' };
  //     txPool.multisignature.stubs.get.returns(returnedTx);
  //     const retVal = instance.getMultisignatureTransaction('testTxId');
  //     expect(txPool.multisignature.stubs.get.calledOnce).to.be.true;
  //     expect(txPool.multisignature.stubs.get.firstCall.args.length).to.be.equal(1);
  //     expect(txPool.multisignature.stubs.get.firstCall.args[0]).to.be.equal('testTxId');
  //     expect(retVal).to.be.deep.equal(returnedTx);
  //   });
  // });

  describe('getUnconfirmedTransactionList', () => {
    it('should call txPool.unconfirmed.list and return', () => {
      const returnedAr = [{ test: 'tx' }];
      txPool.unconfirmed.stubs.list.returns(returnedAr);
      const retVal = instance.getUnconfirmedTransactionList(false, 10);
      expect(txPool.unconfirmed.stubs.list.calledOnce).to.be.true;
      expect(txPool.unconfirmed.stubs.list.firstCall.args.length).to.be.equal(2);
      expect(txPool.unconfirmed.stubs.list.firstCall.args[0]).to.be.equal(false);
      expect(txPool.unconfirmed.stubs.list.firstCall.args[1]).to.be.equal(10);
      expect(retVal).to.be.deep.equal(returnedAr);
    });
  });

  describe('getQueuedTransactionList', () => {
    it('should call txPool.queued.list and return', () => {
      const returnedAr = [{ test: 'tx' }];
      txPool.queued.stubs.list.returns(returnedAr);
      const retVal = instance.getQueuedTransactionList(false, 10);
      expect(txPool.queued.stubs.list.calledOnce).to.be.true;
      expect(txPool.queued.stubs.list.firstCall.args.length).to.be.equal(2);
      expect(txPool.queued.stubs.list.firstCall.args[0]).to.be.equal(false);
      expect(txPool.queued.stubs.list.firstCall.args[1]).to.be.equal(10);
      expect(retVal).to.be.deep.equal(returnedAr);
    });
  });

  // describe('getMultisignatureTransactionList', () => {
  //   it('should call txPool.multisignature.list and return', () => {
  //     const returnedAr = [{ test: 'tx' }];
  //     txPool.multisignature.stubs.list.returns(returnedAr);
  //     const retVal = instance.getMultisignatureTransactionList(false, 10);
  //     expect(txPool.multisignature.stubs.list.calledOnce).to.be.true;
  //     expect(txPool.multisignature.stubs.list.firstCall.args.length).to.be.equal(2);
  //     expect(txPool.multisignature.stubs.list.firstCall.args[0]).to.be.equal(false);
  //     expect(txPool.multisignature.stubs.list.firstCall.args[1]).to.be.equal(10);
  //     expect(retVal).to.be.deep.equal(returnedAr);
  //   });
  // });

  describe('getMergedTransactionList', () => {
    it('should call txPool.getMergedTransactionList and return', () => {
      const returnedAr = [{ test: 'tx' }];
      txPool.stubs.getMergedTransactionList.returns(returnedAr);
      const retVal = instance.getMergedTransactionList(10);
      expect(txPool.stubs.getMergedTransactionList.calledOnce).to.be.true;
      expect(txPool.stubs.getMergedTransactionList.firstCall.args.length).to.be.equal(1);
      expect(txPool.stubs.getMergedTransactionList.firstCall.args[0]).to.be.equal(10);
      expect(retVal).to.be.deep.equal(returnedAr);
    });
  });

  describe('removeUnconfirmedTransaction', () => {
    it('should call txPool.unconfirmed.remove, txPool.queued.remove, txPool.multisignature.remove', () => {
      instance.removeUnconfirmedTransaction('txId');
      expect(txPool.unconfirmed.stubs.remove.calledOnce).to.be.true;
      expect(txPool.unconfirmed.stubs.remove.firstCall.args.length).to.be.equal(1);
      expect(txPool.unconfirmed.stubs.remove.firstCall.args[0]).to.be.equal('txId');
      expect(txPool.queued.stubs.remove.calledOnce).to.be.true;
      expect(txPool.queued.stubs.remove.firstCall.args.length).to.be.equal(1);
      expect(txPool.queued.stubs.remove.firstCall.args[0]).to.be.equal('txId');
      expect(txPool.pending.stubs.remove.calledOnce).to.be.true;
      expect(txPool.pending.stubs.remove.firstCall.args.length).to.be.equal(1);
      expect(txPool.pending.stubs.remove.firstCall.args[0]).to.be.equal('txId');
    });
  });

  describe('processUnconfirmedTransaction', () => {
    it('should call txPool.processNewTransaction and return', () => {
      const tx = { the: 'tx' };
      txPool.stubs.processNewTransaction.returns('done');
      const retVal = instance.processUnconfirmedTransaction(tx as any, false);
      expect(txPool.stubs.processNewTransaction.calledOnce).to.be.true;
      expect(txPool.stubs.processNewTransaction.firstCall.args.length).to.be.equal(1);
      expect(txPool.stubs.processNewTransaction.firstCall.args[0]).to.be.deep.equal(tx);
      expect(retVal).to.be.equal('done');
    });
  });

  // describe('applyUnconfirmed', () => {
  //   let tx;
  //   let sender;
  //   const requester = { the: 'requester' };
  //   let getAccountStub: SinonStub;
  //   beforeEach(() => {
  //     tx             = { the: 'tx', id: 'tx1', blockId: 'blockId' };
  //     sender         = { the: 'sender' };
  //     getAccountStub = sandbox.stub(accountsModule, 'getAccount');
  //     txLogic.stubs.applyUnconfirmed.returns('done');
  //     dbHelper.enqueueResponse('performOps', Promise.resolve());
  //
  //   });
  //
  //
  //   it('should throw if sender not set and tx not in genesis block', async () => {
  //     await expect(instance.applyUnconfirmed(tx as any, undefined)).to.be.rejectedWith('Invalid block id');
  //   });
  //
  //   it('should not throw if sender not set and tx IS in genesis block', async () => {
  //     tx.blockId = genesisBlock.id;
  //     await expect(instance.applyUnconfirmed(tx as any, undefined)).to.be.fulfilled;
  //   });
  //
  //   describe('when requesterPublicKey is set', () => {
  //     beforeEach(() => {
  //       tx.requesterPublicKey = 'requesterPublicKey';
  //     });
  //
  //     it('should call accountsModule.getAccount', async () => {
  //       await instance.applyUnconfirmed(tx as any, sender);
  //       expect(accountsModuleStub.stubs.getAccount.calledOnce).to.be.true;
  //       expect(accountsModuleStub.stubs.getAccount.firstCall.args.length).to.be.equal(1);
  //       expect(accountsModuleStub.stubs.getAccount.firstCall.args[0]).to.be.deep
  //         .equal({ publicKey: tx.requesterPublicKey });
  //     });
  //
  //     it('should throw if requester not found', async () => {
  //       accountsModuleStub.stubs.getAccount.returns(false);
  //       await expect(instance.applyUnconfirmed(tx as any, sender)).to.be.rejectedWith('Requester not found');
  //     });
  //
  //     it('should call transactionLogic.applyUnconfirmed with 3 parameters', async () => {
  //       await instance.applyUnconfirmed(tx as any, sender);
  //       expect(txLogic.stubs.applyUnconfirmed.calledOnce).to.be.true;
  //       expect(txLogic.stubs.applyUnconfirmed.firstCall.args.length).to.be.equal(3);
  //       expect(txLogic.stubs.applyUnconfirmed.firstCall.args[0]).to.be.deep.equal(tx);
  //       expect(txLogic.stubs.applyUnconfirmed.firstCall.args[1]).to.be.deep.equal(sender);
  //       expect(txLogic.stubs.applyUnconfirmed.firstCall.args[2]).to.be.deep.equal(requester);
  //     });
  //   });
  //   describe('when requesterPublicKey is NOT set', () => {
  //     it('should call transactionLogic.applyUnconfirmed with 2 parameters', async () => {
  //       await instance.applyUnconfirmed(tx as any, sender);
  //       expect(txLogic.stubs.applyUnconfirmed.calledOnce).to.be.true;
  //       expect(txLogic.stubs.applyUnconfirmed.firstCall.args.length).to.be.equal(2);
  //       expect(txLogic.stubs.applyUnconfirmed.firstCall.args[0]).to.be.deep.equal(tx);
  //       expect(txLogic.stubs.applyUnconfirmed.firstCall.args[1]).to.be.deep.equal(sender);
  //     });
  //   });
  // });
  //
  // describe('undoUnconfirmed', () => {
  //   const tx     = {
  //     id             : 'txId',
  //     senderPublicKey: 'pubKey',
  //   };
  //   const sender = { account: 'id' };
  //
  //   beforeEach(() => {
  //     accountsModuleStub.stubs.getAccount.resolves(sender);
  //     txLogic.stubs.undoUnconfirmed.resolves();
  //     dbHelper.enqueueResponse('performOps', Promise.resolve());
  //   });
  //
  //   it('should call logger.debug', async () => {
  //     await instance.undoUnconfirmed(tx);
  //     expect(loggerStub.stubs.debug.calledOnce).to.be.true;
  //     expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
  //     expect(loggerStub.stubs.debug.firstCall.args[0]).to.contain('Undoing unconfirmed transaction');
  //   });
  //
  //   it('should call accountsModule.getAccount', async () => {
  //     await instance.undoUnconfirmed(tx);
  //     expect(accountsModuleStub.stubs.getAccount.calledOnce).to.be.true;
  //     expect(accountsModuleStub.stubs.getAccount.firstCall.args.length).to.be.equal(1);
  //     expect(accountsModuleStub.stubs.getAccount.firstCall.args[0]).to.be.deep.equal({ publicKey: tx.senderPublicKey });
  //   });
  //
  //   it('should call transactionLogic.undoUnconfirmed', async () => {
  //     await instance.undoUnconfirmed(tx);
  //     expect(txLogic.stubs.undoUnconfirmed.calledOnce).to.be.true;
  //     expect(txLogic.stubs.undoUnconfirmed.firstCall.args.length).to.be.equal(2);
  //     expect(txLogic.stubs.undoUnconfirmed.firstCall.args[0]).to.be.equal(tx);
  //     expect(txLogic.stubs.undoUnconfirmed.firstCall.args[1]).to.be.equal(sender);
  //   });
  // });

  describe('count', () => {
    let txModel: typeof TransactionsModel;
    let txCountStub: SinonStub;
    beforeEach(() => {
      txModel     = container.getNamed(ModelSymbols.model, Symbols.models.transactions);
      txCountStub = sandbox.stub(txModel, 'count').resolves(12345);
      Object.defineProperty(txPool.pending, 'count', {value: 3});
      Object.defineProperty(txPool.queued, 'count', {value: 2});
      Object.defineProperty(txPool.unconfirmed, 'count', {value: 1});
    });

    it('should call db.query', async () => {
      await instance.count();
      expect(txCountStub.called).is.true;
    });

    it('should return the expected object', async () => {
      const retVal = await instance.count();
      expect(retVal).to.be.deep.equal({
        confirmed  : 12345,
        pending    : 3,
        queued     : 2,
        unconfirmed: 1,
      });
    });
  });

  describe('fillPool', () => {
    const newUnconfirmedTXs = new Array(3).fill(null)
      .map(() => createRandomTransaction())
      .map((t) => toBufferedTransaction(t));
    let filterConfIDsStub: SinonStub;
    beforeEach(() => {
      txPool.stubs.fillPool.resolves(newUnconfirmedTXs.slice());
      txPool.stubs.applyUnconfirmedList.resolves();
      filterConfIDsStub = sandbox.stub(instance, 'filterConfirmedIds').resolves([]);
    });

    it('should call txPool.fillPool', async () => {
      await instance.fillPool();
      expect(txPool.stubs.fillPool.calledOnce).to.be.true;
      expect(txPool.stubs.fillPool.firstCall.args.length).to.be.equal(0);
    });

    it('should call transactionPool.applyUnconfirmedList', async () => {
      await instance.fillPool();
      expect(txPool.stubs.applyUnconfirmedList.calledOnce).to.be.true;
      expect(txPool.stubs.applyUnconfirmedList.firstCall.args.length).to.be.equal(2);
      expect(txPool.stubs.applyUnconfirmedList.firstCall.args[0]).to.be.deep.equal(newUnconfirmedTXs);
      expect(txPool.stubs.applyUnconfirmedList.firstCall.args[1]).to.be.deep.equal(instance);
    });

    it('should query for confirmed ids', async () => {
      await instance.fillPool();
      expect(filterConfIDsStub.called).is.true;
      expect(filterConfIDsStub.firstCall.args[0]).is.deep.eq(newUnconfirmedTXs.map((t) => t.id));
    });

    it('should exclude already confirmed transaction', async () => {
      filterConfIDsStub.resolves([newUnconfirmedTXs[1].id]);
      await instance.fillPool();
      expect(txPool.stubs.applyUnconfirmedList.calledOnce).to.be.true;
      expect(txPool.stubs.applyUnconfirmedList.firstCall.args.length).to.be.equal(2);
      expect(txPool.stubs.applyUnconfirmedList.firstCall.args[0]).to.be.deep.equal([
        newUnconfirmedTXs[0],
        newUnconfirmedTXs[2],
      ]);
      expect(txPool.stubs.applyUnconfirmedList.firstCall.args[1]).to.be.deep.equal(instance);
    });
  });

  describe('getByID', () => {
    let txModel: typeof TransactionsModel;
    let findByIDStub: SinonStub;
    beforeEach(() => {
      txModel      = container.getNamed(ModelSymbols.model, Symbols.models.transactions);
      findByIDStub = sandbox.stub(txModel, 'findById').resolves('tx');
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
  describe('checkTransaction', () => {
    let tx: IBaseTransaction<any>;
    let readyStub: SinonStub;
    let genAddressStub: SinonStub;
    let verifyStub: SinonStub;
    beforeEach(() => {
      tx             = toBufferedTransaction(createRandomTransaction());
      readyStub      = sandbox.stub(txLogic, 'ready').returns(true);
      verifyStub     = sandbox.stub(txLogic, 'verify').resolves();
      genAddressStub = sandbox.stub(accountsModule, 'generateAddressByPublicKey').returns('1R');
    });
    it('should throw if account is not found in map', async () => {
      await expect(instance.checkTransaction(tx, {}, 1))
        .to.rejectedWith('Cannot find account from accounts');
    });
    it('should throw if tx has requesterPublicKey but notin accountsMap', async () => {
      tx.requesterPublicKey = Buffer.from('abababab', 'hex');
      genAddressStub.returns('1111R');
      await expect(instance.checkTransaction(tx, { [tx.senderId]: new AccountsModel() }, 1))
        .to.rejectedWith('Cannot find requester from accounts');
    });
    it('should query readyness and throw if not ready', async () => {
      readyStub.returns(false);
      await expect(instance.checkTransaction(tx, { [tx.senderId]: new AccountsModel() }, 1))
        .to.rejectedWith(`Transaction ${tx.id} is not ready`);
    });
    it('should query txLogic.verify with proper data', async () => {
      tx.requesterPublicKey = Buffer.from('abababab', 'hex');
      genAddressStub.returns('1111R');
      readyStub.returns(true);
      verifyStub.resolves();

      const account   = new AccountsModel({ address: tx.senderId });
      const requester = new AccountsModel({ address: '1111R' });
      await instance.checkTransaction(tx, {
        [tx.senderId]: account,
        '1111R'      : requester,
      }, 1);

      expect(verifyStub.calledOnce).true;
      expect(verifyStub.firstCall.args[0]).deep.eq(tx);
      expect(verifyStub.firstCall.args[1]).deep.eq(account);
      expect(verifyStub.firstCall.args[2]).deep.eq(requester);
      expect(verifyStub.firstCall.args[3]).deep.eq(1);
    });
  });
});
