import * as chai from 'chai';
// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { InnerTXQueue, TransactionPool} from '../../../src/logic';

import { AccountsModuleStub, JobsQueueStub, LoggerStub, TransactionLogicStub } from '../../stubs';

chai.use(assertArrays);
const expect = chai.expect;

// tslint:disable no-unused-expression
describe('logic/transactionPool - InnerTXQueue', () => {
  let instance: InnerTXQueue;
  let sandbox: SinonSandbox;
  let hasSpy: SinonSpy;

  const tx1 = { id: 'tx1' };
  const tx2 = { id: 'tx2' };
  const tx3 = { id: 'tx3' };

  const payload1 = { pay : 'load'};

  const addTransactions = (inst: InnerTXQueue) => {
    inst.add(tx1 as any, payload1 as any);
    inst.add(tx2 as any);
    inst.add(tx3 as any);
  };

  beforeEach(() => {
    instance = new InnerTXQueue();
    sandbox = sinon.sandbox.create();
    hasSpy = sandbox.spy(instance, 'has');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('has', () => {
    it('should return true if the index has an element with the given id', () => {
      addTransactions(instance);
      expect(instance.has('tx1')).to.be.true;
    });

    it('should return false if the index has NO element with the given id', () => {
      // instance is fresh
      expect(instance.has('tx1')).to.be.false;
    });
  });

  describe('count', () => {
    it('should return the number of transactions', () => {
      addTransactions(instance);
      expect(instance.count).to.be.equal(3);
    });
  });

  describe('remove', () => {
    it('should call has()', () => {
      instance.remove('tx1');
      expect(hasSpy.calledOnce).to.be.true;
      expect(hasSpy.firstCall.args[0]).to.be.equal(tx1.id);
    });

    it('should delete the item from index, transactions and payload', () => {
      addTransactions(instance);
      instance.remove('tx2');
      expect((instance as any).transactions).to.be.equalTo([tx1, undefined, tx3]);
      expect((instance as any).index).to.be.deep.equal({tx1: 0, tx3: 2 });
      expect((instance as any).payload).to.be.deep.equal({tx1: payload1, tx3: undefined});
    });
  });

  describe('add', () => {
    it('should call has()', () => {
      instance.add(tx1 as any);
      expect(hasSpy.calledOnce).to.be.true;
      expect(hasSpy.firstCall.args[0]).to.be.equal(tx1.id);
    });

    it('should insert the item in index, transactions and payload', () => {
      instance.add(tx1 as any, payload1 as any);
      expect((instance as any).transactions).to.be.equalTo([tx1]);
      expect((instance as any).index).to.be.deep.equal({tx1: 0});
      expect((instance as any).payload).to.be.deep.equal({tx1: payload1});
    });
  });

  describe('get', () => {
    it('should call has()', () => {
      addTransactions(instance);
      hasSpy.reset();
      instance.get('tx2');
      expect(hasSpy.calledOnce).to.be.true;
      expect(hasSpy.firstCall.args[0]).to.be.equal('tx2');
    });

    it('should throw an error if tx is not found', () => {
      addTransactions(instance);
      expect(() => {
        instance.get('notFoundTx');
      }).to.throw('Transaction not found in this queue notFoundTx');
    });

    it('should return the right transaction', () => {
      addTransactions(instance);
      const retVal = instance.get('tx2');
      expect(retVal).to.be.deep.equal(tx2);
    });
  });

  describe('reindex', () => {
    it('should remove from transactions the undefined transactions', () => {
      addTransactions(instance);
      instance.remove('tx2');
      expect((instance as any).transactions).to.be.equalTo([tx1, undefined, tx3]);
      instance.reindex();
      expect((instance as any).transactions).to.be.equalTo([tx1, tx3]);
    });

    it('should rebuild the index from scratch', () => {
      addTransactions(instance);
      instance.remove('tx2');
      expect((instance as any).index).to.be.deep.equal({tx1: 0, tx3: 2 });
      instance.reindex();
      expect((instance as any).index).to.be.deep.equal({tx1: 0, tx3: 1 });
    });
  });

  describe('list', () => {
    it('should return an array', () => {
      addTransactions(instance);
      const retVal = instance.list(false);
      expect(Array.isArray(retVal)).to.be.true;
    });

    it('should not return undefined transactions', () => {
      addTransactions(instance);
      instance.remove('tx2');
      const retVal = instance.list(false);
      expect(retVal).to.be.equalTo([tx1, tx3]);
    });

    it('should call the filterFn if passed', () => {
      const filterFnSpy = sandbox.spy();
      const filterFn = (item) => {
        filterFnSpy(item);
        return item;
      };
      addTransactions(instance);
      instance.list(false, 10, filterFn);
      expect(filterFnSpy.callCount).to.be.equal(3);
      expect(filterFnSpy.firstCall.args[0]).to.be.deep.equal(tx1);
      expect(filterFnSpy.secondCall.args[0]).to.be.deep.equal(tx2);
      expect(filterFnSpy.thirdCall.args[0]).to.be.deep.equal(tx3);
    });

    it('should reverse the array if requested', () => {
      addTransactions(instance);
      const retVal = instance.list(true);
      expect(retVal).to.be.equalTo([tx3, tx2, tx1]);
    });

    it('should not reverse the array if not requested', () => {
      addTransactions(instance);
      const retVal = instance.list(false);
      expect(retVal).to.be.equalTo((instance as any).transactions);
    });

    it('should return no more than the number of transactions specified in limit', () => {
      addTransactions(instance);
      expect(instance.count).to.be.equal(3);
      const retVal = instance.list(false, 2);
      expect(retVal.length).to.be.equal(2);
    });

    it('should return all transactions if limit not specified', () => {
      addTransactions(instance);
      const retVal = instance.list(false);
      expect(retVal.length).to.be.equal(instance.count);
    });
  });

  describe('listWithPayload', () => {
    it('should call list() passing all args', () => {
      addTransactions(instance);
      const listSpy = sandbox.spy(instance, 'list');
      const args: any = [false, 100, (a) => a];
      instance.listWithPayload(args[0], args[1], args[2]);
      expect(listSpy.calledOnce).to.be.true;
      expect(listSpy.firstCall.args).to.be.equalTo(args);
    });

    it('should return an array of objects with tx and payload', () => {
      addTransactions(instance);
      const retVal = instance.listWithPayload(false);
      expect(Array.isArray(retVal)).to.be.true;
      expect(retVal[0]).to.be.deep.equal({tx: tx1, payload: payload1});
      expect(retVal[1]).to.be.deep.equal({tx: tx2, payload: undefined});
      expect(retVal[2]).to.be.deep.equal({tx: tx3, payload: undefined});
    });
  });
});

describe('logic/transactionPool - TransactionPool', () => {
  let sandbox: SinonSandbox;
  let instance: TransactionPool;
  let fakeBus: {message: SinonStub};
  let fakeAppState: {get: SinonStub};
  let jqStub: JobsQueueStub;
  let loggerStub: LoggerStub;
  let transactionLogicStub: TransactionLogicStub;
  let accountsModuleStub = new AccountsModuleStub();

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    instance = new TransactionPool();
    fakeBus = {message: sandbox.stub()};
    fakeAppState = {get: sandbox.stub()};
    jqStub = new JobsQueueStub();
    loggerStub = new LoggerStub();
    transactionLogicStub = new TransactionLogicStub();
    accountsModuleStub = new AccountsModuleStub();

    // dependencies
    (instance as any).bus = fakeBus;
    (instance as any).jobsQueue = jqStub;
    (instance as any).logger = loggerStub;
    (instance as any).appState = fakeAppState;
    (instance as any).transactionLogic = transactionLogicStub;
    (instance as any).accountsModule = accountsModuleStub;
    (instance as any).config = {
      broadcasts: {
        broadcastInterval: 1500,
        bundleLimig: 100,
      },
      transactions: {
        maxTxsPerQueue: 100,
      },
    };
    instance.afterConstruction();
    // we preserve behavior of the inner queues
    const spiedQueues = {};
    ['unconfirmed', 'bundled', 'queued', 'multisignature'].forEach((queueName) => {
      if (typeof spiedQueues[queueName] === 'undefined') {
        spiedQueues[queueName] = {};
      }
      ['has', 'remove', 'add', 'get', 'reindex', 'list', 'listWithPayload'].forEach((method: string) => {
        spiedQueues[queueName][method] = sandbox.spy(instance[queueName], method);
      });
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('afterConstruction', () => {
    it('should call jobsQueue.register for NextBundle and NextExpiry', () => {
      // afterConstruction has been already called here
      expect(jqStub.stubs.register.called).to.be.true;
      expect(jqStub.stubs.register.callCount).to.be.equal(2);
      expect(jqStub.stubs.register.firstCall.args[0]).to.be.equal('transactionPoolNextBundle');
      expect(jqStub.stubs.register.secondCall.args[0]).to.be.equal('transactionPoolNextExpiry');
    });
  });

  describe('queueTransaction', () => {
    it('should add the tx to bundled queue if this.bundled');
    it('should add the tx to multisignature queue if que is MULTI or if it has signatures');
    it('should else add the tx to queued queue');
    it('should throw if pool is full');
  });

  describe('fillPool', () => {
    it('should resolve with empty array if appState.loader.isSyncing');
    it('should call logger.debug');
    it('should resolve with empty array if no spare space');
    it('should call listWithPayload on multisignature queue');
    it('should call listWithPayload on queued queue');
    it('should call remove on multisignature queue for each multisig or queued tx');
    it('should call remove on queued queue for each multisig or queued tx');
    it('should call add on unconfirmed queue for each multisig or queued tx');
    it('should return an array of transactions');
  });

  describe('transactionInPool', () => {
    it('should return true if tx is in any of the queues');
    it('should return false if tx not found');
  });

  describe('getMergedTransactionList', () => {
    it('should call list on the 3 queues');
    it('should return all the txs in a merged array');
  });

  describe('expireTransactions', () => {
    it('should call listWithPayload (reversed) on the 3 queues');
    it('should call txTimeout() for each transaction');
    it('should call removeUnconfirmedTransaction when a tx is expired');
    it('should call logger.info when an expired tx is removed');
    it('should return an array of IDs');
  });

  describe('processBundled', () => {
    it('should call list with reverse and limit on bundled queue');
    it('should call remove on bundled for each tx');
    it('should call processVerifyTransaction for each valid tx');
    it('should call queueTransaction for each valid tx if processVerifyTransaction did not throw');
    it('should not call queueTransaction for each valid tx if processVerifyTransaction throws');
    it('should call logger.debug if queueTransaction fails');
    it('should call logger.debug if processVerifyTransaction throws');
    it('should call removeUnconfirmedTransaction if processVerifyTransaction fails');
  });

  describe('receiveTransactions', () => {
    it('should return a promise');
    it('should call processNewTransaction for each of the passed txs');
  });

  describe('processNewTransaction', () => {
    it('should return a promise');
    it('should call transactionInPool');
    it('should reject if transaction is in pool');
    it('should call reindexAllQueues if more than 1000 txs were processed');
    it('should call queueTransaction if bundled is true');
    it('should call processVerifyTransaction');
    it('should call queueTransaction');
    it('should not call queueTransaction if processVerifyTransaction throwed');
  });

  describe('applyUnconfirmedList', () => {
    it('should call get on unconfirmed queue');
    it('should call processVerifyTransaction for each valid tx');
    it('should call applyUnconfirmed on txModule for each valid tx if processVerifyTransaction did not throw');
    it('should not call applyUnconfirmed on txModule for each valid tx if processVerifyTransaction throws');
    it('should call logger.error if applyUnconfirmed fails');
    it('should call logger.error if processVerifyTransaction throws');
    it('should call removeUnconfirmedTransaction if processVerifyTransaction fails');
    it('should call removeUnconfirmedTransaction if applyUnconfirmed fails');

  });

  describe('undoUnconfirmedList', () => {
    it('should return an array of ids');
    it('should call list on unconfirmed queue');
    it('should call undoUnconfirmed on txModule for each tx');
    it('should call logger.error if undoUnconfirmed throws');
    it('should call removeUnconfirmedTransaction if undoUnconfirmed throws');
  });

  describe('reindexAllQueues', () => {
    it('should call reindex on all queues');
  });

  describe('removeUnconfirmedTransaction', () => {
    it('should call remove on unconfirmed, queued and multisignature');
  });

  describe('processVerifyTransaction', () => {
    it('should throw if !transaction');
    it('should call accountsModule.setAccountAndGet');
    it('should call accountsModule.getAccount');
    it('should call transactionLogic.process');
    it('should call transactionLogic.objectNormalize');
    it('should call transactionLogic.verify');
    it('should call bus.message');
  });
});
