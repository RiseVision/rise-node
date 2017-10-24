var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var rewire = require('rewire');
var TransactionPool = rewire('../../../logic/transactionPool');
var transactionTypes = require('../../../helpers/transactionTypes');
var jobsQueue = require('../../../helpers/jobsQueue');
var constants = require('../../../helpers/constants.js');

describe('logic/transactionPool', function () {
	var __private, jobsQueueStub, logger;

	beforeEach(function () {
		__private = TransactionPool.__get__('__private');
		jobsQueueStub = sinon.stub(jobsQueue, 'register').returns(true);
		TransactionPool.__set__('jobsQueue', jobsQueue);
		logger = {
			error: function (error) {},
			info: function (error) {},
			log: function (error) {},
			debug: function (error) {}
		};
	});

	afterEach(function () {
		jobsQueueStub.restore();
	});

	describe('when is imported', function () {
		it('should be a function', function () {
			expect(TransactionPool).to.be.a('function');
		});
	});

	describe('when is instantiated', function () {
		var instance, broadcastInterval, releaseLimit, transaction, bus, logger;

		beforeEach(function () {
			broadcastInterval = 1;
			releaseLimit = 2;
			transaction = 3;
			bus = 4;
			logger = 5;
			instance = new TransactionPool(
				broadcastInterval,
				releaseLimit,
				transaction,
				bus,
				logger
			);
		});

		it('should be an instance of TransactionPool', function () {
			expect(instance).to.be.an.instanceof(TransactionPool);
			expect(jobsQueue.register.calledTwice).to.be.true;
		});

		it('should initialize library properly', function () {
			expect(TransactionPool.__get__('library').logger).to.equal(logger);
			expect(TransactionPool.__get__('library').bus).to.equal(bus);
			expect(TransactionPool.__get__('library').logic.transaction).to.equal(
				transaction
			);
			expect(
				TransactionPool.__get__('library').config.broadcasts.broadcastInterval
			).to.equal(broadcastInterval);
			expect(
				TransactionPool.__get__('library').config.broadcasts.releaseLimit
			).to.equal(releaseLimit);
		});

		it('should initialize some local properties', function () {
			expect(instance.unconfirmed).to.deep.equal({
				transactions: [],
				index: {}
			});
			expect(instance.bundled).to.deep.equal({ transactions: [], index: {} });
			expect(instance.queued).to.deep.equal({ transactions: [], index: {} });
			expect(instance.multisignature).to.deep.equal({
				transactions: [],
				index: {}
			});
			expect(instance.expiryInterval).to.equal(30000);
			expect(instance.bundledInterval).to.equal(broadcastInterval);
			expect(instance.bundleLimit).to.equal(releaseLimit);
			expect(instance.processed).to.equal(0);
		});
	});

	describe('bind()', function () {
		var instance, accounts, transactions, loader;

		beforeEach(function () {
			accounts = 1;
			transactions = 2;
			loader = 3;
			instance = new TransactionPool();
			instance.bind(accounts, transactions, loader);
		});

		it('should initialize modules properly', function () {
			expect(TransactionPool.__get__('modules').accounts).to.equal(accounts);
			expect(TransactionPool.__get__('modules').transactions).to.equal(
				transactions
			);
			expect(TransactionPool.__get__('modules').loader).to.equal(loader);
		});
	});

	describe('transactionInPool()', function () {
		var instance;

		describe('Case 1: ', function () {
			beforeEach(function () {
				instance = new TransactionPool();
				instance.unconfirmed.index[111] = 1;
				instance.bundled.index[123] = 1;
				instance.queued.index[456] = 1;
				instance.multisignature.index[111] = 0;
			});

			it('if at least one of the index values are greater than 0 should return true', function () {
				var result = instance.transactionInPool(111);
				expect(result).to.be.true;
			});
		});

		describe('Case 2: if none of the index values are greater than 0', function () {
			beforeEach(function () {
				instance = new TransactionPool();
				instance.unconfirmed.index[111] = 0;
				instance.bundled.index[123] = 1;
				instance.queued.index[456] = 0;
				instance.multisignature.index[111] = 0;
			});

			it('should return false', function () {
				var result = instance.transactionInPool(111);
				expect(result).to.be.false;
			});
		});
	});

	describe('getUnconfirmedTransaction()', function () {
		var instance;

		beforeEach(function () {
			instance = new TransactionPool();
			instance.unconfirmed.index[123] = 2222;
			instance.unconfirmed.transactions[2222] = 9000;
		});

		it('should return the correct value for a given index', function () {
			var value = instance.getUnconfirmedTransaction(123);
			expect(value).to.equal(9000);
		});
	});

	describe('getBundledTransaction()', function () {
		var instance;
		beforeEach(function () {
			instance = new TransactionPool();
			instance.bundled.index[123] = 333;
			instance.bundled.transactions[333] = 8000;
		});

		it('should return the correct value for a given index', function () {
			var value = instance.getBundledTransaction(123);
			expect(value).to.equal(8000);
		});
	});

	describe('getQueuedTransaction()', function () {
		var instance;
		beforeEach(function () {
			instance = new TransactionPool();
			instance.queued.index[123] = 333;
			instance.queued.transactions[333] = 5500;
		});

		it('should return the correct value for a given index', function () {
			var value = instance.getQueuedTransaction(123);
			expect(value).to.equal(5500);
		});
	});

	describe('getMultisignatureTransaction()', function () {
		var instance;
		beforeEach(function () {
			instance = new TransactionPool();
			instance.multisignature.index[123] = 333;
			instance.multisignature.transactions[333] = 4646;
		});

		it('should return the correct value for a given index', function () {
			var value = instance.getMultisignatureTransaction(123);
			expect(value).to.equal(4646);
		});
	});

	describe('getUnconfirmedTransactionList()', function () {
		var instance, getTransactionListStub;

		beforeEach(function () {
			instance = new TransactionPool();
			getTransactionListStub = sinon
				.stub(__private, 'getTransactionList')
				.callsFake(function () {
					return [
						{ id: 1, ready: true, receivedAt: new Date() },
						{ id: 2, ready: false, receivedAt: new Date() },
						{ id: 3, ready: true, receivedAt: new Date() }
					];
				});
		});

		afterEach(function () {
			getTransactionListStub.restore();
		});

		it('should call to __self.getTransactionList()', function () {
			instance.getUnconfirmedTransactionList(1, 2);
			expect(getTransactionListStub.called).to.be.true;
		});
	});

	describe('getBundledTransactionList()', function () {
		var instance, getTransactionListStub;

		beforeEach(function () {
			instance = new TransactionPool();
			getTransactionListStub = sinon
				.stub(__private, 'getTransactionList')
				.callsFake(function () {
					return [
						{ id: 1, ready: true, receivedAt: new Date() },
						{ id: 2, ready: false, receivedAt: new Date() },
						{ id: 3, ready: true, receivedAt: new Date() }
					];
				});
		});

		afterEach(function () {
			getTransactionListStub.restore();
		});

		it('should call to __self.getTransactionList()', function () {
			instance.getBundledTransactionList(1, 2);
			expect(getTransactionListStub.called).to.be.true;
		});
	});

	describe('getQueuedTransactionList()', function () {
		var instance, getTransactionListStub;

		beforeEach(function () {
			instance = new TransactionPool();
			getTransactionListStub = sinon
				.stub(__private, 'getTransactionList')
				.callsFake(function () {
					return [
						{ id: 1, ready: true, receivedAt: new Date() },
						{ id: 2, ready: false, receivedAt: new Date() },
						{ id: 3, ready: true, receivedAt: new Date() }
					];
				});
		});

		afterEach(function () {
			getTransactionListStub.restore();
		});

		it('should call to __self.getTransactionList()', function () {
			instance.getQueuedTransactionList(1, 2);
			expect(getTransactionListStub.called).to.be.true;
		});
	});

	describe('getMultisignatureTransactionList() Case #1', function () {
		var instance, clock, getTransactionListStub;

		beforeEach(function () {
			clock = sinon.useFakeTimers();
			instance = new TransactionPool();
			getTransactionListStub = sinon
				.stub(__private, 'getTransactionList')
				.callsFake(function () {
					return [
						{ id: 1, ready: true, receivedAt: new Date() },
						{ id: 2, ready: false, receivedAt: new Date() },
						{ id: 3, ready: true, receivedAt: new Date() }
					];
				});
		});

		afterEach(function () {
			clock.restore();
			getTransactionListStub.restore();
		});

		it('if ready param is true should call to __private.getTransactionList', function () {
			clock.tick();
			var result = instance.getMultisignatureTransactionList(1, true, 2);
			expect(getTransactionListStub.called).to.be.true;
			expect(result).to.have.lengthOf(2);
		});
	});

	describe('getMultisignatureTransactionList() Case #2', function () {
		var instance, clock, getTransactionListStub;

		beforeEach(function () {
			clock = sinon.useFakeTimers();
			instance = new TransactionPool();
			getTransactionListStub = sinon
				.stub(__private, 'getTransactionList')
				.callsFake(function () {
					return [
						{ id: 1, ready: true, receivedAt: new Date() },
						{ id: 2, ready: false, receivedAt: new Date() },
						{ id: 3, ready: true, receivedAt: new Date() }
					];
				});
		});

		afterEach(function () {
			clock.restore();
			getTransactionListStub.restore();
		});

		it('if ready param is false should call to __private.getTransactionList', function () {
			clock.tick();
			instance.getMultisignatureTransactionList(1, false, 2);
			expect(getTransactionListStub.called).to.be.true;
		});
	});

	describe('getMergedTransactionList()', function () {
		var instance, transactions;

		beforeEach(function () {
			instance = new TransactionPool();

			transactions = {
				getUnconfirmedTransactionList: function () {
					return [1, 2];
				},
				getMultisignatureTransactionList: function () {
					return [3];
				},
				getQueuedTransactionList: function () {
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

	describe('addUnconfirmedTransaction()', function () {
		var instance, transaction_case_1, transaction_case_2, transaction_case_3;

		beforeEach(function () {
			instance = new TransactionPool();
			sinon.spy(instance, 'removeMultisignatureTransaction');
			sinon.spy(instance, 'removeQueuedTransaction');
			transaction_case_1 = { id: '111', type: 4, signatures: '' };
			transaction_case_2 = { id: '222', type: 3, signatures: [1, 2, 3] };
			transaction_case_3 = { id: '333', type: 3, signatures: '' };
		});

		describe('Case 1: If transaction is of type MULTI', function () {
			it('should call to self.removeMultisignatureTransaction', function () {
				instance.addUnconfirmedTransaction(transaction_case_1);
				expect(instance.removeMultisignatureTransaction.called).to.be.true;
			});
		});

		describe('Case 2: If transaction.signatures is of type Array', function () {
			it('should call to self.removeMultisignatureTransaction', function () {
				instance.addUnconfirmedTransaction(transaction_case_2);
				expect(instance.removeMultisignatureTransaction.called).to.be.true;
			});
		});

		describe('Case 3: Rest of cases', function () {
			it('should call to self.removeQueuedTransaction', function () {
				instance.addUnconfirmedTransaction(transaction_case_3);
				expect(instance.removeQueuedTransaction.called).to.be.true;
			});
		});

		describe('Case 4: If self.unconfirmed.index[transaction.id] is undefined', function () {
			it('should populate self.unconfirmed.transactions[] and self.unconfirmed.index[]', function () {
				instance.addUnconfirmedTransaction(transaction_case_3);
				expect(instance.unconfirmed.transactions).to.have.lengthOf(1);
				expect(instance.unconfirmed.index[333]).to.equal(0);
			});
		});
	});

	describe('removeUnconfirmedTransaction()', function () {
		var instance;

		beforeEach(function () {
			instance = new TransactionPool();
			instance.unconfirmed.index[123] = 456;
			instance.unconfirmed.transactions[456] = 8080;
			sinon.spy(instance, 'removeQueuedTransaction');
			sinon.spy(instance, 'removeMultisignatureTransaction');
		});

		it('should remove the index and call to self.removeQueuedTransaction() and self.removeMultisignatureTransaction()', function () {
			instance.removeUnconfirmedTransaction(123);
			expect(instance.unconfirmed.transactions[456]).to.equal(false);
			expect(instance.unconfirmed.index[123]).to.equal(undefined);
			expect(instance.removeQueuedTransaction.called).to.be.true;
			expect(instance.removeMultisignatureTransaction.called).to.be.true;
		});
	});

	describe('countUnconfirmed()', function () {
		it('should return self.unconfirmed.length', function () {
			var instance = new TransactionPool();
			instance.unconfirmed.index[0] = 'a';
			instance.unconfirmed.index[1] = 'b';
			instance.unconfirmed.index[2] = 'c';
			var count = instance.countUnconfirmed();
			expect(count).to.equal(3);
		});
	});

	describe('addBundledTransaction()', function () {
		it('should add transaction to self.bundled.transactions[] and store its index to self.bundled.index[]', function () {
			var instance = new TransactionPool();
			var transaction = { id: 1 };
			instance.addBundledTransaction(transaction);
			expect(instance.bundled.transactions[0]).to.deep.equal(transaction);
			expect(instance.bundled.index[1]).to.equal(0);
		});
	});

	describe('removeBundledTransaction()', function () {
		it('should remove transaction from self.bundled.transactions[] and self.bundled.index[]', function () {
			var instance = new TransactionPool();
			instance.bundled.transactions[0] = { id: 123 };
			instance.bundled.index[123] = 0;
			instance.removeBundledTransaction(123);
			expect(instance.bundled.index[123]).to.equal(undefined);
			expect(instance.bundled.transactions[0]).to.equal(false);
		});
	});

	describe('countBundled()', function () {
		it('should return self.bundled.index[] length', function () {
			var instance = new TransactionPool();
			instance.bundled.index[1] = 'a';
			instance.bundled.index[2] = 'b';
			var count = instance.countBundled();
			expect(count).to.equal(2);
		});
	});

	describe('addQueuedTransaction()', function () {
		it('should add transaction to self.queued.transactions[] and its index to self.queued.index[]', function () {
			var instance = new TransactionPool();
			var transaction = { id: 1020 };
			instance.addQueuedTransaction(transaction);
			expect(instance.queued.transactions[0]).to.deep.equal(transaction);
			expect(instance.queued.index[1020]).to.equal(0);
		});
	});

	describe('removeQueuedTransaction()', function () {
		it('should remove transaction from self.queued.transactions[] and self.queued.index[]', function () {
			var instance = new TransactionPool();
			instance.queued.transactions[0] = { id: 4040 };
			instance.queued.index[4040] = 0;
			instance.removeQueuedTransaction(4040);
			expect(instance.queued.transactions[0]).to.equal(false);
			expect(instance.queued.index[4040]).to.equal(undefined);
		});
	});

	describe('countQueued()', function () {
		it('should return self.queued.index[] count', function () {
			var instance = new TransactionPool();
			instance.queued.index[123] = 0;
			instance.queued.index[456] = 1;
			var count = instance.countQueued();
			expect(count).to.equal(2);
		});
	});

	describe('addMultisignatureTransaction()', function () {
		it('should add transaction to self.queued.multisignature[] and its index to self.multisignature.index[]', function () {
			var instance = new TransactionPool();
			var transaction = { id: 1020 };
			instance.addMultisignatureTransaction(transaction);
			expect(instance.multisignature.transactions[0]).to.deep.equal(
				transaction
			);
			expect(instance.multisignature.index[1020]).to.equal(0);
		});
	});

	describe('removeMultisignatureTransaction()', function () {
		it('should remove transaction from self.multisignature.transactions[] and self.multisignature.index[]', function () {
			var instance = new TransactionPool();
			instance.multisignature.transactions[0] = { id: 4040 };
			instance.multisignature.index[4040] = 0;
			instance.removeMultisignatureTransaction(4040);
			expect(instance.multisignature.transactions[0]).to.equal(false);
			expect(instance.multisignature.index[4040]).to.equal(undefined);
		});
	});

	describe('countMultisignature()', function () {
		it('should return self.multisignature.index[] count', function () {
			var instance = new TransactionPool();
			instance.multisignature.index[123] = 0;
			instance.multisignature.index[456] = 1;
			var count = instance.countMultisignature();
			expect(count).to.equal(2);
		});
	});

	describe('receiveTransactions()', function () {
		var instance, transactions, broadcast, callback;

		beforeEach(function () {
			callback = sinon.spy();
			instance = new TransactionPool();
			sinon
				.stub(instance, 'processUnconfirmedTransaction')
				.callsFake(function (transaction, broadcast, cb) {
					setImmediate(cb);
				});
			transactions = [{ id: 1 }, { id: 2 }];
			instance.receiveTransactions(transactions, broadcast, callback);
		});

		it('should call to self.processUnconfirmedTransaction() and callback()', function () {
			setImmediate(function () {
				expect(instance.processUnconfirmedTransaction.calledTwice).to.be.true;
				expect(callback.called).to.be.true;
			});
		});
	});

	describe('reindexQueues()', function () {
		it('should remove false values from all transaction queues', function () {
			var instance = new TransactionPool();
			instance.bundled.transactions = [{ id: 1 }, { id: 2 }, null];
			instance.queued.transactions = [{ id: 1 }, { id: 2 }, null];
			instance.multisignature.transactions = [{ id: 1 }, { id: 2 }, null];
			instance.unconfirmed.transactions = [{ id: 1 }, { id: 2 }, null];
			instance.reindexQueues();
			expect(instance.bundled.transactions).to.have.lengthOf(2);
			expect(instance.queued.transactions).to.have.lengthOf(2);
			expect(instance.multisignature.transactions).to.have.lengthOf(2);
			expect(instance.unconfirmed.transactions).to.have.lengthOf(2);
		});
	});

	describe('processBundled()', function () {
		var instance,
			callback,
			__private,
			transactions_case_1,
			transactions_case_2,
			spy2,
			spy3,
			processVerifyTransactionStub,
			clock;

		beforeEach(function () {
			clock = sinon.useFakeTimers();
			TransactionPool.__set__('setImmediate', setImmediate);
			callback = sinon.spy();
			__private = TransactionPool.__get__('__private');
			processVerifyTransactionStub = sinon
				.stub(__private, 'processVerifyTransaction')
				.callsFake(function (transaction, broadcast, cb) {
					setImmediate(cb);
				});
			instance = new TransactionPool();
			spy2 = sinon.spy(instance, 'getBundledTransactionList');
			spy3 = sinon.spy(instance, 'removeBundledTransaction');
			transactions_case_1 = [];
			transactions_case_2 = [{ id: 2 }];
		});

		afterEach(function () {
			clock.restore();
			callback.reset();
			spy2.reset();
			spy3.reset();
			processVerifyTransactionStub.restore();
		});

		it('should call to getBundledTransactionList() and processVerifyTransaction()', function () {
			instance.bundled.transactions = transactions_case_1;
			instance.processBundled(callback);
			clock.runAll();
			expect(instance.getBundledTransactionList.called).to.be.true;
			expect(instance.removeBundledTransaction.called).to.be.false;
			expect(__private.processVerifyTransaction.called).to.be.false;
		});

		it('should call to getBundledTransactionList(), removeBundledTransaction() and processVerifyTransaction()', function () {
			instance.bundled.transactions = transactions_case_2;
			instance.processBundled(callback);
			clock.runAll();
			expect(instance.getBundledTransactionList.called).to.be.true;
			expect(instance.removeBundledTransaction.called).to.be.true;
			expect(processVerifyTransactionStub.called).to.be.true;
		});
	});

	describe('processUnconfirmedTransaction()', function () {
		var instance,
			broadcast,
			callback,
			transactionInPoolStub,
			clock,
			reindexesQueuesSpy,
			queueTransactionSpy,
			__private,
			processVerifyTransactionStub;

		beforeEach(function () {
			clock = sinon.useFakeTimers();
			TransactionPool.__set__('setImmediate', setImmediate);
			instance = new TransactionPool();
			instance.processed = 1000;
			transactionInPoolStub = sinon.stub(instance, 'transactionInPool');
			transactionInPoolStub.withArgs('already_processed').returns(true);
			transactionInPoolStub
				.withArgs('unprocessed', 'throw_error')
				.returns(false);
			reindexesQueuesSpy = sinon.spy(instance, 'reindexQueues');
			queueTransactionSpy = sinon.spy(instance, 'queueTransaction');
			__private = TransactionPool.__get__('__private');
			processVerifyTransactionStub = sinon
				.stub(__private, 'processVerifyTransaction')
				.callsFake(function (transaction, broadcast, cb) {
					if (transaction.id === 'throw_error') {
						setImmediate(cb, 'Some error');
					} else {
						setImmediate(cb);
					}
				});
			callback = sinon.spy();
		});

		afterEach(function () {
			clock.restore();
			transactionInPoolStub.restore();
			reindexesQueuesSpy.reset();
			queueTransactionSpy.reset();
			processVerifyTransactionStub.restore();
			callback.reset();
		});

		describe('If transaction is already processed', function () {
			it('should call to callback() with message \'Transaction is already processed\'', function () {
				instance.processUnconfirmedTransaction(
					{ id: 'already_processed' },
					broadcast,
					callback
				);
				clock.tick();
				expect(callback.calledOnce).to.be.true;
				expect(callback.args[0][0]).to.have.string(
					'Transaction is already processed'
				);
			});
		});

		describe('If transaction is unprocessed and self.processed is greater than 1000', function () {
			it('should call to self.reindexQueues() and self.processed should be equal to 1 ', function () {
				instance.processUnconfirmedTransaction(
					{ id: 'unprocessed' },
					broadcast,
					callback
				);
				clock.tick();
				expect(instance.reindexQueues.calledOnce).to.be.true;
				expect(instance.processed).to.equal(1);
			});
		});

		describe('if transaction.bundled is true', function () {
			it('should call to self.queueTransaction()', function () {
				instance.processUnconfirmedTransaction(
					{ id: 'unprocessed', bundled: true },
					broadcast,
					callback
				);
				clock.tick();
				expect(instance.queueTransaction.calledOnce).to.be.true;
			});
		});

		describe('if transaction.bundled is true and __private.processVerifyTransaction() return an error', function () {
			it('should call to self.queueTransaction() twice', function () {
				instance.processUnconfirmedTransaction(
					{ id: 'throw_error', bundled: true },
					broadcast,
					callback
				);
				clock.tick();
				expect(instance.queueTransaction.calledOnce).to.be.true;
			});
		});

		describe('if transaction.bundled is true and __private.processVerifyTransaction() has not errors', function () {
			it('should call to callback() without errors', function () {
				instance.processUnconfirmedTransaction(
					{ id: 'unprocessed', bundled: true },
					broadcast,
					callback
				);
				clock.tick();
				expect(callback.calledOnce).to.be.true;
			});
		});
	});

	describe('queueTransaction()', function () {
		var instance,
			callback,
			clock,
			transaction_true,
			transaction_multi,
			transaction_vote,
			transaction_false,
			addBundledTransactionSpy;

		beforeEach(function () {
			clock = sinon.useFakeTimers();
			TransactionPool.__set__('setImmediate', setImmediate);
			instance = new TransactionPool();
			addBundledTransactionSpy = sinon.spy(instance, 'addBundledTransaction');
			callback = sinon.spy();
			transaction_true = { bundled: true };
			transaction_multi = { bundled: false, type: transactionTypes.MULTI };
			transaction_vote = {
				bundled: false,
				type: transactionTypes.VOTE,
				signatures: []
			};
			transaction_false = { bundled: false };
		});

		afterEach(function () {
			callback.reset();
			clock.restore();
			addBundledTransactionSpy.reset();
		});

		it('Case 1: return error', function () {
			instance.bundled.index = new Array(1000).fill(0);
			instance.queueTransaction(transaction_true, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Transaction pool is full');
		});

		it('Case 2: call to addBundledTransaction() and callback()', function () {
			instance.bundled.index = new Array(999).fill(0);
			instance.queueTransaction(transaction_true, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(undefined);
		});

		it('Case 3: return error', function () {
			instance.multisignature.index = new Array(1000).fill(0);
			instance.queueTransaction(transaction_multi, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Transaction pool is full');
		});

		it('Case 4: return error', function () {
			instance.multisignature.index = new Array(1000).fill(0);
			instance.queueTransaction(transaction_vote, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Transaction pool is full');
		});

		it('Case 5: call to addMultisignatureTransaction() and callback()', function () {
			instance.multisignature.index = new Array(999).fill(0);
			instance.queueTransaction(transaction_false, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(undefined);
		});

		it('Case 6: return error', function () {
			instance.queued.index = new Array(1000).fill(0);
			instance.queueTransaction(transaction_false, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Transaction pool is full');
		});

		it('Case 7: call to addQueuedTransaction() and callback()', function () {
			instance.queued.index = new Array(999).fill(0);
			instance.queueTransaction(transaction_false, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(undefined);
		});
	});

	describe('applyUnconfirmedList()', function () {
		var instance,
			__private,
			applyUnconfirmedListSpy,
			callback,
			getUnconfirmedTransactionListSpy;

		it('call to __private.applyUnconfirmedList() and getUnconfirmedTransactionList()', function () {
			__private = TransactionPool.__get__('__private');
			applyUnconfirmedListSpy = sinon.stub(__private, 'applyUnconfirmedList');
			instance = new TransactionPool();
			getUnconfirmedTransactionListSpy = sinon.spy(
				instance,
				'getUnconfirmedTransactionList'
			);
			instance.applyUnconfirmedList(callback);
			expect(__private.applyUnconfirmedList.calledOnce).to.be.true;
			expect(instance.getUnconfirmedTransactionList.calledOnce).to.be.true;
			applyUnconfirmedListSpy.restore();
			getUnconfirmedTransactionListSpy.reset();
		});
	});

	describe('applyUnconfirmedIds()', function () {
		var instance, applyUnconfirmedListStub, callback, ids, __private;

		it('call to __private.applyUnconfirmedList()', function () {
			__private = TransactionPool.__get__('__private');
			applyUnconfirmedListStub = sinon.stub(__private, 'applyUnconfirmedList');
			instance = new TransactionPool();
			instance.applyUnconfirmedIds(ids, callback);
			expect(__private.applyUnconfirmedList.calledOnce).to.be.true;
			applyUnconfirmedListStub.restore();
		});
	});

	describe('undoUnconfirmedList()', function () {
		var instance,
			transactions,
			transactionsSpy,
			callback,
			loggerSpy,
			removeUnconfirmedTransactionStub,
			removeUnconfirmedTransactionSpy,
			clock;

		beforeEach(function () {
			clock = sinon.useFakeTimers();
			TransactionPool.__set__('setImmediate', setImmediate);

			transactions = {
				undoUnconfirmed: function (transaction, cb) {
					if (transaction.id === 2) {
						setImmediate(cb, 'dummy_error');
					} else {
						setImmediate(cb);
					}
				}
			};

			transactionsSpy = sinon.spy(transactions, 'undoUnconfirmed');

			loggerSpy = sinon.spy(logger, 'error');
			callback = sinon.spy();
			instance = new TransactionPool(
				undefined,
				undefined,
				undefined,
				undefined,
				logger
			);
		});

		afterEach(function () {
			clock.restore();
			transactionsSpy.reset();
			loggerSpy.reset();
			callback.reset();
		});

		it('if there are errors', function () {
			removeUnconfirmedTransactionStub = sinon
				.stub(instance, 'removeUnconfirmedTransaction')
				.returns('foo');
			instance.unconfirmed.transactions = [
				{ id: 1, receivedAt: new Date() },
				{ id: 2, receivedAt: new Date() }
			];
			instance.unconfirmed.index = { '1': 0, '2': 1 };
			instance.bind(false, transactions, false);
			instance.undoUnconfirmedList(callback);
			clock.runAll();
			expect(callback.called).to.be.true;
			expect(callback.args[0][1]).to.have.lengthOf(2);
			expect(instance.removeUnconfirmedTransaction.called).to.be.true;
			expect(logger.error.calledOnce).to.be.true;
			removeUnconfirmedTransactionStub.restore();
		});

		it('success', function () {
			removeUnconfirmedTransactionSpy = sinon.spy(
				instance,
				'removeUnconfirmedTransaction'
			);
			instance.unconfirmed.transactions = [
				{ id: 1, receivedAt: new Date() },
				{ id: 3, receivedAt: new Date() }
			];
			instance.unconfirmed.index = { '1': 0, '3': 1 };
			instance.bind(false, transactions, false);
			instance.undoUnconfirmedList(callback);
			clock.runAll();
			expect(callback.called).to.be.true;
			expect(callback.args[0][1]).to.have.lengthOf(2);
			expect(instance.removeUnconfirmedTransaction.called).to.be.false;
			expect(logger.error.calledOnce).to.be.false;
			removeUnconfirmedTransactionSpy.reset();
		});
	});

	describe('expireTransactions()', function () {
		var instance,
			__private,
			callback,
			expireTransactionsSpy,
			clock,
			getUnconfirmedTransactionListSpy,
			getQueuedTransactionListSpy,
			getMultisignatureTransactionListSpy;

		beforeEach(function () {
			clock = sinon.useFakeTimers();
			TransactionPool.__set__('setImmediate', setImmediate);
			callback = sinon.spy();
			__private = TransactionPool.__get__('__private');
			expireTransactionsSpy = sinon.spy(__private, 'expireTransactions');
			instance = new TransactionPool();
			getUnconfirmedTransactionListSpy = sinon.spy(
				instance,
				'getUnconfirmedTransactionList'
			);
			getQueuedTransactionListSpy = sinon.spy(
				instance,
				'getQueuedTransactionList'
			);
			getMultisignatureTransactionListSpy = sinon.spy(
				instance,
				'getMultisignatureTransactionList'
			);
		});

		afterEach(function () {
			callback.reset();
			expireTransactionsSpy.reset();
			getUnconfirmedTransactionListSpy.reset();
			getQueuedTransactionListSpy.reset();
			getMultisignatureTransactionListSpy.reset();
		});

		it('success', function () {
			instance.expireTransactions(callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(null);
			expect(__private.expireTransactions.calledThrice).to.be.true;
			expect(getUnconfirmedTransactionListSpy.called).to.be.true;
			expect(getQueuedTransactionListSpy.called).to.be.true;
			expect(getMultisignatureTransactionListSpy.called).to.be.true;
		});
	});

	describe('fillPool()', function () {
		var instance,
			modules,
			modulesStub,
			callback,
			clock,
			countUnconfirmedStub,
			applyUnconfirmedListStub;

		beforeEach(function () {
			clock = sinon.useFakeTimers();
			TransactionPool.__set__('setImmediate', setImmediate);
			instance = new TransactionPool(
				undefined,
				undefined,
				undefined,
				undefined,
				logger
			);
			instance.bind(
				{},
				{},
				{
					syncing: function () {}
				}
			);
			modules = TransactionPool.__get__('modules');
			callback = sinon.spy();
		});

		afterEach(function () {
			callback.reset();
			clock.restore();
		});

		it('modules.loader.syncing() returns true', function () {
			modulesStub = sinon.stub(modules.loader, 'syncing').returns(true);
			countUnconfirmedStub = sinon
				.stub(instance, 'countUnconfirmed')
				.returns(null);
			instance.fillPool(callback);
			clock.runAll();
			expect(modules.loader.syncing.calledOnce).to.be.true;
			expect(countUnconfirmedStub.calledOnce).to.be.false;
			expect(callback.calledOnce).to.be.true;
			modulesStub.restore();
			countUnconfirmedStub.reset();
		});

		it('unconfirmedCount is equal or greater than constants.maxTxsPerBlock', function () {
			modulesStub = sinon.stub(modules.loader, 'syncing').returns(false);
			countUnconfirmedStub = sinon
				.stub(instance, 'countUnconfirmed')
				.returns(25);
			instance.fillPool(callback);
			clock.runAll();
			expect(modules.loader.syncing.calledOnce).to.be.true;
			expect(countUnconfirmedStub.calledOnce).to.be.true;
			expect(callback.calledOnce).to.be.true;
			modulesStub.restore();
			countUnconfirmedStub.reset();
		});

		it('unconfirmedCount is less than constants.maxTxsPerBlock', function () {
			modulesStub = sinon.stub(modules.loader, 'syncing').returns(false);
			countUnconfirmedStub = sinon
				.stub(instance, 'countUnconfirmed')
				.returns(24);
			applyUnconfirmedListStub = sinon
				.stub(__private, 'applyUnconfirmedList')
				.callsFake(function (transactions, cb) {
					return setImmediate(cb);
				});
			instance.fillPool(callback);
			clock.runAll();
			expect(modules.loader.syncing.calledOnce).to.be.true;
			expect(countUnconfirmedStub.calledOnce).to.be.true;
			expect(callback.calledOnce).to.be.true;
			expect(applyUnconfirmedListStub.calledOnce).to.be.true;
			modulesStub.restore();
			countUnconfirmedStub.reset();
			applyUnconfirmedListStub.restore();
		});
	});

	describe('__private.getTransactionList()', function () {
		var __private, transactions;

		beforeEach(function () {
			transactions = [{ id: 101 }, { id: 102 }, { id: 103 }, false];
			__private = TransactionPool.__get__('__private');
		});

		it('test without reverse and limit', function () {
			var result = __private.getTransactionList(transactions);
			expect(result).to.have.lengthOf(3);
			expect(result).to.deep.equal([{ id: 101 }, { id: 102 }, { id: 103 }]);
		});

		it('test reverse', function () {
			var result = __private.getTransactionList(transactions, true);
			expect(result).to.have.lengthOf(3);
			expect(result).to.deep.equal([{ id: 103 }, { id: 102 }, { id: 101 }]);
		});

		it('test limit', function () {
			var result = __private.getTransactionList(transactions, false, 2);
			expect(result).to.have.lengthOf(2);
			expect(result).to.deep.equal([{ id: 101 }, { id: 102 }]);
		});

		it('test with reverse and limit', function () {
			var result = __private.getTransactionList(transactions, true, 2);
			expect(result).to.have.lengthOf(2);
			expect(result).to.deep.equal([{ id: 103 }, { id: 102 }]);
		});
	});

	describe('processVerifyTransaction()', function () {
		var instance,
			__private,
			callback,
			clock,
			modules,
			accounts,
			setAccountAndGetStub,
			broadcastInterval,
			releaseLimit,
			transaction,
			bus,
			logger,
			processSpy,
			objectNormalizeSpy,
			verifySpy,
			busSpy;

		beforeEach(function () {
			clock = sinon.useFakeTimers();
			TransactionPool.__set__('setImmediate', setImmediate);
			__private = TransactionPool.__get__('__private');
			transaction = {
				process: function (transaction, sender, requester, cb) {
					cb();
				},
				objectNormalize: function (transaction) {
					return true;
				},
				verify: function (transaction, sender, height, cb) {
					cb();
				}
			};
			processSpy = sinon.spy(transaction, 'process');
			objectNormalizeSpy = sinon.spy(transaction, 'objectNormalize');
			verifySpy = sinon.spy(transaction, 'verify');
			bus = {
				message: function (message, transaction, broadcast) {
					return true;
				}
			};
			busSpy = sinon.stub(bus, 'message');
			instance = new TransactionPool(
				broadcastInterval,
				releaseLimit,
				transaction,
				bus,
				logger
			);
			accounts = {
				setAccountAndGet: function () {}
			};
			instance.bind(accounts, {}, {});
			modules = TransactionPool.__get__('modules');
			setAccountAndGetStub = sinon
				.stub(modules.accounts, 'setAccountAndGet')
				.callsFake(function (object, cb) {
					cb(null, 'foo');
				});
			callback = sinon.spy();
		});

		afterEach(function () {
			callback.reset();
			setAccountAndGetStub.restore();
			clock.restore();
			processSpy.reset();
			objectNormalizeSpy.reset();
			verifySpy.reset();
			busSpy.reset();
		});

		it('Missing transaction', function () {
			__private.processVerifyTransaction(false, null, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Missing transaction');
		});

		it('success', function () {
			__private.processVerifyTransaction(true, null, callback);
			clock.runAll();
			expect(callback.called).to.be.true;
			expect(processSpy.called).to.be.true;
			expect(objectNormalizeSpy.called).to.be.true;
			expect(verifySpy.called).to.be.true;
			expect(busSpy.called).to.be.true;
		});
	});

	describe('__private.applyUnconfirmedList()', function () {
		var __private,
			instance,
			getUnconfirmedTransactionSpy,
			callback,
			clock,
			processVerifyTransactionStub,
			loggerSpy,
			removeUnconfirmedTransactionStub,
			modules,
			applyUnconfirmedSpy;

		beforeEach(function () {
			clock = sinon.useFakeTimers();
			TransactionPool.__set__('setImmediate', setImmediate);
			callback = sinon.spy();
			__private = TransactionPool.__get__('__private');
			loggerSpy = sinon.spy(logger, 'error');
			instance = new TransactionPool(
				undefined,
				undefined,
				undefined,
				undefined,
				logger
			);
			getUnconfirmedTransactionSpy = sinon.spy(
				instance,
				'getUnconfirmedTransaction'
			);
			processVerifyTransactionStub = sinon
				.stub(__private, 'processVerifyTransaction')
				.callsFake(function (transaction, broadcast, cb) {
					if (transaction.errorOnProcessVerifyTransaction) {
						return setImmediate(cb, 'error');
					} else {
						return setImmediate(cb, null, transaction.errorOnApplyUnconfirmed);
					}
				});
			removeUnconfirmedTransactionStub = sinon.stub(
				instance,
				'removeUnconfirmedTransaction'
			);
			instance.bind(
				{},
				{
					applyUnconfirmed: function (transaction, sender, cb) {
						if (sender === 'error') {
							setImmediate(cb, 'error');
						} else {
							setImmediate(cb);
						}
					}
				},
				{}
			);
			modules = TransactionPool.__get__('modules');
			applyUnconfirmedSpy = sinon.spy(modules.transactions, 'applyUnconfirmed');
		});

		afterEach(function () {
			clock.restore();
			callback.reset();
			getUnconfirmedTransactionSpy.reset();
			processVerifyTransactionStub.restore();
			loggerSpy.reset();
			removeUnconfirmedTransactionStub.restore();
			applyUnconfirmedSpy.reset();
		});

		describe('If a transaction index is received', function () {
			it('If transaction is false', function () {
				instance.unconfirmed.index['123'] = 0;
				instance.unconfirmed.transactions = [false];
				__private.applyUnconfirmedList(['123'], callback);
				clock.runAll();
				expect(instance.getUnconfirmedTransaction.calledOnce).to.be.true;
				expect(callback.calledOnce).to.be.true;
				expect(processVerifyTransactionStub.called).to.be.false;
			});

			it('If processVerifyTransaction() return an error', function () {
				instance.unconfirmed.index['123'] = 0;
				instance.unconfirmed.transactions = [
					{ id: '123', errorOnProcessVerifyTransaction: 'error' }
				];
				__private.applyUnconfirmedList(['123'], callback);
				clock.runAll();
				expect(instance.getUnconfirmedTransaction.calledOnce).to.be.true;
				expect(processVerifyTransactionStub.calledOnce).to.be.true;
				expect(loggerSpy.calledOnce).to.be.true;
				expect(loggerSpy.args[0][0]).to.have.string(
					'Failed to process / verify unconfirmed transaction'
				);
				expect(removeUnconfirmedTransactionStub.calledOnce).to.be.true;
				expect(removeUnconfirmedTransactionStub.args[0][0]).to.equal('123');
				expect(callback.calledOnce).to.be.true;
			});

			it('If applyUnconfirmed() return an error', function () {
				instance.unconfirmed.index['123'] = 0;
				instance.unconfirmed.transactions = [
					{
						id: '123',
						errorOnProcessVerifyTransaction: false,
						errorOnApplyUnconfirmed: 'error'
					}
				];
				__private.applyUnconfirmedList(['123'], callback);
				clock.runAll();
				expect(instance.getUnconfirmedTransaction.calledOnce).to.be.true;
				expect(processVerifyTransactionStub.calledOnce).to.be.true;
				expect(applyUnconfirmedSpy.calledOnce).to.be.true;
				expect(loggerSpy.calledOnce).to.be.true;
				expect(loggerSpy.args[0][0]).to.have.string(
					'Failed to apply unconfirmed transaction'
				);
				expect(removeUnconfirmedTransactionStub.calledOnce).to.be.true;
				expect(removeUnconfirmedTransactionStub.args[0][0]).to.equal('123');
				expect(callback.calledOnce).to.be.true;
			});

			it('success', function () {
				instance.unconfirmed.index['123'] = 0;
				instance.unconfirmed.transactions = [
					{
						id: '123',
						errorOnProcessVerifyTransaction: false,
						errorOnApplyUnconfirmed: false
					}
				];
				__private.applyUnconfirmedList(['123'], callback);
				clock.runAll();
				expect(instance.getUnconfirmedTransaction.calledOnce).to.be.true;
				expect(processVerifyTransactionStub.calledOnce).to.be.true;
				expect(applyUnconfirmedSpy.calledOnce).to.be.true;
				expect(removeUnconfirmedTransactionStub.calledOnce).to.be.false;
				expect(callback.calledOnce).to.be.true;
			});
		});

		describe('If a transaction object is received', function () {
			it('If transaction is false', function () {
				__private.applyUnconfirmedList([false], callback);
				clock.runAll();
				expect(instance.getUnconfirmedTransaction.calledOnce).to.be.false;
				expect(callback.calledOnce).to.be.true;
				expect(processVerifyTransactionStub.called).to.be.false;
			});

			it('If processVerifyTransaction() return an error', function () {
				__private.applyUnconfirmedList(
					[{ id: '123', errorOnProcessVerifyTransaction: 'error' }],
					callback
				);
				clock.runAll();
				expect(instance.getUnconfirmedTransaction.calledOnce).to.be.false;
				expect(processVerifyTransactionStub.calledOnce).to.be.true;
				expect(loggerSpy.calledOnce).to.be.true;
				expect(loggerSpy.args[0][0]).to.have.string(
					'Failed to process / verify unconfirmed transaction'
				);
				expect(removeUnconfirmedTransactionStub.calledOnce).to.be.true;
				expect(removeUnconfirmedTransactionStub.args[0][0]).to.equal('123');
				expect(callback.calledOnce).to.be.true;
			});

			it('If applyUnconfirmed() return an error', function () {
				__private.applyUnconfirmedList(
					[
						{
							id: '123',
							errorOnProcessVerifyTransaction: false,
							errorOnApplyUnconfirmed: 'error'
						}
					],
					callback
				);
				clock.runAll();
				expect(instance.getUnconfirmedTransaction.calledOnce).to.be.false;
				expect(processVerifyTransactionStub.calledOnce).to.be.true;
				expect(applyUnconfirmedSpy.calledOnce).to.be.true;
				expect(loggerSpy.calledOnce).to.be.true;
				expect(loggerSpy.args[0][0]).to.have.string(
					'Failed to apply unconfirmed transaction'
				);
				expect(removeUnconfirmedTransactionStub.calledOnce).to.be.true;
				expect(removeUnconfirmedTransactionStub.args[0][0]).to.equal('123');
				expect(callback.calledOnce).to.be.true;
			});

			it('success', function () {
				__private.applyUnconfirmedList(
					[
						{
							id: '123',
							errorOnProcessVerifyTransaction: false,
							errorOnApplyUnconfirmed: false
						}
					],
					callback
				);
				clock.runAll();
				expect(instance.getUnconfirmedTransaction.calledOnce).to.be.false;
				expect(processVerifyTransactionStub.calledOnce).to.be.true;
				expect(applyUnconfirmedSpy.calledOnce).to.be.true;
				expect(removeUnconfirmedTransactionStub.calledOnce).to.be.false;
				expect(callback.calledOnce).to.be.true;
			});
		});
	});

	describe('__private.transactionTimeOut()', function () {
		var __private, timeOut;

		beforeEach(function () {
			__private = TransactionPool.__get__('__private');
		});

		it('If transaction type is MULTI', function () {
			timeOut = __private.transactionTimeOut({
				id: '123',
				type: transactionTypes.MULTI,
				asset: { multisignature: { lifetime: 1 } }
			});
			expect(timeOut).to.equal(3600);
		});

		it('If transaction.signatures is an Array', function () {
			timeOut = __private.transactionTimeOut({
				id: '123',
				type: transactionTypes.SIGNATURE,
				signatures: []
			});
			expect(timeOut).to.equal(constants.unconfirmedTransactionTimeOut * 8);
		});

		it('Rest of cases', function () {
			timeOut = __private.transactionTimeOut({
				id: '123',
				type: transactionTypes.SIGNATURE,
				signatures: null
			});
			expect(timeOut).to.equal(constants.unconfirmedTransactionTimeOut);
		});
	});

	describe('__private.expireTransactions()', function () {
		var instance,
			__private,
			callback,
			clock,
			transactionTimeOutSpy,
			removeUnconfirmedTransactionStub,
			loggerSpy;

		beforeEach(function () {
			clock = sinon.useFakeTimers(Date.now());
			TransactionPool.__set__('setImmediate', setImmediate);
			callback = sinon.spy();
			__private = TransactionPool.__get__('__private');
			transactionTimeOutSpy = sinon.spy(__private, 'transactionTimeOut');
			loggerSpy = sinon.spy(logger, 'info');
			instance = new TransactionPool(
				undefined,
				undefined,
				undefined,
				undefined,
				logger
			);
			removeUnconfirmedTransactionStub = sinon
				.stub(instance, 'removeUnconfirmedTransaction')
				.callsFake(function () {
					return true;
				});
		});

		afterEach(function () {
			clock.reset();
			clock.restore();
			callback.reset();
			transactionTimeOutSpy.restore();
			removeUnconfirmedTransactionStub.restore();
			loggerSpy.reset();
		});

		it('If some transaction is false', function () {
			__private.expireTransactions([false], [], callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(transactionTimeOutSpy.called).to.be.false;
		});

		it('If seconds > timeOut', function () {
			__private.expireTransactions(
				[
					{
						id: '123',
						type: transactionTypes.MULTI,
						receivedAt: new Date(Date.now() - 3601000), // time elapsed will be 3601 sec.
						asset: { multisignature: { lifetime: 1 } } // max life time will be 3600 sec.
					}
				],
				[],
				callback
			);
			clock.runAll();
			expect(transactionTimeOutSpy.called).to.be.true;
			expect(removeUnconfirmedTransactionStub.calledOnce).to.be.true;
			expect(loggerSpy.calledOnce).to.be.true;
			expect(callback.calledOnce).to.be.true;
		});

		it('If seconds < timeOut', function () {
			__private.expireTransactions(
				[
					{
						id: '123',
						type: transactionTypes.MULTI,
						receivedAt: new Date(Date.now() - 3599000), // time elapsed will be 3599 sec.
						asset: { multisignature: { lifetime: 1 } } // max life time will be 3600 sec.
					}
				],
				[],
				callback
			);
			clock.runAll();
			expect(transactionTimeOutSpy.called).to.be.true;
			expect(removeUnconfirmedTransactionStub.called).to.be.false;
			expect(loggerSpy.called).to.be.false;
			expect(callback.calledOnce).to.be.true;
		});
	});
});
