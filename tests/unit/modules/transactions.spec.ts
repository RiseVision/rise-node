import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { Symbols } from '../../../src/ioc/symbols';
import { SignedAndChainedBlockType } from '../../../src/logic';
import { TransactionsModule } from '../../../src/modules';
import {
  AccountsModuleStub,
  DbStub,
  LoggerStub,
  TransactionLogicStub,
  TransactionPoolStub,
} from '../../stubs';

import { createContainer } from '../../utils/containerCreator';

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
    container.rebind(Symbols.modules.transactions).to(TransactionsModule);
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
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('cleanup', () => {
    it('should resolve');
  });

  describe('transactionInPool', () => {
    it('should call txPool.transactionInPool and return');
  });

  describe('getUnconfirmedTransaction', () => {
    it('should call txPool.unconfirmed.get and return');
  });

  describe('getQueuedTransaction', () => {
    it('should call txPool.queued.get and return');
  });

  describe('getMultisignatureTransaction', () => {
    it('should call txPool.multisignature.get and return');
  });

  describe('getUnconfirmedTransactionList', () => {
    it('should call txPool.unconfirmed.list and return');
  });

  describe('getQueuedTransactionList', () => {
    it('should call txPool.queued.list and return');
  });

  describe('getMultisignatureTransactionList', () => {
    it('should call txPool.multisignature.list and return');
  });

  describe('getMergedTransactionList', () => {
    it('should call txPool.getMergedTransactionList and return');
  });

  describe('removeUnconfirmedTransaction', () => {
    it('should call txPool.unconfirmed.remove, txPool.queued.remove, txPool.multisignature.remove');
  });

  describe('processUnconfirmedTransaction', () => {
    it('should call txPool.processNewTransaction and return');
  });

  describe('applyUnconfirmedIds', () => {
    it('should call txPool.applyUnconfirmedList and return');
  });

  describe('applyUnconfirmedList', () => {
    it('should call txPool.applyUnconfirmedList and return');
    it('should call txPool.unconfirmed.list and pass result as first param');
  });

  describe('undoUnconfirmedList', () => {
    it('should call txPool.undoUnconfirmedList and return');
  });

  describe('apply', () => {
    it('should call logger.debug');
    it('should call txPool.apply and return');
  });

  describe('undo', () => {
    it('should call logger.debug');
    it('should call txPool.undo and return');
  });

  describe('applyUnconfirmed', () => {
    it('should call logger.debug');
    it('should throw if sender not set and not in genesis block');
    describe('when requesterPublicKey is set', () => {
      it('should call accountsModule.getAccount');
      it('should throw if requester not found');
      it('should call transactionLogic.applyUnconfirmed with 3 parameters');
    });
    describe('when requesterPublicKey is NOT set', () => {
      it('should call transactionLogic.applyUnconfirmed with 2 parameters');
    });
  });

  describe('undoUnconfirmed', () => {
    it('should call logger.debug');
    it('should call accountsModule.getAccount');
    it('should call transactionLogic.undoUnconfirmed');
  });

  describe('receiveTransactions', () => {
    it('should call txPool.receiveTransactions');
  });

  describe('count', () => {
    it('should call db.query');
    it('should call count on all InnerTXQueues');
    it('should return the expected object');
  });

  describe('fillPool', () => {
    it('should call txPool.fillPool');
    it('should call transactionPool.applyUnconfirmedList');
  });

  describe('isLoaded', () => {
    it('should return true');
  });

  describe('list', () => {
    describe('filter validation', () => {
      it('should throw if filter item\'s condition is not OR or AND');
      it('should prepend unshift OR to filter item if no column inside');
      it('should throw if filter item contains more than two column-separated elements');
      it('should uppercase the or / and conditions');
      it('should mutate fromUnixTime and toUnixTime to fromTimestamp and toTimestamp');
      it('should throw if parameter value not supported');
      it('should throw if parameter is empty for fromTimestamp, minAmount, minConfirmations, type, offset');
      it('should add a space after non-first where clauses');
      it('should set limit to 100 if not specified');
      it('should abs the passed limit');
      it('should set offset to 0 if not specified');
      it('should abs the passed offset');
      it('should throw if limit more than 1000');
    });

    it('should call OrderBy');
    it('should throw if OrderBy retuns error state');

    describe('countList query', () => {
      it('should call db.query');
      it('should call sql.countList');
      it('should call logger.error if db.query throws');
      it('should reject if db.query throws');
    });

    describe('list query', () => {
      it('should call db.query');
      it('should call sql.list');
      it('should call logger.error if db.query throws');
      it('should reject if db.query throws');
    });

    it('should call transactionLogic.dbRead for each transaction');
    it('should return an object with count and transactions');
  });

  describe('getByID', () => {
    it('should call db.query');
    it('should throw if tx not found');
    it('should else call transactionLogic.dbRead and return');
  });
});
