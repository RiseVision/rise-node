var chai             = require('chai');
var expect           = chai.expect;
var sinon            = require('sinon');
var rewire           = require('rewire');
var TransactionPool  = rewire('../../../logic/transactionPool.ts');
var transactionTypes = require('../../../helpers/transactionTypes').TransactionType;
var jobsQueue        = require('../../../helpers/jobsQueue').default;
var constants        = require('../../../helpers/constants').default;
const chaiAsPromised = require('chai-as-promised');

describe('logic/transactionPool', function () {
	var jobsQueueStub, logger;

	beforeEach(function () {
		jobsQueueStub = sinon.stub(jobsQueue, 'register').returns(true);
		TransactionPool.__set__('jobsQueue_1', { default: jobsQueue });
		logger = {
			error: function (error) {
			},
			info : function (error) {
			},
			log  : function (error) {
			},
			debug: sinon.stub()
		};
	});

	afterEach(function () {
		jobsQueueStub.restore();
	});

	describe('when is imported', function () {
		it('should be a function', function () {
			expect(TransactionPool.TransactionPool).to.be.a('function');
		});
	});

	describe('when is instantiated', function () {
		var instance, broadcastInterval, releaseLimit, transaction, bus, logger;

		beforeEach(function () {
			broadcastInterval = 1;
			releaseLimit      = 2;
			transaction       = 3;
			bus               = 4;
			logger            = 5;
			instance          = new TransactionPool.TransactionPool(
				broadcastInterval,
				releaseLimit,
				transaction,
				bus,
				logger
			);
		});

		it('should be an instance of TransactionPool', function () {
			expect(instance).to.be.an.instanceof(TransactionPool.TransactionPool);
			expect(jobsQueueStub.calledTwice).to.be.true;
		});

		it('should initialize library properly', function () {
			expect(instance.library.logger).to.equal(logger);
			expect(instance.library.bus).to.equal(bus);
			expect(instance.library.logic.transaction).to.equal(
				transaction
			);
			expect(
				instance.library.config.broadcasts.broadcastInterval
			).to.equal(broadcastInterval);
			expect(
				instance.library.config.broadcasts.releaseLimit
			).to.equal(releaseLimit);
		});

		it('should initialize some local properties', function () {
			expect(instance.unconfirmed).to.be.an.instanceOf(TransactionPool.InnerTXQueue);
			expect(instance.bundled).to.be.an.instanceOf(TransactionPool.InnerTXQueue);
			expect(instance.queued).to.be.an.instanceOf(TransactionPool.InnerTXQueue);
			expect(instance.multisignature).to.be.an.instanceOf(TransactionPool.InnerTXQueue);

			expect(instance.expiryInterval).to.equal(30000);
			expect(instance.bundledInterval).to.equal(broadcastInterval);
			expect(instance.bundleLimit).to.equal(releaseLimit);
			expect(instance.processed).to.equal(0);
		});
	});

	describe('bind()', function () {
		var instance, accounts, transactions, loader;

		beforeEach(function () {
			accounts     = 1;
			transactions = 2;
			loader       = 3;
			instance     = new TransactionPool.TransactionPool();
			instance.bind(accounts, transactions, loader);
		});

		it('should initialize modules properly', function () {
			expect(instance.modules.accounts).to.equal(accounts);
			expect(instance.modules.transactions).to.equal(
				transactions
			);
			expect(instance.modules.loader).to.equal(loader);
		});
	});

	describe('transactionInPool()', function () {
		var instance;

		beforeEach(() => {
			instance = new TransactionPool.TransactionPool();
		});

		it('should calll queue.has for the queues', () => {
			const stubs = instance.allQueues.map(queue => sinon.stub(queue, 'has').returns(false));
			instance.transactionInPool('1');
			expect(stubs.map(s => s.calledOnce)).to.be.deep.eq([true, true, true, true]);
			expect(stubs.map(s => s.firstCall.args[0])).to.be.deep.eq(['1', '1', '1', '1']);
		});

		it('should return true if one queue has it', () => {
			sinon.stub(instance.unconfirmed, 'has').returns(true);

			expect(instance.transactionInPool('1')).to.be.eq(true);
		});
		it('should return false if all does not have it', () => {
			expect(instance.transactionInPool('1')).to.be.eq(false);
		});
	});

	describe('getMergedTransactionList()', function () {
		var instance, transactions;

		beforeEach(function () {
			instance = new TransactionPool.TransactionPool();

			transactions = {
				getUnconfirmedTransactionList   : function () {
					return [1, 2];
				},
				getMultisignatureTransactionList: function () {
					return [3];
				},
				getQueuedTransactionList        : function () {
					return [4, 5, 6];
				}
			};

			sinon.spy(transactions, 'getUnconfirmedTransactionList');
			sinon.spy(transactions, 'getMultisignatureTransactionList');
			sinon.spy(transactions, 'getQueuedTransactionList');

			instance.bind(null, transactions, null);
		});

		it('should return a merged array from unconfirmed, multisignature and queued transactions', function () {
			var result = instance.getMergedTransactionList(true, 10);
			expect(result).to.have.lengthOf(6);
			expect(transactions.getUnconfirmedTransactionList.called).to.be.true;
			expect(transactions.getMultisignatureTransactionList.called).to.be.true;
			expect(transactions.getQueuedTransactionList.called).to.be.true;
		});
	});

	//
	describe('removeUnconfirmedTransaction()', function () {
		var instance;

		beforeEach(function () {
			instance = new TransactionPool.TransactionPool();
			sinon.spy(instance.unconfirmed, 'remove');
			sinon.spy(instance.queued, 'remove');
			sinon.spy(instance.multisignature, 'remove');
			sinon.spy(instance.bundled, 'remove');
		});

		it('should call queues ', function () {
			instance.removeUnconfirmedTransaction('123');
			expect(instance.bundled.remove.calledOnce).is.false;

			expect(instance.unconfirmed.remove.calledOnce).is.true;
			expect(instance.queued.remove.calledOnce).is.true;
			expect(instance.multisignature.remove.calledOnce).is.true;

			expect(instance.unconfirmed.remove.firstCall.args[0]).to.be.eq('123');
			expect(instance.queued.remove.firstCall.args[0]).to.be.eq('123');
			expect(instance.multisignature.remove.firstCall.args[0]).to.be.eq('123');

		});
	});

	//
	describe('receiveTransactions()', function () {
		var instance, callback;

		beforeEach(function () {
			callback = sinon.spy();
			instance = new TransactionPool.TransactionPool();

		});

		it('should return a promise', () => {
			sinon.stub(instance, 'processNewTransaction').resolves();
			expect(instance.receiveTransactions([null, null], false, true)).to.be.instanceOf(Promise);
		});

		it('should throw if processNewTransaction throws', () => {
			sinon.stub(instance, 'processNewTransaction').returns(Promise.reject(new Error('hey')));
			return instance.receiveTransactions([null], false, true)
				.then(() => {
					throw new Error('should have failed');
				})
				.catch((err) => expect(err.message).to.be.eq('hey'));
		});

		it('should call processNewTransaction as many times as the txs and propagate variables.', () => {
			const stub = sinon.stub(instance, 'processNewTransaction').resolves();
			return instance.receiveTransactions([null, null], false, true)
				.then(() => {
					expect(stub.callCount).to.be.eq(2);
					expect(stub.firstCall.args[1]).to.be.false;
					expect(stub.firstCall.args[2]).to.be.true;
				});
		});


	});
	//
	describe('reindexQueues()', function () {
		it('should call reindex on all queues', () => {
			const instance = new TransactionPool.TransactionPool();
			const spies    = instance.allQueues.map((queue) => sinon.spy(queue, 'reindex'));
			instance.reindexAllQueues();
			expect(spies.map((s) => s.calledOnce)).is.deep.eq(spies.map(() => true));
		});

	});
	//
	describe('processBundled()', function () {
		let instance;
		beforeEach(() => {
			instance = new TransactionPool.TransactionPool(null, null, null, null, logger);
		});
		it('should return promise', () => {
			expect(instance.processBundled()).to.be.an.instanceOf(Promise);
		});
		it('should call bundled.list', () => {
			const spy = sinon.spy(instance.bundled, 'list');
			return instance.processBundled()
				.then(() => {
					expect(spy.calledOnce).is.true;
				});
		});
		it('should call 2 times (filter one) processVerifyTransaction and QueueTransaction if all good', () => {
			const verStub   = sinon.stub(instance, 'processVerifyTransaction').resolves();
			const queueStub = sinon.stub(instance, 'queueTransaction');
			sinon.stub(instance.bundled, 'list').returns(['a', null, 'b']);
			return instance.processBundled()
				.then(() => {
					expect(verStub.callCount).to.be.eq(2);
					expect(queueStub.callCount).to.be.eq(2);
				})
		});
		it('should not call queue if verify Fails and swallow the error', () => {
			const verStub   = sinon.stub(instance, 'processVerifyTransaction').rejects('ouch');
			const queueStub = sinon.stub(instance, 'queueTransaction');
			sinon.stub(instance.bundled, 'list').returns(['a']);
			return instance.processBundled()
				.then(() => {
					expect(verStub.callCount).to.be.eq(1);
					expect(queueStub.callCount).to.be.eq(0);
					expect(logger.debug.calledOnce).is.true;
					expect(logger.debug.firstCall.args[0]).to.contain('Failed to process');
				})
		})

	});
	//
	describe('processNewTransaction()', function () {
		var instance, broadcast = true, bundled = true;

		beforeEach(function () {
			instance = new TransactionPool.TransactionPool();
		});
		describe('If transaction is already processed', function () {
			it('should call to callback() with message \'Transaction is already processed\'', function () {
				instance.queued.add({ id: 'already_processed' });
				return instance.processNewTransaction(
					{ id: 'already_processed' },
					true,
					false
				)
					.then(() => Promise.reject(new Error('fail')))
					.catch(err => expect(err).to.contain('Transaction is already processed'))
			});
		});

		describe('If transaction is unprocessed and self.processed is greater than 1000', function () {
			it('should call to self.reindexQueues() and self.processed should be equal to 1 ', function () {
				const stub = sinon.spy(instance, 'reindexAllQueues');
				instance.processed = 1000;
				return instance.processNewTransaction(
					{ id: 'unprocessed' },
					broadcast,
					bundled
				)
					.then(() => expect(stub.calledOnce).is.true)
					.then(() => expect(instance.processed).to.be.eq(1))

			});
		});

		describe('if bundled is true', function () {
			it('should call to self.queueTransaction() without verify', function () {
				const spy = sinon.spy(instance, 'queueTransaction');
				const verSpy = sinon.spy(instance, 'processVerifyTransaction');
				return instance.processNewTransaction(
					{ id: 'unprocessed' },
					broadcast,
					true
				)
					.then(() => expect(spy.calledOnce).is.true)
					.then(() => expect(verSpy.calledOnce).is.false);
			});
		});
		// TODO missing bundled false and error/noerror of verify

	});

	describe('queueTransaction()', function () {
		var instance,
			callback,
			transaction_true,
			transaction_multi,
			transaction_vote,
			transaction_false;

		beforeEach(function () {
			instance = new TransactionPool.TransactionPool();
			transaction_true = { bundled: true };
			transaction_multi = { bundled: false, type: transactionTypes.MULTI };
			transaction_vote = {
				bundled: false,
				type: transactionTypes.VOTE,
				signatures: []
			};
			transaction_false = { bundled: false };
		});

		it('Case 1: return error', function () {
			instance.bundled.index = new Array(1000).fill(0);
			expect(() => instance.queueTransaction(transaction_true, true)).to.throw('Transaction pool is full');

		});

		it('Case 2: call to bundled.add()', function () {
			instance.bundled.index = new Array(997).fill(0);
			const spy = sinon.spy(instance.bundled, 'add');
			instance.queueTransaction(transaction_true, true);
			expect(spy.calledOnce).is.true;
			expect(spy.firstCall.args[0]).to.be.deep.eq(transaction_true);
			expect(spy.firstCall.args[1].receivedAt).to.exist;
		});

		it('should enqueue into multisig without error');
		it('should enqueue into queued  if not bundled or multisig');
	});
	//
	describe('applyUnconfirmedList()', function () {

		it('should convert tx from string by calling unconfirmed.get');
		it('should skip empty tx');
		it('should call processVerifyTransaction and remove the tx if error is thrown');
		it('should call mod.tx.applyUnconfirmed with sender from processVerifyTx');
		it('should log error from applyUnconfirmed');
		it('should remove tx if error from applyUnconfirmed');
	});


	describe('undoUnconfirmedList()', function () {
		it('should call modules.tx.undoUnconfirmed for each tx');
		it('should skip empty txs');
		it('should call removeUnconfirmedTransaction if tx errored');
		it('should return processed ids');

	});

	describe('expireTransactions()', function () {
		it('should return empty array if no txs in queues');
		it('should call removeUnconfirmed for each tx that has expired');
		it('should log the expired tx');
		it('should return all the expired ids');
	});

	describe('fillPool()', function () {
		it('should call modules.loader.syncing and not process any further (logger)');
		it('should do nothing if pool is already filled (unconfirmedcount == maxTxsPerBlock');
		it('should fill with multisignature');
		it('should also fill using the `queued` queue with the right amount requested to `list`');
		it('should enqueue returned txs to `unconfirmed` queue');
		it('should call applyUncofirmedList with new enqueued txs');
	});

	describe('processVerifyTransaction()', () => {
		it('should throw if give tx is not defined');
		it('should call setAccountAndGet');
		it('should call getAccount if multisignature');
		it('should call transaction.process with correct data');
		it('should call objectNormalize on the transaction');
		it('should call transaction.verify with the correct data');
		it('should return sender');
	});

	describe('[private] txTimeout', () => {
		it('should use lifetime * 3600 if tx is multisignautre');
		it('should multiply constants.unconfirmedTransactionTimeout by 8 if it has signatures array');
		it('should return constants.unconfirmedTransactionTimeout if other txtypes');
	});

});
