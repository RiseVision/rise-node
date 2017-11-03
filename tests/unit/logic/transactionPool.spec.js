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
	// describe('applyUnconfirmedList()', function () {
	// 	var instance,
	// 		__private,
	// 		applyUnconfirmedListSpy,
	// 		callback,
	// 		getUnconfirmedTransactionListSpy;
	//
	// 	it('call to __private.applyUnconfirmedList() and getUnconfirmedTransactionList()', function () {
	// 		__private = TransactionPool.__get__('__private');
	// 		applyUnconfirmedListSpy = sinon.stub(__private, 'applyUnconfirmedList');
	// 		instance = new TransactionPool();
	// 		getUnconfirmedTransactionListSpy = sinon.spy(
	// 			instance,
	// 			'getUnconfirmedTransactionList'
	// 		);
	// 		instance.applyUnconfirmedList(callback);
	// 		expect(__private.applyUnconfirmedList.calledOnce).to.be.true;
	// 		expect(instance.getUnconfirmedTransactionList.calledOnce).to.be.true;
	// 		applyUnconfirmedListSpy.restore();
	// 		getUnconfirmedTransactionListSpy.reset();
	// 	});
	// });
	//
	// describe('applyUnconfirmedIds()', function () {
	// 	var instance, applyUnconfirmedListStub, callback, ids, __private;
	//
	// 	it('call to __private.applyUnconfirmedList()', function () {
	// 		__private = TransactionPool.__get__('__private');
	// 		applyUnconfirmedListStub = sinon.stub(__private, 'applyUnconfirmedList');
	// 		instance = new TransactionPool();
	// 		instance.applyUnconfirmedIds(ids, callback);
	// 		expect(__private.applyUnconfirmedList.calledOnce).to.be.true;
	// 		applyUnconfirmedListStub.restore();
	// 	});
	// });
	//
	// describe('undoUnconfirmedList()', function () {
	// 	var instance,
	// 		transactions,
	// 		transactionsSpy,
	// 		callback,
	// 		loggerSpy,
	// 		removeUnconfirmedTransactionStub,
	// 		removeUnconfirmedTransactionSpy,
	// 		clock;
	//
	// 	beforeEach(function () {
	// 		clock = sinon.useFakeTimers();
	// 		TransactionPool.__set__('setImmediate', setImmediate);
	//
	// 		transactions = {
	// 			undoUnconfirmed: function (transaction, cb) {
	// 				if (transaction.id === 2) {
	// 					setImmediate(cb, 'dummy_error');
	// 				} else {
	// 					setImmediate(cb);
	// 				}
	// 			}
	// 		};
	//
	// 		transactionsSpy = sinon.spy(transactions, 'undoUnconfirmed');
	//
	// 		loggerSpy = sinon.spy(logger, 'error');
	// 		callback = sinon.spy();
	// 		instance = new TransactionPool(
	// 			undefined,
	// 			undefined,
	// 			undefined,
	// 			undefined,
	// 			logger
	// 		);
	// 	});
	//
	// 	afterEach(function () {
	// 		clock.restore();
	// 		transactionsSpy.reset();
	// 		loggerSpy.reset();
	// 		callback.reset();
	// 	});
	//
	// 	it('if there are errors', function () {
	// 		removeUnconfirmedTransactionStub = sinon
	// 			.stub(instance, 'removeUnconfirmedTransaction')
	// 			.returns('foo');
	// 		instance.unconfirmed.transactions = [
	// 			{ id: 1, receivedAt: new Date() },
	// 			{ id: 2, receivedAt: new Date() }
	// 		];
	// 		instance.unconfirmed.index = { '1': 0, '2': 1 };
	// 		instance.bind(false, transactions, false);
	// 		instance.undoUnconfirmedList(callback);
	// 		clock.runAll();
	// 		expect(callback.called).to.be.true;
	// 		expect(callback.args[0][1]).to.have.lengthOf(2);
	// 		expect(instance.removeUnconfirmedTransaction.called).to.be.true;
	// 		expect(logger.error.calledOnce).to.be.true;
	// 		removeUnconfirmedTransactionStub.restore();
	// 	});
	//
	// 	it('success', function () {
	// 		removeUnconfirmedTransactionSpy = sinon.spy(
	// 			instance,
	// 			'removeUnconfirmedTransaction'
	// 		);
	// 		instance.unconfirmed.transactions = [
	// 			{ id: 1, receivedAt: new Date() },
	// 			{ id: 3, receivedAt: new Date() }
	// 		];
	// 		instance.unconfirmed.index = { '1': 0, '3': 1 };
	// 		instance.bind(false, transactions, false);
	// 		instance.undoUnconfirmedList(callback);
	// 		clock.runAll();
	// 		expect(callback.called).to.be.true;
	// 		expect(callback.args[0][1]).to.have.lengthOf(2);
	// 		expect(instance.removeUnconfirmedTransaction.called).to.be.false;
	// 		expect(logger.error.calledOnce).to.be.false;
	// 		removeUnconfirmedTransactionSpy.reset();
	// 	});
	// });
	//
	// describe('expireTransactions()', function () {
	// 	var instance,
	// 		__private,
	// 		callback,
	// 		expireTransactionsSpy,
	// 		clock,
	// 		getUnconfirmedTransactionListSpy,
	// 		getQueuedTransactionListSpy,
	// 		getMultisignatureTransactionListSpy;
	//
	// 	beforeEach(function () {
	// 		clock = sinon.useFakeTimers();
	// 		TransactionPool.__set__('setImmediate', setImmediate);
	// 		callback = sinon.spy();
	// 		__private = TransactionPool.__get__('__private');
	// 		expireTransactionsSpy = sinon.spy(__private, 'expireTransactions');
	// 		instance = new TransactionPool();
	// 		getUnconfirmedTransactionListSpy = sinon.spy(
	// 			instance,
	// 			'getUnconfirmedTransactionList'
	// 		);
	// 		getQueuedTransactionListSpy = sinon.spy(
	// 			instance,
	// 			'getQueuedTransactionList'
	// 		);
	// 		getMultisignatureTransactionListSpy = sinon.spy(
	// 			instance,
	// 			'getMultisignatureTransactionList'
	// 		);
	// 	});
	//
	// 	afterEach(function () {
	// 		clock.restore();
	// 		callback.reset();
	// 		expireTransactionsSpy.reset();
	// 		getUnconfirmedTransactionListSpy.reset();
	// 		getQueuedTransactionListSpy.reset();
	// 		getMultisignatureTransactionListSpy.reset();
	// 	});
	//
	// 	it('success', function () {
	// 		instance.expireTransactions(callback);
	// 		clock.runAll();
	// 		expect(callback.calledOnce).to.be.true;
	// 		expect(callback.args[0][0]).to.equal(null);
	// 		expect(__private.expireTransactions.calledThrice).to.be.true;
	// 		expect(getUnconfirmedTransactionListSpy.called).to.be.true;
	// 		expect(getQueuedTransactionListSpy.called).to.be.true;
	// 		expect(getMultisignatureTransactionListSpy.called).to.be.true;
	// 	});
	// });
	//
	// describe('fillPool()', function () {
	// 	var instance,
	// 		modules,
	// 		modulesStub,
	// 		callback,
	// 		clock,
	// 		countUnconfirmedStub,
	// 		applyUnconfirmedListStub;
	//
	// 	beforeEach(function () {
	// 		clock = sinon.useFakeTimers();
	// 		TransactionPool.__set__('setImmediate', setImmediate);
	// 		instance = new TransactionPool(
	// 			undefined,
	// 			undefined,
	// 			undefined,
	// 			undefined,
	// 			logger
	// 		);
	// 		instance.bind(
	// 			{},
	// 			{},
	// 			{
	// 				syncing: function () {}
	// 			}
	// 		);
	// 		modules = TransactionPool.__get__('modules');
	// 		callback = sinon.spy();
	// 	});
	//
	// 	afterEach(function () {
	// 		callback.reset();
	// 		clock.restore();
	// 	});
	//
	// 	it('modules.loader.syncing() returns true', function () {
	// 		modulesStub = sinon.stub(modules.loader, 'syncing').returns(true);
	// 		countUnconfirmedStub = sinon
	// 			.stub(instance, 'countUnconfirmed')
	// 			.returns(null);
	// 		instance.fillPool(callback);
	// 		clock.runAll();
	// 		expect(modules.loader.syncing.calledOnce).to.be.true;
	// 		expect(countUnconfirmedStub.calledOnce).to.be.false;
	// 		expect(callback.calledOnce).to.be.true;
	// 		modulesStub.restore();
	// 		countUnconfirmedStub.reset();
	// 	});
	//
	// 	it('unconfirmedCount is equal or greater than constants.maxTxsPerBlock', function () {
	// 		modulesStub = sinon.stub(modules.loader, 'syncing').returns(false);
	// 		countUnconfirmedStub = sinon
	// 			.stub(instance, 'countUnconfirmed')
	// 			.returns(25);
	// 		instance.fillPool(callback);
	// 		clock.runAll();
	// 		expect(modules.loader.syncing.calledOnce).to.be.true;
	// 		expect(countUnconfirmedStub.calledOnce).to.be.true;
	// 		expect(callback.calledOnce).to.be.true;
	// 		modulesStub.restore();
	// 		countUnconfirmedStub.reset();
	// 	});
	//
	// 	it('unconfirmedCount is less than constants.maxTxsPerBlock', function () {
	// 		modulesStub = sinon.stub(modules.loader, 'syncing').returns(false);
	// 		countUnconfirmedStub = sinon
	// 			.stub(instance, 'countUnconfirmed')
	// 			.returns(24);
	// 		applyUnconfirmedListStub = sinon
	// 			.stub(__private, 'applyUnconfirmedList')
	// 			.callsFake(function (transactions, cb) {
	// 				return setImmediate(cb);
	// 			});
	// 		instance.fillPool(callback);
	// 		clock.runAll();
	// 		expect(modules.loader.syncing.calledOnce).to.be.true;
	// 		expect(countUnconfirmedStub.calledOnce).to.be.true;
	// 		expect(callback.calledOnce).to.be.true;
	// 		expect(applyUnconfirmedListStub.calledOnce).to.be.true;
	// 		modulesStub.restore();
	// 		countUnconfirmedStub.reset();
	// 		applyUnconfirmedListStub.restore();
	// 	});
	// });
	//
	// describe('__private.getTransactionList()', function () {
	// 	var __private, transactions;
	//
	// 	beforeEach(function () {
	// 		transactions = [{ id: 101 }, { id: 102 }, { id: 103 }, false];
	// 		__private = TransactionPool.__get__('__private');
	// 	});
	//
	// 	it('test without reverse and limit', function () {
	// 		var result = __private.getTransactionList(transactions);
	// 		expect(result).to.have.lengthOf(3);
	// 		expect(result).to.deep.equal([{ id: 101 }, { id: 102 }, { id: 103 }]);
	// 	});
	//
	// 	it('test reverse', function () {
	// 		var result = __private.getTransactionList(transactions, true);
	// 		expect(result).to.have.lengthOf(3);
	// 		expect(result).to.deep.equal([{ id: 103 }, { id: 102 }, { id: 101 }]);
	// 	});
	//
	// 	it('test limit', function () {
	// 		var result = __private.getTransactionList(transactions, false, 2);
	// 		expect(result).to.have.lengthOf(2);
	// 		expect(result).to.deep.equal([{ id: 101 }, { id: 102 }]);
	// 	});
	//
	// 	it('test with reverse and limit', function () {
	// 		var result = __private.getTransactionList(transactions, true, 2);
	// 		expect(result).to.have.lengthOf(2);
	// 		expect(result).to.deep.equal([{ id: 103 }, { id: 102 }]);
	// 	});
	// });
	//
	// describe('processVerifyTransaction()', function () {
	// 	var instance,
	// 		__private,
	// 		callback,
	// 		clock,
	// 		modules,
	// 		accounts,
	// 		setAccountAndGetStub,
	// 		broadcastInterval,
	// 		releaseLimit,
	// 		transaction,
	// 		bus,
	// 		logger,
	// 		processSpy,
	// 		objectNormalizeSpy,
	// 		verifySpy,
	// 		busSpy;
	//
	// 	beforeEach(function () {
	// 		clock = sinon.useFakeTimers();
	// 		TransactionPool.__set__('setImmediate', setImmediate);
	// 		__private = TransactionPool.__get__('__private');
	// 		transaction = {
	// 			process: function (transaction, sender, requester, cb) {
	// 				cb();
	// 			},
	// 			objectNormalize: function (transaction) {
	// 				return true;
	// 			},
	// 			verify: function (transaction, sender, height, cb) {
	// 				cb();
	// 			}
	// 		};
	// 		processSpy = sinon.spy(transaction, 'process');
	// 		objectNormalizeSpy = sinon.spy(transaction, 'objectNormalize');
	// 		verifySpy = sinon.spy(transaction, 'verify');
	// 		bus = {
	// 			message: function (message, transaction, broadcast) {
	// 				return true;
	// 			}
	// 		};
	// 		busSpy = sinon.stub(bus, 'message');
	// 		instance = new TransactionPool(
	// 			broadcastInterval,
	// 			releaseLimit,
	// 			transaction,
	// 			bus,
	// 			logger
	// 		);
	// 		accounts = {
	// 			setAccountAndGet: function () {}
	// 		};
	// 		instance.bind(accounts, {}, {});
	// 		modules = TransactionPool.__get__('modules');
	// 		setAccountAndGetStub = sinon
	// 			.stub(modules.accounts, 'setAccountAndGet')
	// 			.callsFake(function (object, cb) {
	// 				cb(null, 'foo');
	// 			});
	// 		callback = sinon.spy();
	// 	});
	//
	// 	afterEach(function () {
	// 		callback.reset();
	// 		setAccountAndGetStub.restore();
	// 		clock.restore();
	// 		processSpy.reset();
	// 		objectNormalizeSpy.reset();
	// 		verifySpy.reset();
	// 		busSpy.reset();
	// 	});
	//
	// 	it('Missing transaction', function () {
	// 		__private.processVerifyTransaction(false, null, callback);
	// 		clock.runAll();
	// 		expect(callback.calledOnce).to.be.true;
	// 		expect(callback.args[0][0]).to.have.string('Missing transaction');
	// 	});
	//
	// 	it('success', function () {
	// 		__private.processVerifyTransaction(true, null, callback);
	// 		clock.runAll();
	// 		expect(callback.called).to.be.true;
	// 		expect(processSpy.called).to.be.true;
	// 		expect(objectNormalizeSpy.called).to.be.true;
	// 		expect(verifySpy.called).to.be.true;
	// 		expect(busSpy.called).to.be.true;
	// 	});
	// });
	//
	// describe('__private.applyUnconfirmedList()', function () {
	// 	var __private,
	// 		instance,
	// 		getUnconfirmedTransactionSpy,
	// 		callback,
	// 		clock,
	// 		processVerifyTransactionStub,
	// 		loggerSpy,
	// 		removeUnconfirmedTransactionStub,
	// 		modules,
	// 		applyUnconfirmedSpy;
	//
	// 	beforeEach(function () {
	// 		clock = sinon.useFakeTimers();
	// 		TransactionPool.__set__('setImmediate', setImmediate);
	// 		callback = sinon.spy();
	// 		__private = TransactionPool.__get__('__private');
	// 		loggerSpy = sinon.spy(logger, 'error');
	// 		instance = new TransactionPool(
	// 			undefined,
	// 			undefined,
	// 			undefined,
	// 			undefined,
	// 			logger
	// 		);
	// 		getUnconfirmedTransactionSpy = sinon.spy(
	// 			instance,
	// 			'getUnconfirmedTransaction'
	// 		);
	// 		processVerifyTransactionStub = sinon
	// 			.stub(__private, 'processVerifyTransaction')
	// 			.callsFake(function (transaction, broadcast, cb) {
	// 				if (transaction.errorOnProcessVerifyTransaction) {
	// 					return setImmediate(cb, 'error');
	// 				} else {
	// 					return setImmediate(cb, null, transaction.errorOnApplyUnconfirmed);
	// 				}
	// 			});
	// 		removeUnconfirmedTransactionStub = sinon.stub(
	// 			instance,
	// 			'removeUnconfirmedTransaction'
	// 		);
	// 		instance.bind(
	// 			{},
	// 			{
	// 				applyUnconfirmed: function (transaction, sender, cb) {
	// 					if (sender === 'error') {
	// 						setImmediate(cb, 'error');
	// 					} else {
	// 						setImmediate(cb);
	// 					}
	// 				}
	// 			},
	// 			{}
	// 		);
	// 		modules = TransactionPool.__get__('modules');
	// 		applyUnconfirmedSpy = sinon.spy(modules.transactions, 'applyUnconfirmed');
	// 	});
	//
	// 	afterEach(function () {
	// 		clock.restore();
	// 		callback.reset();
	// 		getUnconfirmedTransactionSpy.reset();
	// 		processVerifyTransactionStub.restore();
	// 		loggerSpy.reset();
	// 		removeUnconfirmedTransactionStub.restore();
	// 		applyUnconfirmedSpy.reset();
	// 	});
	//
	// 	describe('If a transaction index is received', function () {
	// 		it('If transaction is false', function () {
	// 			instance.unconfirmed.index['123'] = 0;
	// 			instance.unconfirmed.transactions = [false];
	// 			__private.applyUnconfirmedList(['123'], callback);
	// 			clock.runAll();
	// 			expect(instance.getUnconfirmedTransaction.calledOnce).to.be.true;
	// 			expect(callback.calledOnce).to.be.true;
	// 			expect(processVerifyTransactionStub.called).to.be.false;
	// 		});
	//
	// 		it('If processVerifyTransaction() return an error', function () {
	// 			instance.unconfirmed.index['123'] = 0;
	// 			instance.unconfirmed.transactions = [
	// 				{ id: '123', errorOnProcessVerifyTransaction: 'error' }
	// 			];
	// 			__private.applyUnconfirmedList(['123'], callback);
	// 			clock.runAll();
	// 			expect(instance.getUnconfirmedTransaction.calledOnce).to.be.true;
	// 			expect(processVerifyTransactionStub.calledOnce).to.be.true;
	// 			expect(loggerSpy.calledOnce).to.be.true;
	// 			expect(loggerSpy.args[0][0]).to.have.string(
	// 				'Failed to process / verify unconfirmed transaction'
	// 			);
	// 			expect(removeUnconfirmedTransactionStub.calledOnce).to.be.true;
	// 			expect(removeUnconfirmedTransactionStub.args[0][0]).to.equal('123');
	// 			expect(callback.calledOnce).to.be.true;
	// 		});
	//
	// 		it('If applyUnconfirmed() return an error', function () {
	// 			instance.unconfirmed.index['123'] = 0;
	// 			instance.unconfirmed.transactions = [
	// 				{
	// 					id: '123',
	// 					errorOnProcessVerifyTransaction: false,
	// 					errorOnApplyUnconfirmed: 'error'
	// 				}
	// 			];
	// 			__private.applyUnconfirmedList(['123'], callback);
	// 			clock.runAll();
	// 			expect(instance.getUnconfirmedTransaction.calledOnce).to.be.true;
	// 			expect(processVerifyTransactionStub.calledOnce).to.be.true;
	// 			expect(applyUnconfirmedSpy.calledOnce).to.be.true;
	// 			expect(loggerSpy.calledOnce).to.be.true;
	// 			expect(loggerSpy.args[0][0]).to.have.string(
	// 				'Failed to apply unconfirmed transaction'
	// 			);
	// 			expect(removeUnconfirmedTransactionStub.calledOnce).to.be.true;
	// 			expect(removeUnconfirmedTransactionStub.args[0][0]).to.equal('123');
	// 			expect(callback.calledOnce).to.be.true;
	// 		});
	//
	// 		it('success', function () {
	// 			instance.unconfirmed.index['123'] = 0;
	// 			instance.unconfirmed.transactions = [
	// 				{
	// 					id: '123',
	// 					errorOnProcessVerifyTransaction: false,
	// 					errorOnApplyUnconfirmed: false
	// 				}
	// 			];
	// 			__private.applyUnconfirmedList(['123'], callback);
	// 			clock.runAll();
	// 			expect(instance.getUnconfirmedTransaction.calledOnce).to.be.true;
	// 			expect(processVerifyTransactionStub.calledOnce).to.be.true;
	// 			expect(applyUnconfirmedSpy.calledOnce).to.be.true;
	// 			expect(removeUnconfirmedTransactionStub.calledOnce).to.be.false;
	// 			expect(callback.calledOnce).to.be.true;
	// 		});
	// 	});
	//
	// 	describe('If a transaction object is received', function () {
	// 		it('If transaction is false', function () {
	// 			__private.applyUnconfirmedList([false], callback);
	// 			clock.runAll();
	// 			expect(instance.getUnconfirmedTransaction.calledOnce).to.be.false;
	// 			expect(callback.calledOnce).to.be.true;
	// 			expect(processVerifyTransactionStub.called).to.be.false;
	// 		});
	//
	// 		it('If processVerifyTransaction() return an error', function () {
	// 			__private.applyUnconfirmedList(
	// 				[{ id: '123', errorOnProcessVerifyTransaction: 'error' }],
	// 				callback
	// 			);
	// 			clock.runAll();
	// 			expect(instance.getUnconfirmedTransaction.calledOnce).to.be.false;
	// 			expect(processVerifyTransactionStub.calledOnce).to.be.true;
	// 			expect(loggerSpy.calledOnce).to.be.true;
	// 			expect(loggerSpy.args[0][0]).to.have.string(
	// 				'Failed to process / verify unconfirmed transaction'
	// 			);
	// 			expect(removeUnconfirmedTransactionStub.calledOnce).to.be.true;
	// 			expect(removeUnconfirmedTransactionStub.args[0][0]).to.equal('123');
	// 			expect(callback.calledOnce).to.be.true;
	// 		});
	//
	// 		it('If applyUnconfirmed() return an error', function () {
	// 			__private.applyUnconfirmedList(
	// 				[
	// 					{
	// 						id: '123',
	// 						errorOnProcessVerifyTransaction: false,
	// 						errorOnApplyUnconfirmed: 'error'
	// 					}
	// 				],
	// 				callback
	// 			);
	// 			clock.runAll();
	// 			expect(instance.getUnconfirmedTransaction.calledOnce).to.be.false;
	// 			expect(processVerifyTransactionStub.calledOnce).to.be.true;
	// 			expect(applyUnconfirmedSpy.calledOnce).to.be.true;
	// 			expect(loggerSpy.calledOnce).to.be.true;
	// 			expect(loggerSpy.args[0][0]).to.have.string(
	// 				'Failed to apply unconfirmed transaction'
	// 			);
	// 			expect(removeUnconfirmedTransactionStub.calledOnce).to.be.true;
	// 			expect(removeUnconfirmedTransactionStub.args[0][0]).to.equal('123');
	// 			expect(callback.calledOnce).to.be.true;
	// 		});
	//
	// 		it('success', function () {
	// 			__private.applyUnconfirmedList(
	// 				[
	// 					{
	// 						id: '123',
	// 						errorOnProcessVerifyTransaction: false,
	// 						errorOnApplyUnconfirmed: false
	// 					}
	// 				],
	// 				callback
	// 			);
	// 			clock.runAll();
	// 			expect(instance.getUnconfirmedTransaction.calledOnce).to.be.false;
	// 			expect(processVerifyTransactionStub.calledOnce).to.be.true;
	// 			expect(applyUnconfirmedSpy.calledOnce).to.be.true;
	// 			expect(removeUnconfirmedTransactionStub.calledOnce).to.be.false;
	// 			expect(callback.calledOnce).to.be.true;
	// 		});
	// 	});
	// });
	//
	// describe('__private.transactionTimeOut()', function () {
	// 	var __private, timeOut;
	//
	// 	beforeEach(function () {
	// 		__private = TransactionPool.__get__('__private');
	// 	});
	//
	// 	it('If transaction type is MULTI', function () {
	// 		timeOut = __private.transactionTimeOut({
	// 			id: '123',
	// 			type: transactionTypes.MULTI,
	// 			asset: { multisignature: { lifetime: 1 } }
	// 		});
	// 		expect(timeOut).to.equal(3600);
	// 	});
	//
	// 	it('If transaction.signatures is an Array', function () {
	// 		timeOut = __private.transactionTimeOut({
	// 			id: '123',
	// 			type: transactionTypes.SIGNATURE,
	// 			signatures: []
	// 		});
	// 		expect(timeOut).to.equal(constants.unconfirmedTransactionTimeOut * 8);
	// 	});
	//
	// 	it('Rest of cases', function () {
	// 		timeOut = __private.transactionTimeOut({
	// 			id: '123',
	// 			type: transactionTypes.SIGNATURE,
	// 			signatures: null
	// 		});
	// 		expect(timeOut).to.equal(constants.unconfirmedTransactionTimeOut);
	// 	});
	// });
	//
	// describe('__private.expireTransactions()', function () {
	// 	var instance,
	// 		__private,
	// 		callback,
	// 		clock,
	// 		transactionTimeOutSpy,
	// 		removeUnconfirmedTransactionStub,
	// 		loggerSpy;
	//
	// 	beforeEach(function () {
	// 		clock = sinon.useFakeTimers(Date.now());
	// 		TransactionPool.__set__('setImmediate', setImmediate);
	// 		callback = sinon.spy();
	// 		__private = TransactionPool.__get__('__private');
	// 		transactionTimeOutSpy = sinon.spy(__private, 'transactionTimeOut');
	// 		loggerSpy = sinon.spy(logger, 'info');
	// 		instance = new TransactionPool(
	// 			undefined,
	// 			undefined,
	// 			undefined,
	// 			undefined,
	// 			logger
	// 		);
	// 		removeUnconfirmedTransactionStub = sinon
	// 			.stub(instance, 'removeUnconfirmedTransaction')
	// 			.callsFake(function () {
	// 				return true;
	// 			});
	// 	});
	//
	// 	afterEach(function () {
	// 		clock.reset();
	// 		clock.restore();
	// 		callback.reset();
	// 		transactionTimeOutSpy.restore();
	// 		removeUnconfirmedTransactionStub.restore();
	// 		loggerSpy.reset();
	// 	});
	//
	// 	it('If some transaction is false', function () {
	// 		__private.expireTransactions([false], [], callback);
	// 		clock.runAll();
	// 		expect(callback.calledOnce).to.be.true;
	// 		expect(transactionTimeOutSpy.called).to.be.false;
	// 	});
	//
	// 	it('If seconds > timeOut', function () {
	// 		__private.expireTransactions(
	// 			[
	// 				{
	// 					id: '123',
	// 					type: transactionTypes.MULTI,
	// 					receivedAt: new Date(Date.now() - 3601000), // time elapsed will be 3601 sec.
	// 					asset: { multisignature: { lifetime: 1 } } // max life time will be 3600 sec.
	// 				}
	// 			],
	// 			[],
	// 			callback
	// 		);
	// 		clock.runAll();
	// 		expect(transactionTimeOutSpy.called).to.be.true;
	// 		expect(removeUnconfirmedTransactionStub.calledOnce).to.be.true;
	// 		expect(loggerSpy.calledOnce).to.be.true;
	// 		expect(callback.calledOnce).to.be.true;
	// 	});
	//
	// 	it('If seconds < timeOut', function () {
	// 		__private.expireTransactions(
	// 			[
	// 				{
	// 					id: '123',
	// 					type: transactionTypes.MULTI,
	// 					receivedAt: new Date(Date.now() - 3599000), // time elapsed will be 3599 sec.
	// 					asset: { multisignature: { lifetime: 1 } } // max life time will be 3600 sec.
	// 				}
	// 			],
	// 			[],
	// 			callback
	// 		);
	// 		clock.runAll();
	// 		expect(transactionTimeOutSpy.called).to.be.true;
	// 		expect(removeUnconfirmedTransactionStub.called).to.be.false;
	// 		expect(loggerSpy.called).to.be.false;
	// 		expect(callback.calledOnce).to.be.true;
	// 	});
	// });
});
