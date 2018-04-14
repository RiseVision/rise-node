import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { TransactionType } from '../../../src/helpers';
import { InnerTXQueue, TransactionPool} from '../../../src/logic';
import { IBaseTransaction } from '../../../src/logic/transactions';
import {
  AccountsModuleStub, JobsQueueStub, LoggerStub, SequenceStub,
  TransactionLogicStub, TransactionsModuleStub
} from '../../stubs';

chai.use(chaiAsPromised);
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

  describe('getPayload', () => {
    it('should returns undefined', () => {
      expect(instance.getPayload({id: 'abc'} as any)).to.be.undefined;
    });

    it('should returns payload', () => {
      instance.add(tx1 as any, payload1 as any);
      expect(instance.getPayload({id: 'tx1'} as any)).to.deep.equal(payload1);
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
      hasSpy.resetHistory();
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
  let accountsModuleStub: AccountsModuleStub;
  let balanceSequenceStub: SequenceStub;
  let tx: IBaseTransaction<any>;
  let tx2: IBaseTransaction<any>;
  let tx3: IBaseTransaction<any>;

  const addMixedTransactionsAndFillPool = async (withSignatures: boolean) => {
    const allTxs = [];
    // Add 50 txs to various queues
    for (let i = 0; i < 50; i++) {
      if (i === 24) {
        await instance.fillPool();
      }
      const newTx = Object.assign({}, tx);

      if (withSignatures) {
        if (i % 2 === 0) {
          newTx.signatures = ['aaa', 'bbb'];
        }
      }

      newTx.id = 'tx_' + i;
      if (i < 12) {
        newTx.type = TransactionType.MULTI;
        newTx.asset = {
          multisignature: {
            timeout: 2,
          },
        };
      }
      const bundled = (i >= 12 && i < 25);
      instance.queueTransaction(newTx, bundled);
      if (newTx.type === TransactionType.MULTI) {
        instance.multisignature.getPayload(newTx).ready = (i % 2 === 0);
      }
      allTxs.push(newTx);
    }
    sandbox.resetHistory();
    loggerStub.stubReset();
    return allTxs;
  };

  let spiedQueues: {
    'unconfirmed': { [k in keyof InnerTXQueue]?: SinonSpy },
    'bundled': { [k in keyof InnerTXQueue]?: SinonSpy },
    'queued': { [k in keyof InnerTXQueue]?: SinonSpy },
    'multisignature': { [k in keyof InnerTXQueue]?: SinonSpy }
  };

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    instance = new TransactionPool();
    fakeBus = {message: sandbox.stub().resolves()};
    fakeAppState = {get: sandbox.stub()};
    jqStub = new JobsQueueStub();
    loggerStub = new LoggerStub();
    transactionLogicStub = new TransactionLogicStub();
    accountsModuleStub = new AccountsModuleStub();
    balanceSequenceStub = new SequenceStub();
    // dependencies
    (instance as any).bus = fakeBus;
    (instance as any).jobsQueue = jqStub;
    (instance as any).logger = loggerStub;
    (instance as any).appState = fakeAppState;
    (instance as any).balancesSequence = balanceSequenceStub;
    (instance as any).transactionLogic = transactionLogicStub;
    (instance as any).accountsModule = accountsModuleStub;
    (instance as any).config = {
      broadcasts: {
        broadcastInterval: 1500,
        releaseLimit: 100,
      },
      transactions: {
        maxTxsPerQueue: 50,
      },
    };
    instance.afterConstruction();
    spiedQueues = {
      unconfirmed: {},
      bundled: {},
      queued: {},
      multisignature: {},
    };
    // we preserve behavior of the inner queues but we spy on all methods.
    ['unconfirmed', 'bundled', 'queued', 'multisignature'].forEach((queueName) => {
      if (typeof spiedQueues[queueName] === 'undefined') {
        spiedQueues[queueName] = {};
      }
      ['has', 'remove', 'add', 'get', 'reindex', 'list', 'listWithPayload'].forEach((method: string) => {
        spiedQueues[queueName][method] = sandbox.spy(instance[queueName], method);
      });
    });

    tx = {
      type           : TransactionType.SEND,
      amount         : 108910891000000,
      fee            : 10,
      timestamp      : 0,
      recipientId    : '15256762582730568272R',
      senderId       : '1233456789012345R',
      senderPublicKey: '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3',
      signature      : 'f8fbf9b8433bf1bbea971dc8b14c6772d33c7dd285d84c5e6c984b10c4141e9f' +
                       'a56ace902b910e05e98b55898d982b3d5b9bf8bd897083a7d1ca1d5028703e03',
      id             : '8139741256612355994',
      asset          : {},
    };

    // Clone the tx to separate objects with different IDs
    tx2 = Object.assign({}, tx);
    tx2.id = 'tx2';

    tx3 = Object.assign({}, tx);
    tx3.id = 'tx3';
    sandbox.resetHistory();
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
      expect(jqStub.stubs.register.firstCall.args[1]).to.be.a('function');
      expect(jqStub.stubs.register.secondCall.args[0]).to.be.equal('transactionPoolNextExpiry');
      expect(jqStub.stubs.register.secondCall.args[1]).to.be.a('function');
    });
  });

  describe('queueTransaction', () => {
    it('should add the tx to bundled queue if bundled is true', () => {
      instance.queueTransaction(tx, true);
      expect(spiedQueues.bundled.add.calledOnce).to.be.true;
      expect(spiedQueues.multisignature.add.calledOnce).to.be.false;
      expect(spiedQueues.queued.add.calledOnce).to.be.false;
      expect(spiedQueues.bundled.add.firstCall.args[0]).to.be.deep.equal(tx);
      expect(spiedQueues.bundled.add.firstCall.args[1].receivedAt).to.be.instanceof(Date);
    });

    it('should add the tx to multisignature queue if tx.type is MULTI', () => {
      tx.type = TransactionType.MULTI;
      instance.queueTransaction(tx, false);
      expect(spiedQueues.multisignature.add.calledOnce).to.be.true;
      expect(spiedQueues.bundled.add.calledOnce).to.be.false;
      expect(spiedQueues.queued.add.calledOnce).to.be.false;
      expect(spiedQueues.multisignature.add.firstCall.args[0]).to.be.deep.equal(tx);
      expect(spiedQueues.multisignature.add.firstCall.args[1].receivedAt).to.be.instanceof(Date);
    });

    it('should add the tx to multisignature queue tx has signatures', () => {
      tx.signatures = ['a', 'b'];
      instance.queueTransaction(tx, false);
      expect(spiedQueues.multisignature.add.calledOnce).to.be.true;
      expect(spiedQueues.bundled.add.calledOnce).to.be.false;
      expect(spiedQueues.queued.add.calledOnce).to.be.false;
      expect(spiedQueues.multisignature.add.firstCall.args[0]).to.be.deep.equal(tx);
      expect(spiedQueues.multisignature.add.firstCall.args[1].receivedAt).to.be.instanceof(Date);
    });

    it('should else add the tx to queued queue', () => {
      instance.queueTransaction(tx, false);
      expect(spiedQueues.queued.add.calledOnce).to.be.true;
      expect(spiedQueues.bundled.add.calledOnce).to.be.false;
      expect(spiedQueues.multisignature.add.calledOnce).to.be.false;
      expect(spiedQueues.queued.add.firstCall.args[0]).to.be.deep.equal(tx);
      expect(spiedQueues.queued.add.firstCall.args[1].receivedAt).to.be.instanceof(Date);
    });

    it('should throw if pool is full', () => {
      (instance as any).config.transactions.maxTxsPerQueue = 2;
      instance.queueTransaction(tx, false);
      spiedQueues.queued.add.resetHistory();
      instance.queueTransaction(tx2, false);
      spiedQueues.queued.add.resetHistory();
      expect(() => {
        instance.queueTransaction(tx3, false);
      }).to.throw('Transaction pool is full');
      expect(spiedQueues.bundled.add.called).to.be.false;
      expect(spiedQueues.multisignature.add.called).to.be.false;
      expect(spiedQueues.queued.add.called).to.be.false;
    });
  });

  describe('fillPool', () => {
    const addFillPoolTxs = () => {
      // tx and tx2 go to multisignature queue
      tx.type = TransactionType.MULTI;
      instance.queueTransaction(tx, false);
      instance.multisignature.getPayload(tx).ready = true;
      tx2.type = TransactionType.MULTI;
      instance.queueTransaction(tx2, false);
      instance.multisignature.getPayload(tx2).ready = true;
      // tx3 goes to queued queue
      instance.queueTransaction(tx3, false);
    };

    it('should resolve with empty array if appState.loader.isSyncing', async () => {
      fakeAppState.get.returns(true);
      const retVal = await instance.fillPool();
      expect(retVal).to.be.equalTo([]);
      // Make sure it returned immediately
      expect(loggerStub.stubs.debug.called).to.be.false;
    });

    it('should call logger.debug', async () => {
      await instance.fillPool();
      expect(loggerStub.stubs.debug.called).to.be.true;
      expect(loggerStub.stubs.debug.args[0]).to.match(/Transaction pool size/);
    });

    it('should resolve with empty array if no spare space', async () => {
      const bigIndex = {};
      for (let i = 0; i < 100; i++) {
        bigIndex['tx' + i] = i;
      }
      (instance.unconfirmed as any).index = bigIndex;
      const retVal = await instance.fillPool();
      expect(retVal).to.be.equalTo([]);
      // In this case logger.debug is called
      expect(loggerStub.stubs.debug.called).to.be.true;
      expect(loggerStub.stubs.debug.args[0]).to.match(/Transaction pool size/);
    });

    it('should call listWithPayload on multisignature queue', async () => {
      await instance.fillPool();
      expect(spiedQueues.multisignature.listWithPayload.called).to.be.true;
      expect(spiedQueues.multisignature.listWithPayload.firstCall.args[0]).to.be.true;
      expect(spiedQueues.multisignature.listWithPayload.firstCall.args[1]).to.be.equal(5);
      expect(spiedQueues.multisignature.listWithPayload.firstCall.args[2]).to.be.instanceof(Function);
    });

    it('should call listWithPayload on queued queue', async () => {
      await instance.fillPool();
      expect(spiedQueues.queued.listWithPayload.called).to.be.true;
      expect(spiedQueues.queued.listWithPayload.firstCall.args[0]).to.be.true;
      expect(spiedQueues.queued.listWithPayload.firstCall.args[1]).to.be.equal(25);
    });

    it('should call remove on multisignature queue for each multisig or queued tx', async () => {
      addFillPoolTxs();
      await instance.fillPool();
      expect(spiedQueues.multisignature.remove.callCount).to.be.equal(3);
      expect(spiedQueues.multisignature.remove.firstCall.args[0]).to.be.equal(tx2.id);
      expect(spiedQueues.multisignature.remove.secondCall.args[0]).to.be.equal(tx.id);
      expect(spiedQueues.multisignature.remove.thirdCall.args[0]).to.be.equal(tx3.id);
    });

    it('should call remove on queued queue for each multisig or queued tx', async () => {
      addFillPoolTxs();
      await instance.fillPool();
      expect(spiedQueues.queued.remove.callCount).to.be.equal(3);
      expect(spiedQueues.queued.remove.firstCall.args[0]).to.be.equal(tx2.id);
      expect(spiedQueues.queued.remove.secondCall.args[0]).to.be.equal(tx.id);
      expect(spiedQueues.queued.remove.thirdCall.args[0]).to.be.equal(tx3.id);
    });

    it('should call add on unconfirmed queue for each multisig or queued tx', async () => {
      addFillPoolTxs();
      await instance.fillPool();
      expect(spiedQueues.unconfirmed.add.callCount).to.be.equal(3);
      expect(spiedQueues.unconfirmed.add.firstCall.args[0]).to.be.deep.equal(tx2);
      expect(spiedQueues.unconfirmed.add.secondCall.args[0]).to.be.deep.equal(tx);
      expect(spiedQueues.unconfirmed.add.thirdCall.args[0]).to.be.deep.equal(tx3);
    });

    it('should return an array of transactions', async () => {
      addFillPoolTxs();
      const retVal = await instance.fillPool();
      expect(Array.isArray(retVal)).to.be.true;
      expect(retVal).to.be.equalTo([tx2, tx, tx3]);
    });
  });

  describe('transactionInPool', () => {
    it('should return true if tx is in any of the queues', () => {
      instance.queueTransaction(tx, false);
      expect(instance.transactionInPool(tx.id)).to.be.true;
    });

    it('should return false if tx not found', () => {
      instance.queueTransaction(tx, false);
      expect(instance.transactionInPool(tx2.id)).to.be.false;
    });
  });

  describe('getMergedTransactionList', () => {
    it('should call list on the 3 queues', async () => {
      await addMixedTransactionsAndFillPool();
      instance.getMergedTransactionList(30);
      expect(spiedQueues.unconfirmed.list.called).to.be.true;
      expect(spiedQueues.multisignature.list.called).to.be.true;
      expect(spiedQueues.queued.list.called).to.be.true;
    });

    it('should return all the txs in a merged array', async () => {
      await addMixedTransactionsAndFillPool();
      const retVal = instance.getMergedTransactionList(30);
      const expectedIDs = [ 'tx_10', 'tx_8', 'tx_6', 'tx_4', 'tx_2', 'tx_25', 'tx_26', 'tx_27', 'tx_28',
        'tx_29', 'tx_30', 'tx_31', 'tx_32', 'tx_33', 'tx_34', 'tx_35', 'tx_36', 'tx_37', 'tx_38', 'tx_39', 'tx_40',
        'tx_41', 'tx_42', 'tx_43', 'tx_44', 'tx_45', 'tx_46', 'tx_47', 'tx_48', 'tx_49'];

      expect(Array.isArray(retVal)).to.be.true;
      expect(retVal.length).to.be.equal(expectedIDs.length);
      expect(retVal.map((t) => t.id)).to.be.deep.eq(expectedIDs);
    });

    it('should respect passed limit unless less than minimum', async () => {
      await addMixedTransactionsAndFillPool();
      const retVal = instance.getMergedTransactionList(30);
      expect(retVal.length).to.be.equal(30);
      const retVal2 = instance.getMergedTransactionList(10);
      expect(retVal2.length).to.be.equal(27);
    });
  });

  describe('expireTransactions', () => {
    const oldDateNow = Date.now;
    beforeEach(() => {
      const timeInFuture = Date.now() + (24 * 60 * 60 * 1000);
      Date.now = () => timeInFuture;
    });
    afterEach(() => {
      Date.now = oldDateNow;
    });

    it('should call listWithPayload (reversed) on the 3 queues', async () => {
      await addMixedTransactionsAndFillPool();
      instance.expireTransactions();
      expect(spiedQueues.unconfirmed.list.calledOnce).to.be.true;
      expect(spiedQueues.unconfirmed.list.firstCall.args[0]).to.be.true;
      expect(spiedQueues.queued.list.calledOnce).to.be.true;
      expect(spiedQueues.queued.list.firstCall.args[0]).to.be.true;
      expect(spiedQueues.multisignature.list.calledOnce).to.be.true;
      expect(spiedQueues.multisignature.list.firstCall.args[0]).to.be.true;
    });

    it('should call txTimeout() for each transaction', async () => {
      await addMixedTransactionsAndFillPool();
      const txTimeoutSpy = sandbox.spy(instance as any, 'txTimeout');
      instance.expireTransactions();
      expect(txTimeoutSpy.called).to.be.true;
      expect(txTimeoutSpy.callCount).to.be.equal(37);
    });

    it('should not call to txTimeout() if tx is empty', async () => {
      await addMixedTransactionsAndFillPool();
      const txTimeoutSpy = sandbox.spy(instance as any, 'txTimeout');
      instance['unconfirmed'].listWithPayload.restore();
      instance['queued'].listWithPayload.restore();
      instance['multisignature'].listWithPayload.restore();
      sandbox.stub(instance['unconfirmed'], 'listWithPayload').returns([{payload: {foo: 'bar1'}}]);
      sandbox.stub(instance['queued'], 'listWithPayload').returns([{payload: {foo: 'bar2'}}]);
      sandbox.stub(instance['multisignature'], 'listWithPayload').returns([{payload: {foo: 'bar3'}}]);
      instance.expireTransactions();
      expect(txTimeoutSpy.called).to.be.false;
    });

    it('should call removeUnconfirmedTransaction when a tx is expired', async () => {
      await addMixedTransactionsAndFillPool();
      const removeUnconfirmedTransactionSpy = sandbox.spy(instance as any, 'removeUnconfirmedTransaction');
      instance.expireTransactions();
      expect(removeUnconfirmedTransactionSpy.called).to.be.true;
      expect(removeUnconfirmedTransactionSpy.callCount).to.be.equal(25);
    });

    it('should call removeUnconfirmedTransaction when a tx is expired and has not signatures', async () => {
      await addMixedTransactionsAndFillPool(true);
      const removeUnconfirmedTransactionSpy = sandbox.spy(instance as any, 'removeUnconfirmedTransaction');
      instance.expireTransactions();
      expect(removeUnconfirmedTransactionSpy.called).to.be.true;
      expect(removeUnconfirmedTransactionSpy.callCount).to.be.equal(13);
    });

    it('should call logger.info when an expired tx is removed', async () => {
      await addMixedTransactionsAndFillPool();
      instance.expireTransactions();
      expect(loggerStub.stubs.info.called).to.be.true;
      expect(loggerStub.stubs.info.callCount).to.be.equal(25);
    });

    it('should return an array of IDs', async () => {
      await addMixedTransactionsAndFillPool();
      const retVal = instance.expireTransactions();
      expect(Array.isArray(retVal)).to.be.true;
      expect(retVal).to.be.equalTo(['tx_49', 'tx_48', 'tx_47', 'tx_46', 'tx_45', 'tx_44', 'tx_43', 'tx_42', 'tx_41',
        'tx_40', 'tx_39', 'tx_38', 'tx_37', 'tx_36', 'tx_35', 'tx_34',  'tx_33', 'tx_32', 'tx_31', 'tx_30', 'tx_29',
        'tx_28', 'tx_27', 'tx_26', 'tx_25' ]);
    });
  });

  describe('processBundled #1', () => {
    beforeEach(async () => {
      await addMixedTransactionsAndFillPool();
    });
    it('should call balancesSequence', async () => {
      await instance.processBundled();
      expect(balanceSequenceStub.spies.addAndPromise.calledOnce).is.true;
    });
    it('should call list with reverse and limit on bundled queue', async () => {
      await instance.processBundled();
      expect(spiedQueues.bundled.list.calledOnce).to.be.true;
      expect(spiedQueues.bundled.list.firstCall.args[0]).to.be.true;
      expect(spiedQueues.bundled.list.firstCall.args[1]).to.be.equal((instance as any).config.broadcasts.releaseLimit);
    });

    it('should call remove on bundled for each tx', async () => {
      const bundledCount = instance.bundled.count;
      sandbox.stub(instance as any, 'processVerifyTransaction').resolves(true);
      await instance.processBundled();
      expect(spiedQueues.bundled.remove.called).to.be.true;
      expect(spiedQueues.bundled.remove.callCount).to.be.equal(bundledCount);
    });

    it('should call processVerifyTransaction for each valid tx', async () => {
      const bundledCount = instance.bundled.count;

      const processVerifyTransactionStub = sandbox
        .stub(instance as any, 'processVerifyTransaction').resolves(true);
      await instance.processBundled();
      expect(processVerifyTransactionStub.called).to.be.true;
      expect(processVerifyTransactionStub.callCount).to.be.equal(bundledCount);
    });

    it('should call queueTransaction for each valid tx if processVerifyTransaction does not throw', async () => {
      const bundledCount = instance.bundled.count;
      const queueTransactionSpy = sandbox.spy(instance as any, 'queueTransaction');
      sandbox.stub(instance as any, 'processVerifyTransaction').resolves(true);
      await instance.processBundled();
      expect(queueTransactionSpy.called).to.be.true;
      expect(queueTransactionSpy.callCount).to.be.equal(bundledCount);
    });

    it('should not call queueTransaction for each valid tx if processVerifyTransaction throws', async () => {
      const queueTransactionSpy = sandbox.spy(instance as any, 'queueTransaction');
      sandbox.stub(instance as any, 'processVerifyTransaction').rejects('err');
      await instance.processBundled();
      expect(queueTransactionSpy.called).to.be.false;
    });

    it('should call logger.warn if queueTransaction fails', async () => {
      const queueTransactionStub = sandbox.stub(instance as any, 'queueTransaction').throws('err');
      sandbox.stub(instance as any, 'processVerifyTransaction').resolves(true);
      await instance.processBundled();
      expect(queueTransactionStub.called).to.be.true;
      expect(loggerStub.stubs.warn.called).to.be.true;
      expect(loggerStub.stubs.warn.firstCall.args[0]).to.match(/Failed to queue/);
    });

    it('should call logger.warn if processVerifyTransaction throws', async () => {
      sandbox.stub(instance as any, 'processVerifyTransaction').throws('err');
      await instance.processBundled();
      expect(loggerStub.stubs.warn.called).to.be.true;
      expect(loggerStub.stubs.warn.firstCall.args[0]).to.match(/Failed to process/);
    });

    it('should call bundled.remove if processVerifyTransaction fails', async () => {
      sandbox.stub(instance as any, 'processVerifyTransaction').throws('err');
      await instance.processBundled();
      expect(spiedQueues.bundled.remove.called).to.be.true;
      expect(spiedQueues.bundled.remove.firstCall.args[0]).to.match(/^tx_/);
    });
  });

  describe('processBundled #2', () => {
    it('should not call processVerifyTransaction if tx is empty', async () => {
      instance['bundled'].list.restore();
      sandbox.stub(instance['bundled'], 'list').returns([undefined, undefined]);
      const processVerifyTransactionSpy = sandbox
        .spy(instance as any, 'processVerifyTransaction');
      await instance.processBundled();
      expect(processVerifyTransactionSpy.called).to.be.false;
    });
  });

  describe('receiveTransactions', () => {
    let processNewTransactionStub: SinonStub;

    beforeEach(() => {
      processNewTransactionStub = sandbox.stub(instance, 'processNewTransaction').resolves();
    });

    afterEach(() => {
      processNewTransactionStub.restore();
    });

    it('should return a promise', () => {
      const retVal = instance.receiveTransactions([tx, tx2, tx3], false, false);
      expect(retVal).to.be.instanceof(Promise);
    });

    it('should call processNewTransaction for each of the passed txs', async () => {
      await instance.receiveTransactions([tx, tx2], false, false);
      expect(processNewTransactionStub.callCount).to.be.equal(2);
      expect(processNewTransactionStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(processNewTransactionStub.firstCall.args[1]).to.be.false;
      expect(processNewTransactionStub.firstCall.args[2]).to.be.false;
      expect(processNewTransactionStub.secondCall.args[0]).to.be.deep.equal(tx2);
      expect(processNewTransactionStub.secondCall.args[1]).to.be.false;
      expect(processNewTransactionStub.secondCall.args[2]).to.be.false;
    });
  });

  describe('processNewTransaction', () => {
    let processVerifyTransactionStub: SinonStub;

    beforeEach(() => {
      processVerifyTransactionStub = sandbox.stub(instance as any, 'processVerifyTransaction').resolves();
    });

    afterEach(() => {
      processVerifyTransactionStub.restore();
    });

    it('should return a promise', () => {
      const retVal = instance.processNewTransaction(tx, false, false);
      expect(retVal).to.be.instanceof(Promise);
    });

    it('should call transactionInPool', async () => {
      const transactionInPoolSpy = sandbox.spy(instance, 'transactionInPool');
      await instance.processNewTransaction(tx, false, false);
      expect(transactionInPoolSpy.calledOnce).to.be.true;
      expect(transactionInPoolSpy.firstCall.args[0]).to.be.equal(tx.id);
    });

    it('should reject if transaction is in pool', async () => {
      const allTxs = await addMixedTransactionsAndFillPool();
      await expect(instance.processNewTransaction(allTxs[0], false, false)).to.be.
      rejectedWith(/Transaction is already processed/);
    });

    it('should call reindexAllQueues if more than 1000 txs were processed', async () => {
      const reindexallQueuesSpy = sandbox.spy(instance as any, 'reindexAllQueues');
      (instance as any).processed = 1000;
      await instance.processNewTransaction(tx, false, false);
      expect(reindexallQueuesSpy.calledOnce).to.be.true;
      expect((instance as any).processed).to.be.equal(1);
    });

    it('should call queueTransaction if bundled is true', async () => {
      // we make processVerifyTransaction reject in order to stop execution before next call of queueTransaction
      processVerifyTransactionStub.rejects();
      const queueTransactionSpy = sandbox.spy(instance, 'queueTransaction');
      try {
        await instance.processNewTransaction(tx, false, true);
      } catch (e) {
        void(0);
      }
      expect(queueTransactionSpy.calledOnce).to.be.true;
      expect(queueTransactionSpy.firstCall.args[0]).to.be.deep.equal(tx);
      expect(queueTransactionSpy.firstCall.args[1]).to.be.true;
    });

    it('should not call queueTransaction if bundled is false', async () => {
      // we make processVerifyTransaction reject in order to stop execution before next call of queueTransaction
      processVerifyTransactionStub.rejects();
      const queueTransactionSpy = sandbox.spy(instance, 'queueTransaction');
      try {
        await instance.processNewTransaction(tx, false, false);
      } catch (e) {
        void(0);
      }
      expect(queueTransactionSpy.notCalled).to.be.true;
    });

    it('should call processVerifyTransaction', async () => {
      await instance.processNewTransaction(tx, false, false);
      expect(processVerifyTransactionStub.calledOnce).to.be.true;
      expect(processVerifyTransactionStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(processVerifyTransactionStub.firstCall.args[1]).to.be.false;
    });

    it('should call queueTransaction', async () => {
      const queueTransactionSpy = sandbox.spy(instance, 'queueTransaction');
      await instance.processNewTransaction(tx, false, false);
      expect(queueTransactionSpy.calledOnce).to.be.true;
      expect(queueTransactionSpy.firstCall.args[0]).to.be.deep.equal(tx);
      expect(queueTransactionSpy.firstCall.args[1]).to.be.false;
    });

    it('should not call queueTransaction if processVerifyTransaction rejected', async () => {
      processVerifyTransactionStub.rejects();
      const queueTransactionSpy = sandbox.spy(instance, 'queueTransaction');
      try {
        await instance.processNewTransaction(tx, false, false);
      } catch (e) {
        void(0);
      }
      expect(queueTransactionSpy.notCalled).to.be.true;
    });
  });

  describe('applyUnconfirmedList', () => {
    let txModuleStub: TransactionsModuleStub;
    const unconfirmedIds = [ 'tx_10', 'tx_8', 'tx_6', 'tx_4', 'tx_2' ];

    beforeEach(async () => {
      await addMixedTransactionsAndFillPool();
      txModuleStub = new TransactionsModuleStub();
    });

    it('should call get on unconfirmed queue if string ids are passed', async () => {
      await instance.applyUnconfirmedList(unconfirmedIds, txModuleStub);
      expect(spiedQueues.unconfirmed.get.called).to.be.true;
      expect(spiedQueues.unconfirmed.get.callCount).to.be.equal(unconfirmedIds.length);
      expect(spiedQueues.unconfirmed.get.firstCall.args[0]).to.be.equal(unconfirmedIds[0]);
      expect(spiedQueues.unconfirmed.get.secondCall.args[0]).to.be.equal(unconfirmedIds[1]);
    });

    it('should call processVerifyTransaction for each valid tx', async () => {
      const processVerifyTransactionSpy = sandbox.spy(instance as any, 'processVerifyTransaction');
      await instance.applyUnconfirmedList(unconfirmedIds, txModuleStub);
      expect(processVerifyTransactionSpy.called).to.be.true;
      expect(processVerifyTransactionSpy.callCount).to.be.equal(unconfirmedIds.length);
      expect(processVerifyTransactionSpy.firstCall.args[0].id).to.be.equal(unconfirmedIds[0]);
      expect(processVerifyTransactionSpy.firstCall.args[1]).to.be.false;
      expect(processVerifyTransactionSpy.secondCall.args[0].id).to.be.equal(unconfirmedIds[1]);
      expect(processVerifyTransactionSpy.secondCall.args[1]).to.be.false;
    });

    it('should not call processVerifyTransaction for empty tx', async () => {
      const processVerifyTransactionSpy = sandbox.spy(instance as any, 'processVerifyTransaction');
      await instance.applyUnconfirmedList([undefined, undefined], txModuleStub);
      expect(processVerifyTransactionSpy.called).to.be.false;
    });

    it('should call applyUnconfirmed on txModule for each tx if processVerifyTransaction did not throw', async () => {
      txModuleStub.stubs.applyUnconfirmed.resolves();
      sandbox.stub(instance as any, 'processVerifyTransaction').resolves('theSender');
      await instance.applyUnconfirmedList(unconfirmedIds, txModuleStub);
      expect(txModuleStub.stubs.applyUnconfirmed.called).to.be.true;
      expect(txModuleStub.stubs.applyUnconfirmed.callCount).to.be.equal(unconfirmedIds.length);
      expect(txModuleStub.stubs.applyUnconfirmed.firstCall.args[0].id).to.be.equal(unconfirmedIds[0]);
      expect(txModuleStub.stubs.applyUnconfirmed.firstCall.args[1]).to.be.equal('theSender');
      expect(txModuleStub.stubs.applyUnconfirmed.secondCall.args[0].id).to.be.equal(unconfirmedIds[1]);
      expect(txModuleStub.stubs.applyUnconfirmed.secondCall.args[1]).to.be.equal('theSender');
    });

    it('should not call applyUnconfirmed on txModule for each tx if processVerifyTransaction rejects', async () => {
      txModuleStub.stubs.applyUnconfirmed.resolves();
      sandbox.stub(instance as any, 'processVerifyTransaction').rejects('err');
      await instance.applyUnconfirmedList(unconfirmedIds, txModuleStub);
      expect(txModuleStub.stubs.applyUnconfirmed.notCalled).to.be.true;
    });

    it('should call logger.error if applyUnconfirmed rejects', async () => {
      sandbox.stub(instance as any, 'processVerifyTransaction').resolves();
      txModuleStub.stubs.applyUnconfirmed.rejects('err');
      await instance.applyUnconfirmedList(unconfirmedIds, txModuleStub);
      expect(loggerStub.stubs.error.callCount).to.be.equal(unconfirmedIds.length);
      expect(loggerStub.stubs.error.firstCall.args[0]).to.match(/Failed to apply unconfirmed transaction/);
    });

    it('should call logger.error if processVerifyTransaction rejects', async () => {
      sandbox.stub(instance as any, 'processVerifyTransaction').rejects();
      txModuleStub.stubs.applyUnconfirmed.resolves('');
      await instance.applyUnconfirmedList(unconfirmedIds, txModuleStub);
      expect(loggerStub.stubs.error.callCount).to.be.equal(unconfirmedIds.length);
      expect(loggerStub.stubs.error.firstCall.args[0]).to.match(/Failed to process \/ verify unconfirmed transaction/);
    });

    it('should call removeUnconfirmedTransaction if processVerifyTransaction rejects', async () => {
      const removeUnconfirmedTransactionSpy = sandbox.spy(instance as any, 'removeUnconfirmedTransaction');
      sandbox.stub(instance as any, 'processVerifyTransaction').rejects();
      txModuleStub.stubs.applyUnconfirmed.resolves('');
      await instance.applyUnconfirmedList(unconfirmedIds, txModuleStub);
      expect(removeUnconfirmedTransactionSpy.callCount).to.be.equal(unconfirmedIds.length);
      expect(removeUnconfirmedTransactionSpy.firstCall.args[0]).to.be.equal(unconfirmedIds[0]);
    });

    it('should call removeUnconfirmedTransaction if applyUnconfirmed rejects', async () => {
      const removeUnconfirmedTransactionSpy = sandbox.spy(instance as any, 'removeUnconfirmedTransaction');
      sandbox.stub(instance as any, 'processVerifyTransaction').resolves();
      txModuleStub.stubs.applyUnconfirmed.rejects('err');
      await instance.applyUnconfirmedList(unconfirmedIds, txModuleStub);
      expect(removeUnconfirmedTransactionSpy.callCount).to.be.equal(unconfirmedIds.length);
      expect(removeUnconfirmedTransactionSpy.firstCall.args[0]).to.be.equal(unconfirmedIds[0]);
    });

  });

  describe('undoUnconfirmedList', () => {
    let txModuleStub: TransactionsModuleStub;
    const unconfirmedIds = [ 'tx_10', 'tx_8', 'tx_6', 'tx_4', 'tx_2' ];

    beforeEach(async () => {
      await addMixedTransactionsAndFillPool();
      txModuleStub = new TransactionsModuleStub();
    });

    it('should return an array of ids', async () => {
      txModuleStub.stubs.undoUnconfirmed.resolves(true);
      const retVal = await instance.undoUnconfirmedList(txModuleStub);
      expect(retVal).to.be.equalTo(unconfirmedIds);
    });

    it('should call list on unconfirmed queue', async () => {
      txModuleStub.stubs.undoUnconfirmed.resolves(true);
      await instance.undoUnconfirmedList(txModuleStub);
      expect(spiedQueues.unconfirmed.list.calledOnce).to.be.true;
      expect(spiedQueues.unconfirmed.list.firstCall.args[0]).to.be.false;
    });

    it('should call undoUnconfirmed on txModule for each tx', async () => {
      txModuleStub.stubs.undoUnconfirmed.resolves(true);
      await instance.undoUnconfirmedList(txModuleStub);
      expect(txModuleStub.stubs.undoUnconfirmed.callCount).to.be.equal(unconfirmedIds.length);
      expect(txModuleStub.stubs.undoUnconfirmed.firstCall.args[0]).to.be.
      deep.equal(instance.unconfirmed.get(unconfirmedIds[0]));
    });

    it('should call logger.error if undoUnconfirmed rejects', async () => {
      txModuleStub.stubs.undoUnconfirmed.rejects('err');
      await instance.undoUnconfirmedList(txModuleStub);
      expect(loggerStub.stubs.error.callCount).to.be.equal(unconfirmedIds.length);
      expect(loggerStub.stubs.error.firstCall.args[0]).to.match(/Failed to undo unconfirmed transaction/);
    });

    it('should call removeUnconfirmedTransaction if undoUnconfirmed throws',  async () => {
      const removeUnconfirmedTransactionSpy = sandbox.spy(instance as any, 'removeUnconfirmedTransaction');
      txModuleStub.stubs.undoUnconfirmed.rejects('err');
      await instance.undoUnconfirmedList(txModuleStub);
      expect(removeUnconfirmedTransactionSpy.callCount).to.be.equal(unconfirmedIds.length);
      expect(removeUnconfirmedTransactionSpy.firstCall.args[0]).to.be.equal(unconfirmedIds[0]);
    });
  });

  describe('reindexAllQueues', () => {
    it('should call reindex on all queues', () => {
      (instance as any).reindexAllQueues();
      expect(spiedQueues.unconfirmed.reindex.calledOnce).to.be.true;
      expect(spiedQueues.bundled.reindex.calledOnce).to.be.true;
      expect(spiedQueues.queued.reindex.calledOnce).to.be.true;
      expect(spiedQueues.multisignature.reindex.calledOnce).to.be.true;
    });
  });

  describe('removeUnconfirmedTransaction', () => {
    it('should call remove on unconfirmed, queued and multisignature', async () => {
      await addMixedTransactionsAndFillPool();
      (instance as any).removeUnconfirmedTransaction('tx_10');
      expect(spiedQueues.unconfirmed.remove.calledOnce).to.be.true;
      expect(spiedQueues.queued.remove.calledOnce).to.be.true;
      expect(spiedQueues.multisignature.remove.calledOnce).to.be.true;
      expect(spiedQueues.unconfirmed.remove.firstCall.args[0]).to.be.equal('tx_10');
      expect(spiedQueues.queued.remove.firstCall.args[0]).to.be.equal('tx_10');
      expect(spiedQueues.multisignature.remove.firstCall.args[0]).to.be.equal('tx_10');
    });
  });

  describe('processVerifyTransaction', () => {
    const sender = {
      publicKey: 'senderPublicKey',
      multisignatures: [],
    };

    const requester = {
      publicKey: 'requesterPublicKey',
      multisignatures: [],
    };

    beforeEach(() => {
      sender.multisignatures = [];
      transactionLogicStub.enqueueResponse('process', Promise.resolve());
      transactionLogicStub.enqueueResponse('objectNormalize', null);
      transactionLogicStub.enqueueResponse('verify', null);
    });

    it('should reject if !transaction', async () => {
      await expect((instance as any).processVerifyTransaction(false, false)).to.be.
        rejectedWith('Missing transaction');
    });

    it('should call accountsModule.setAccountAndGet', async () => {
      accountsModuleStub.stubs.setAccountAndGet.resolves(sender);

      await (instance as any).processVerifyTransaction(tx, false);
      expect(accountsModuleStub.stubs.setAccountAndGet.calledOnce).to.be.true;
      const expectedParam = {publicKey: tx.senderPublicKey};
      expect(accountsModuleStub.stubs.setAccountAndGet.firstCall.args[0]).to.be.deep.equal(expectedParam);
    });

    it('should call accountsModule.getAccount if sender && requesterPublicKey && sender.multisignatures', async () => {
      accountsModuleStub.stubs.setAccountAndGet.resolves(sender);
      accountsModuleStub.stubs.getAccount.resolves(requester);
      sender.multisignatures = ['a', 'b'];
      tx.requesterPublicKey = 'requesterPublicKey';
      await (instance as any).processVerifyTransaction(tx, false);
      expect(accountsModuleStub.stubs.getAccount.calledOnce).to.be.true;
      const expectedParam = {publicKey: tx.requesterPublicKey};
      expect(accountsModuleStub.stubs.getAccount.firstCall.args[0]).to.be.deep.equal(expectedParam);
    });

    it('should NOT call accountsModule.getAccount if !sender', async () => {
      // sender = false;
      accountsModuleStub.stubs.setAccountAndGet.resolves(false);
      accountsModuleStub.stubs.getAccount.resolves(requester);
      sender.multisignatures = ['a', 'b'];
      tx.requesterPublicKey = 'requesterPublicKey';
      await (instance as any).processVerifyTransaction(tx, false);
      expect(accountsModuleStub.stubs.getAccount.notCalled).to.be.true;
    });

    it('should NOT call accountsModule.getAccount if !requesterPublicKey', async () => {
      tx.requesterPublicKey = undefined;
      accountsModuleStub.stubs.setAccountAndGet.resolves(sender);
      accountsModuleStub.stubs.getAccount.resolves(requester);
      sender.multisignatures = ['a', 'b'];
      await (instance as any).processVerifyTransaction(tx, false);
      expect(accountsModuleStub.stubs.getAccount.notCalled).to.be.true;
    });

    it('should NOT call accountsModule.getAccount if !sender.multisignatures', async () => {
      delete sender.multisignatures;
      accountsModuleStub.stubs.setAccountAndGet.resolves(sender);
      accountsModuleStub.stubs.getAccount.resolves(requester);
      tx.requesterPublicKey = 'requesterPublicKey';
      await (instance as any).processVerifyTransaction(tx, false);
      expect(accountsModuleStub.stubs.getAccount.notCalled).to.be.true;
    });

    it('should call transactionLogic.process', async () => {
      accountsModuleStub.stubs.setAccountAndGet.resolves(sender);
      accountsModuleStub.stubs.getAccount.resolves(requester);
      sender.multisignatures = ['a', 'b'];
      tx.requesterPublicKey = 'requesterPublicKey';
      // Will have a valid requester
      await (instance as any).processVerifyTransaction(tx, false);
      expect(transactionLogicStub.stubs.process.calledOnce).to.be.true;
      expect(transactionLogicStub.stubs.process.firstCall.args[0]).to.be.deep.equal(tx);
      expect(transactionLogicStub.stubs.process.firstCall.args[1]).to.be.deep.equal(sender);
      expect(transactionLogicStub.stubs.process.firstCall.args[2]).to.be.deep.equal(requester);
    });

    it('should call transactionLogic.objectNormalize', async () => {
      accountsModuleStub.stubs.setAccountAndGet.resolves(sender);
      await (instance as any).processVerifyTransaction(tx, false);
      expect(transactionLogicStub.stubs.objectNormalize.calledOnce).to.be.true;
      expect(transactionLogicStub.stubs.objectNormalize.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should call transactionLogic.verify', async () => {
      const normalizedTx = Object.assign({}, tx as any);
      normalizedTx.normalized = true;
      transactionLogicStub.stubs.objectNormalize.returns(normalizedTx);
      accountsModuleStub.stubs.setAccountAndGet.resolves(sender);
      await (instance as any).processVerifyTransaction(tx, false);
      expect(transactionLogicStub.stubs.verify.calledOnce).to.be.true;
      expect(transactionLogicStub.stubs.verify.firstCall.args[0]).to.be.deep.equal(normalizedTx);
      expect(transactionLogicStub.stubs.verify.firstCall.args[1]).to.be.deep.equal(sender);
      expect(transactionLogicStub.stubs.verify.firstCall.args[2]).to.be.null;
      expect(transactionLogicStub.stubs.verify.firstCall.args[3]).to.be.null;
    });

    it('should call bus.message', async () => {
      const normalizedTx = Object.assign({}, tx as any);
      normalizedTx.normalized = true;
      transactionLogicStub.stubs.objectNormalize.returns(normalizedTx);
      accountsModuleStub.stubs.setAccountAndGet.resolves(sender);
      await (instance as any).processVerifyTransaction(tx, false);
      expect(fakeBus.message.calledOnce).to.be.true;
      expect(fakeBus.message.firstCall.args[0]).to.be.deep.equal('unconfirmedTransaction');
      expect(fakeBus.message.firstCall.args[1]).to.be.deep.equal(normalizedTx);
      expect(fakeBus.message.firstCall.args[2]).to.be.false;
    });

    it('should return the sender', async () => {
      accountsModuleStub.stubs.setAccountAndGet.resolves(sender);
      const retVal = await (instance as any).processVerifyTransaction(tx, false);
      expect(retVal).to.be.deep.equal(sender);
    });
  });
});

describe('logic/transactionPool - afterConstruction', () => {
  let sandbox: SinonSandbox;
  let instance: TransactionPool;
  let jqStub: JobsQueueStub;
  let processBundledStub;
  let expireTransactionsStub;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    instance = new TransactionPool();
    jqStub = new JobsQueueStub();
    jqStub.stubs.register.callsFake((name: string, job: () => Promise<any>, time: number) => {
      job();
    });
    (instance as any).jobsQueue = jqStub;
    (instance as any).config = {
      broadcasts: {
        broadcastInterval: 1500,
        releaseLimit: 100,
      },
      transactions: {
        maxTxsPerQueue: 50,
      },
    };
    processBundledStub = sandbox.stub(instance, 'processBundled').returns(true);
    expireTransactionsStub = sandbox.stub(instance, 'expireTransactions').returns(true);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('afterConstruction', () => {
    it('should call to processBundled() and expireTransactions()', () => {
      instance.afterConstruction();
      expect(jqStub.stubs.register.called).to.be.true;
      expect(jqStub.stubs.register.callCount).to.be.equal(2);
      expect(jqStub.stubs.register.firstCall.args[0]).to.be.equal('transactionPoolNextBundle');
      expect(jqStub.stubs.register.firstCall.args[1]).to.be.a('function');
      expect(jqStub.stubs.register.secondCall.args[0]).to.be.equal('transactionPoolNextExpiry');
      expect(jqStub.stubs.register.secondCall.args[1]).to.be.a('function');
      expect(processBundledStub.calledOnce).to.be.true;
      expect(expireTransactionsStub.calledOnce).to.be.true;
    });
  });
});
