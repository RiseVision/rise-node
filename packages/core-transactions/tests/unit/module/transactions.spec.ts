import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { TransactionPool, TransactionsModel, TransactionsModule, TXSymbols } from '../../../src';
import { IAccountsModel, IAccountsModule, IDBHelper, ITransactionLogic, Symbols } from '@risevision/core-interfaces';
import { IBaseTransaction, SignedAndChainedBlockType } from '../../../../core-types/src';
import { createContainer } from '../../../../core-launchpad/tests/unit/utils/createContainer';
import { InnerTXQueue } from '../../../src/poolTXsQueue';
import { createRandomTransaction, toBufferedTransaction } from '../utils/txCrafter';
import { ModelSymbols } from '@risevision/core-models';
import { StubbedInstance } from '../../../../core-utils/tests/unit/stubs';
import { generateAccount } from '../../../../core-accounts/tests/unit/utils/accountsUtils';

chai.use(chaiAsPromised);

class StubTxQueue extends StubbedInstance(InnerTXQueue) {
}

class StubTxPool extends StubbedInstance(TransactionPool) {
  protected queues = {
    unconfirmed: new StubTxQueue('unconfirmed'),
    ready      : new StubTxQueue('ready'),
    queued     : new StubTxQueue('queued'),
    pending    : new StubTxQueue('pending')
  };
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

  before(async () => {
    container = await createContainer(['core-transactions', 'core-helpers', 'core-blocks', 'core', 'core-accounts']);
    container.rebind(Symbols.logic.txpool).to(StubTxPool);

  });
  beforeEach(async () => {
    sandbox                     = sinon.createSandbox();
    instance                    = container.get(TXSymbols.module);
    txPool                      = container.get(TXSymbols.pool);
    instance['transactionPool'] = txPool;
    accountsModule              = container.get(Symbols.modules.accounts);
    AccountsModel               = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    dbHelper                    = container.get(Symbols.helpers.db);
    genesisBlock                = container.get(Symbols.generic.genesisBlock);
    txLogic                     = container.get(Symbols.logic.transaction);
  });

  afterEach(() => {
    sandbox.restore();
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

  describe('applyUnconfirmed', () => {
    let tx;
    let sender;
    let requester: IAccountsModel;
    let getAccountStub: SinonStub;
    let applyUnconfirmedSpy: SinonSpy;
    beforeEach(() => {
      const acc = generateAccount();
      tx        = createRandomTransaction(acc);
      sender    = new AccountsModel({
        address  : acc.address,
        balance  : tx.amount * 2 + tx.fee,
        u_balance: tx.amount * 2 + tx.fee,
        publicKey: Buffer.from(acc.publicKey, 'hex')
      });

      const req           = generateAccount();
      requester           = new AccountsModel({ address: req.address, publicKey: Buffer.from(req.publicKey, 'hex') });
      getAccountStub      = sandbox.stub(accountsModule, 'getAccount').resolves(requester);
      applyUnconfirmedSpy = sandbox.spy(txLogic, 'applyUnconfirmed');

      sandbox.stub(dbHelper, 'performOps').resolves();
    });

    it('should throw if sender not set', async () => {
      await expect(instance.applyUnconfirmed(tx as any, undefined)).to.be.rejectedWith('Invalid sender');
    });

    describe('when requesterPublicKey is set', () => {
      beforeEach(() => {
        tx.requesterPublicKey = 'requesterPublicKey';
      });

      it('should call accountsModule.getAccount', async () => {
        await instance.applyUnconfirmed(tx as any, sender);
        expect(getAccountStub.calledOnce).to.be.true;
        expect(getAccountStub.firstCall.args.length).to.be.equal(1);
        expect(getAccountStub.firstCall.args[0]).to.be.deep
          .equal({ publicKey: tx.requesterPublicKey });
      });

      it('should throw if requester not found', async () => {
        getAccountStub.returns(false);
        await expect(instance.applyUnconfirmed(tx as any, sender)).to.be.rejectedWith('Requester not found');
      });

      it('should call transactionLogic.applyUnconfirmed with 3 parameters', async () => {
        await instance.applyUnconfirmed(tx as any, sender);
        expect(applyUnconfirmedSpy.calledOnce).to.be.true;
        expect(applyUnconfirmedSpy.firstCall.args.length).to.be.equal(3);
        expect(applyUnconfirmedSpy.firstCall.args[0]).to.be.deep.equal(tx);
        expect(applyUnconfirmedSpy.firstCall.args[1]).to.be.deep.equal(sender);
        expect(applyUnconfirmedSpy.firstCall.args[2]).to.be.deep.equal(requester);
      });
    });
    describe('when requesterPublicKey is NOT set', () => {
      it('should call transactionLogic.applyUnconfirmed with 2 parameters', async () => {
        await instance.applyUnconfirmed(tx as any, sender);
        expect(applyUnconfirmedSpy.calledOnce).to.be.true;
        expect(applyUnconfirmedSpy.firstCall.args.length).to.be.equal(2);
        expect(applyUnconfirmedSpy.firstCall.args[0]).to.be.deep.equal(tx);
        expect(applyUnconfirmedSpy.firstCall.args[1]).to.be.deep.equal(sender);
      });
    });
  });

  describe('undoUnconfirmed', () => {
    let tx;
    let sender;

    let getAccountStub: SinonStub;
    let undoUnconfirmedSpy: SinonSpy;
    let dbHelperStub: SinonStub;
    beforeEach(() => {
      const acc          = generateAccount();
      tx                 = createRandomTransaction(acc);
      sender             = new AccountsModel({
        address  : acc.address,
        balance  : tx.amount * 2 + tx.fee,
        u_balance: tx.amount * 2 + tx.fee,
        publicKey: Buffer.from(acc.publicKey, 'hex')
      });
      getAccountStub     = sandbox.stub(accountsModule, 'getAccount').resolves(sender);
      undoUnconfirmedSpy = sandbox.spy(txLogic, 'undoUnconfirmed');
      dbHelperStub       = sandbox.stub(dbHelper, 'performOps').resolves();
    });

    it('should call accountsModule.getAccount', async () => {
      await instance.undoUnconfirmed(tx);
      expect(getAccountStub.calledOnce).to.be.true;
      expect(getAccountStub.firstCall.args.length).to.be.equal(1);
      expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({ publicKey: tx.senderPublicKey });
    });

    it('should call transactionLogic.undoUnconfirmed', async () => {
      await instance.undoUnconfirmed(tx);
      expect(undoUnconfirmedSpy.calledOnce).to.be.true;
      expect(undoUnconfirmedSpy.firstCall.args.length).to.be.equal(2);
      expect(undoUnconfirmedSpy.firstCall.args[0]).to.be.equal(tx);
      expect(undoUnconfirmedSpy.firstCall.args[1]).to.be.equal(sender);
    });
  });

  describe('count', () => {
    let txModel: typeof TransactionsModel;
    let txCountStub: SinonStub;
    beforeEach(() => {
      txModel     = container.getNamed(ModelSymbols.model, Symbols.models.transactions);
      txCountStub = sandbox.stub(txModel, 'count').resolves(12345);
      Object.defineProperty(txPool.pending, 'count', { value: 3 });
      Object.defineProperty(txPool.queued, 'count', { value: 2 });
      Object.defineProperty(txPool.unconfirmed, 'count', { value: 1 });
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
        ready      : 0,
      });
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

    // it('should query readyness and throw if not ready', async () => {
    //   readyStub.returns(false);
    //   await expect(instance.checkTransaction(tx, { [tx.senderId]: new AccountsModel() }, 1))
    //     .to.rejectedWith(`Transaction ${tx.id} is not ready`);
    // });
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

  describe('processIncomingTransactions', () => {
    it('should throw if tx is not passing through txLogic.objectNormalize');
    it('should remove peer if normalizationf ailed');
    it('should add valid transactions to the queued queue of the txpool');
    it('should filter already confirmed transactions');
  });
});
