var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var rewire = require('rewire');
var Transaction = rewire('../../../logic/transaction');
var transactionTypes = require('../../../helpers/transactionTypes');
var Vote = require('../../../logic/vote');
var Delegate = require('../../../logic/delegate');
var slots = require('../../../helpers/slots');
var ed = require('../../../helpers/ed');
var bignum = require('../../../helpers/bignum.js');
var exceptions = require('../../../helpers/exceptions.js');
var crypto = require('crypto');
var constants = require('../../../helpers/constants.js');
var senderHash = crypto
	.createHash('sha256')
	.update('Hello World!', 'utf8')
	.digest();
var senderKeypair = ed.makeKeypair(senderHash);
var validTransaction = {
	id: '16140284222734558289',
	rowId: 133,
	blockId: '1462190441827192029',
	type: transactionTypes.VOTE,
	timestamp: 33363661,
	senderPublicKey:
		'c094ebee7ec0c50ebee32918655e089f6e1a604b83bcaa760293c61e0f18ab6f',
	senderId: '16313739661670634666R',
	recipientId: '5649948960790668770R',
	amount: 8067474861277,
	fee: 10000000,
	signature:
		'7ff5f0ee2c4d4c83d6980a46efe31befca41f7aa8cda5f7b4c2850e4942d923af058561a6a3312005ddee566244346bdbccf004bc8e2c84e653f9825c20be008',
	signSignature: null,
	requesterPublicKey: null,
	signatures: null,
	asset: {}
};

describe('logic/transaction', function () {
	var instance, callback, clock, transactionRevert;

	beforeEach(function () {
		clock = sinon.useFakeTimers('setImmediate');
		callback = sinon.spy();
		transactionRevert = Transaction.__set__('setImmediate', setImmediate);
	});

	afterEach(function () {
		callback.reset();
		clock.restore();
		Transaction.__set__('__private', { types: {} });
		transactionRevert();
	});

	describe('when is imported', function () {
		it('should be a function', function () {
			expect(Transaction).to.be.a('function');
		});
	});

	describe('when is instantiated', function () {
		it('should initialize scope properly', function () {
			new Transaction(1, 2, 3, 4, 5, 6, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			instance = callback.args[0][1];
			expect(instance.scope.db).to.equal(1);
			expect(instance.scope.ed).to.equal(2);
			expect(instance.scope.schema).to.equal(3);
			expect(instance.scope.genesisblock).to.equal(4);
			expect(instance.scope.account).to.equal(5);
			expect(instance.scope.logger).to.equal(6);
		});

		it('without callback', function () {
			instance = new Transaction(1, 2, 3, 4, 5, 6);
			expect(callback.called).to.be.false;
			expect(instance.scope.db).to.equal(1);
			expect(instance.scope.ed).to.equal(2);
			expect(instance.scope.schema).to.equal(3);
			expect(instance.scope.genesisblock).to.equal(4);
			expect(instance.scope.account).to.equal(5);
			expect(instance.scope.logger).to.equal(6);
		});
	});

	describe('create()', function () {
		var getTimeSpy, vote, createStub, signStub, getIdStub, calculateFeeStub;

		beforeEach(function () {
			getTimeSpy = sinon.spy(slots, 'getTime');
			instance = new Transaction();
			vote = new Vote();
			createStub = sinon.stub(vote, 'create').callsFake(function (data, trs) {
				if (data.type === trs.type) {
					return trs;
				} else {
					return false;
				}
			});
			calculateFeeStub = sinon.stub(vote, 'calculateFee').returns(456);
			signStub = sinon.stub(instance, 'sign').callsFake(function (keypair, trs) {
				if (keypair && trs.type) {
					return true;
				} else {
					return false;
				}
			});
			getIdStub = sinon.stub(instance, 'getId').returns(123);
		});

		afterEach(function () {
			getTimeSpy.restore();
			createStub.restore();
			signStub.restore();
			getIdStub.restore();
			calculateFeeStub.restore();
		});

		it('Unknown transaction type', function () {
			expect(function () {
				instance.create({ type: 3 });
			}).to.throw('Unknown transaction type');
		});

		it('Invalid sender', function () {
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			expect(function () {
				instance.create({ type: 3 });
			}).to.throw('Invalid sender');
		});

		it('Invalid keypair', function () {
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			expect(function () {
				instance.create({ type: 3, sender: 123 });
			}).to.throw('Invalid keypair');
		});

		it('If secondSignature and secondKeypair are true', function () {
			var data;

			instance.attachAssetType(transactionTypes.VOTE, vote);
			data = {
				type: 3,
				sender: { publicKey: 123, secondSignature: true },
				secondKeypair: true,
				requester: {
					publicKey:
						'260933bee294713b75747a4cfd8f5501f134371a4efd08b243029eb056b393be'
				},
				keypair: senderKeypair
			};
			instance.create(data);
			expect(getTimeSpy.calledOnce).to.be.true;
			expect(createStub.calledOnce).to.be.true;
			expect(createStub.args[0][0]).to.deep.equal(data);
			expect(createStub.args[0][1].type).to.equal(transactionTypes.VOTE);
			expect(signStub.calledTwice).to.be.true;
			expect(signStub.args[0][0]).to.deep.equal(data.keypair);
			expect(signStub.args[0][1].type).to.equal(transactionTypes.VOTE);
			expect(signStub.args[1][0]).to.equal(data.secondKeypair);
			expect(signStub.args[1][1].type).to.equal(transactionTypes.VOTE);
			expect(getIdStub.calledOnce).to.be.true;
			expect(getIdStub.args[0][0].type).to.equal(transactionTypes.VOTE);
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0].type).to.equal(transactionTypes.VOTE);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(data.sender);
		});

		it('If secondSignature or secondKeypair are not true', function () {
			var data;

			instance.attachAssetType(transactionTypes.VOTE, vote);
			data = {
				type: 3,
				sender: { publicKey: 123, secondSignature: true },
				secondKeypair: false,
				requester: {
					publicKey:
						'260933bee294713b75747a4cfd8f5501f134371a4efd08b243029eb056b393be'
				},
				keypair: senderKeypair
			};
			instance.create(data);
			expect(getTimeSpy.calledOnce).to.be.true;
			expect(createStub.calledOnce).to.be.true;
			expect(createStub.args[0][0]).to.deep.equal(data);
			expect(createStub.args[0][1].type).to.equal(transactionTypes.VOTE);
			expect(signStub.calledOnce).to.be.true;
			expect(signStub.args[0][0]).to.deep.equal(data.keypair);
			expect(signStub.args[0][1].type).to.equal(transactionTypes.VOTE);
			expect(getIdStub.calledOnce).to.be.true;
			expect(getIdStub.args[0][0].type).to.equal(transactionTypes.VOTE);
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0].type).to.equal(transactionTypes.VOTE);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(data.sender);
		});
	});

	describe('attachAssetType', function () {
		var transactionInstance, instance;

		beforeEach(function () {
			transactionInstance = new Transaction();
			instance = {
				create: function () {},
				getBytes: function () {},
				calculateFee: function () {},
				verify: function () {},
				objectNormalize: function () {},
				dbRead: function () {},
				apply: function () {},
				undo: function () {},
				applyUnconfirmed: function () {},
				undoUnconfirmed: function () {},
				ready: function () {},
				process: function () {}
			};
		});

		it('If instance is false', function () {
			expect(function () {
				transactionInstance.attachAssetType(true);
			}).to.throw('Invalid instance interface');
		});

		it('create() is not a function', function () {
			delete instance.create;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('getBytes() is not a function', function () {
			delete instance.getBytes;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('calculateFee() is not a function', function () {
			delete instance.calculateFee;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('verify() is not a function', function () {
			delete instance.verify;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('objectNormalize() is not a function', function () {
			delete instance.objectNormalize;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('dbRead() is not a function', function () {
			delete instance.dbRead;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('apply() is not a function', function () {
			delete instance.apply;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('undo() is not a function', function () {
			delete instance.undo;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('applyUnconfirmed() is not a function', function () {
			delete instance.applyUnconfirmed;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('undoUnconfirmed() is not a function', function () {
			delete instance.undoUnconfirmed;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('ready() is not a function', function () {
			delete instance.ready;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('process() is not a function', function () {
			delete instance.process;
			expect(function () {
				transactionInstance.attachAssetType(true, instance);
			}).to.throw('Invalid instance interface');
		});

		it('success', function () {
			var delegateInstance = transactionInstance.attachAssetType(
				transactionTypes.DELEGATE,
				new Delegate()
			);
			expect(delegateInstance).to.be.instanceof(Delegate);
		});
	});

	describe('sign()', function () {
		var getHashSpy, signSpy;

		it('success', function () {
			instance = new Transaction(null, ed);
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			getHashSpy = sinon.spy(instance, 'getHash');
			signSpy = sinon.spy(instance.scope.ed, 'sign');
			var result = instance.sign(senderKeypair, validTransaction);
			expect(getHashSpy.calledOnce).to.be.true;
			expect(getHashSpy.args[0][0]).to.deep.equal(validTransaction);
			expect(signSpy.calledOnce).to.be.true;
			expect(signSpy.args[0][0]).to.be.instanceof(Buffer);
			expect(signSpy.args[0][1]).to.deep.equal(senderKeypair);
			expect(result).to.be.string;
			getHashSpy.restore();
			signSpy.restore();
		});
	});

	describe('multisign()', function () {
		var getBytesSpy, createHashSpy, signSpy;

		it('success', function () {
			instance = new Transaction(null, ed);
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			getBytesSpy = sinon.spy(instance, 'getBytes');
			createHashSpy = sinon.spy(crypto, 'createHash');
			signSpy = sinon.spy(instance.scope.ed, 'sign');
			var result = instance.multisign(senderKeypair, validTransaction);
			expect(getBytesSpy.calledOnce).to.be.true;
			expect(getBytesSpy.args[0][0]).to.deep.equal(validTransaction);
			expect(getBytesSpy.args[0][1]).to.be.true;
			expect(getBytesSpy.args[0][2]).to.be.true;
			expect(createHashSpy.calledOnce).to.be.true;
			expect(createHashSpy.args[0][0]).to.equal('sha256');
			expect(signSpy.calledOnce).to.be.true;
			expect(signSpy.args[0][0]).to.be.instanceof(Buffer);
			expect(signSpy.args[0][1]).to.deep.equal(senderKeypair);
			expect(result).to.be.string;
			getBytesSpy.restore();
			createHashSpy.restore();
			signSpy.restore();
		});
	});

	describe('getId', function () {
		var getHashSpy, fromBufferSpy, idresult;

		it('success', function () {
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			getHashSpy = sinon.spy(instance, 'getHash');
			fromBufferSpy = sinon.spy(bignum, 'fromBuffer');
			idresult = instance.getId(validTransaction);
			expect(idresult).to.be.a('string');
			expect(getHashSpy.calledOnce).to.be.true;
			expect(getHashSpy.args[0][0]).to.deep.equal(validTransaction);
			expect(fromBufferSpy.calledOnce).to.be.true;
			expect(fromBufferSpy.args[0][0]).to.be.instanceof(Buffer);
			getHashSpy.restore();
			fromBufferSpy.restore();
		});
	});

	describe('getHash()', function () {
		var createHashSpy, getBytesSpy, hashResult;

		it('success', function () {
			createHashSpy = sinon.spy(crypto, 'createHash');
			instance = new Transaction();
			getBytesSpy = sinon.spy(instance, 'getBytes');
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			hashResult = instance.getHash(validTransaction);
			expect(createHashSpy.calledOnce).to.be.true;
			expect(getBytesSpy.calledOnce).to.be.true;
			expect(hashResult).to.be.instanceof(Buffer);
			createHashSpy.restore();
			getBytesSpy.restore();
		});
	});

	describe('getBytes()', function () {
		var vote, result, getBytesSpy, bufferFromSpy;

		beforeEach(function () {
			vote = new Vote();
			getBytesSpy = sinon.spy(vote, 'getBytes');
			bufferFromSpy = sinon.spy(Buffer, 'from');
		});

		afterEach(function () {
			getBytesSpy.restore();
			bufferFromSpy.restore();
		});

		it('Unknown transaction type', function () {
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, vote);
			expect(function () {
				instance.getBytes({ type: transactionTypes.MULTI });
			}).to.throw('Unknown transaction type');
		});

		it('without requesterPublicKey and skipping Signature and SecondSignature', function () {
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, vote);
			result = instance.getBytes(validTransaction, true, true);
			expect(getBytesSpy.calledOnce).to.be.true;
			expect(bufferFromSpy.calledOnce).to.be.true;
			expect(bufferFromSpy.args[0][0]).to.be.equal(
				validTransaction.senderPublicKey
			);
			expect(bufferFromSpy.args[0][1]).to.be.equal('hex');
			expect(result).to.be.instanceof(Buffer);
		});

		it('with requesterPublicKey and skipping Signature and SecondSignature', function () {
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, vote);
			validTransaction.requesterPublicKey =
				'c094ebee7ec0c50ebee32918655e089f6e1a604b83bcaa760293c61e0f18ab6f';
			result = instance.getBytes(validTransaction, true, true);
			expect(getBytesSpy.calledOnce).to.be.true;
			expect(bufferFromSpy.calledTwice).to.be.true;
			expect(bufferFromSpy.args[0][0]).to.be.equal(
				validTransaction.senderPublicKey
			);
			expect(bufferFromSpy.args[0][1]).to.be.equal('hex');
			expect(bufferFromSpy.args[1][0]).to.be.equal(
				validTransaction.requesterPublicKey
			);
			expect(bufferFromSpy.args[1][1]).to.be.equal('hex');
			expect(result).to.be.instanceof(Buffer);
		});

		it('with requesterPublicKey and NOT skipping Signature and SecondSignature', function () {
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, vote);
			validTransaction.requesterPublicKey =
				'c094ebee7ec0c50ebee32918655e089f6e1a604b83bcaa760293c61e0f18ab6f';
			validTransaction.signSignature =
				'7ff5f0ee2c4d4c83d6980a46efe31befca41f7aa8cda5f7b4c2850e4942d923af058561a6a3312005ddee566244346bdbccf004bc8e2c84e653f9825c20be008';
			result = instance.getBytes(validTransaction, false, false);
			expect(getBytesSpy.calledOnce).to.be.true;
			expect(bufferFromSpy.callCount).to.equal(4);
			expect(bufferFromSpy.args[0][0]).to.be.equal(
				validTransaction.senderPublicKey
			);
			expect(bufferFromSpy.args[0][1]).to.be.equal('hex');
			expect(bufferFromSpy.args[1][0]).to.be.equal(
				validTransaction.requesterPublicKey
			);
			expect(bufferFromSpy.args[1][1]).to.be.equal('hex');
			expect(bufferFromSpy.args[2][0]).to.be.equal(validTransaction.signature);
			expect(bufferFromSpy.args[2][1]).to.be.equal('hex');
			expect(bufferFromSpy.args[3][0]).to.be.equal(
				validTransaction.signSignature
			);
			expect(bufferFromSpy.args[3][1]).to.be.equal('hex');
			expect(result).to.be.instanceof(Buffer);
		});
	});

	describe('ready()', function () {
		it('Unknown transaction type', function () {
			instance = new Transaction();
			validTransaction.type = transactionTypes.MULTI;
			expect(function () {
				instance.ready(validTransaction);
			}).to.throw('Unknown transaction type');
		});

		it('Without sender', function () {
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			validTransaction.type = transactionTypes.VOTE;
			var result = instance.ready(validTransaction);
			expect(result).to.be.false;
		});

		it('success', function () {
			instance = new Transaction();
			var vote = new Vote();
			var readySpy = sinon.spy(vote, 'ready');
			instance.attachAssetType(transactionTypes.VOTE, vote);
			validTransaction.type = transactionTypes.VOTE;
			instance.ready(validTransaction, true);
			expect(readySpy.calledOnce).to.be.true;
			readySpy.restore();
		});
	});

	describe('countById()', function () {
		var oneStub, scope, errorSpy;

		beforeEach(function () {
			clock.restore();
			transactionRevert();
			scope = {
				db: {
					one: function () {}
				},
				logger: {
					error: function (error) {}
				}
			};
			errorSpy = sinon.spy(scope.logger, 'error');

			instance = new Transaction();
			instance.scope = scope;
		});

		afterEach(function () {
			errorSpy.restore();
		});

		it('success', function (done) {
			oneStub = sinon.stub(scope.db, 'one').resolves({ count: 2 });
			instance.countById({ id: 123 }, callback);
			expect(oneStub.called).to.be.true;

			setTimeout(function () {
				setImmediate(function () {
					expect(callback.called).to.be.true;
					expect(callback.args[0][0]).to.equal(null);
					expect(callback.args[0][1]).to.equal(2);
					expect(errorSpy.called).to.be.false;
					oneStub.restore();
					done();
				});
			}, 0);
		});

		it('error', function (done) {
			oneStub = sinon.stub(scope.db, 'one').rejects();
			instance.countById({ id: 123 }, callback);
			expect(oneStub.called).to.be.true;

			setTimeout(function () {
				setImmediate(function () {
					expect(callback.called).to.be.true;
					expect(callback.args[0][0]).to.equal('Transaction#countById error');
					expect(errorSpy.called).to.be.true;
					oneStub.restore();
					done();
				});
			}, 0);
		});
	});

	describe('checkConfirmed()', function () {
		var oneStub, scope, errorSpy;

		beforeEach(function () {
			clock.restore();
			transactionRevert();
			scope = {
				db: {
					one: function () {}
				},
				logger: {
					error: function (error) {}
				}
			};
			errorSpy = sinon.spy(scope.logger, 'error');

			instance = new Transaction();
			instance.scope = scope;
		});

		it('error', function (done) {
			oneStub = sinon.stub(scope.db, 'one').rejects();
			instance.checkConfirmed({ id: 123 }, callback);

			setTimeout(function () {
				setImmediate(function () {
					setImmediate(function () {
						expect(callback.called).to.be.true;
						expect(callback.args[0][0]).to.equal('Transaction#countById error');
						expect(errorSpy.called).to.be.true;
						oneStub.restore();
						done();
					});
				});
			}, 0);
		});

		it('count > 0', function (done) {
			oneStub = sinon.stub(scope.db, 'one').resolves({ count: 1 });
			instance.checkConfirmed({ id: 123 }, callback);

			setTimeout(function () {
				setImmediate(function () {
					setImmediate(function () {
						expect(callback.called).to.be.true;
						expect(callback.args[0][0]).to.have.string(
							'Transaction is already confirmed: 123'
						);
						expect(errorSpy.called).to.be.false;
						oneStub.restore();
						done();
					});
				});
			}, 0);
		});

		it('count <= 0', function (done) {
			oneStub = sinon.stub(scope.db, 'one').resolves({ count: 0 });
			instance.checkConfirmed({ id: 123 }, callback);

			setTimeout(function () {
				setImmediate(function () {
					setImmediate(function () {
						expect(callback.called).to.be.true;
						expect(callback.args[0][0]).to.equal(undefined);
						expect(errorSpy.called).to.be.false;
						oneStub.restore();
						done();
					});
				});
			}, 0);
		});
	});

	describe('checkBalance()', function () {
		var amount, balance, trs, sender, scope, result;

		beforeEach(function () {
			balance = 'abc';
			trs = { blockId: 456 };
			sender = { abc: 1000, address: '123R' };
			scope = { genesisblock: { block: { id: 123 } } };
			instance = new Transaction();
			instance.scope = scope;
		});

		it('If exceeded', function () {
			amount = 1001;
			result = instance.checkBalance(amount, balance, trs, sender);
			expect(result).to.deep.equal({
				exceeded: true,
				error: 'Account does not have enough RISE: 123R balance: 0.00001'
			});
		});

		it('If exceeded but blockId are equals', function () {
			amount = 1001;
			trs = { blockId: 123 };
			scope = { genesisblock: { block: { id: 123 } } };
			result = instance.checkBalance(amount, balance, trs, sender);
			expect(result).to.deep.equal({ exceeded: false, error: null });
		});

		it('If NOT exceeded', function () {
			amount = 999;
			result = instance.checkBalance(amount, balance, trs, sender);
			expect(result).to.deep.equal({ exceeded: false, error: null });
		});
	});

	describe('process()', function () {
		var trs, instance, getIdStub, scope, errorSpy;

		beforeEach(function () {
			trs = { id: '123', type: transactionTypes.VOTE };
			instance = new Transaction();
			scope = {
				logger: {
					error: function () {}
				}
			};
			errorSpy = sinon.spy(scope.logger, 'error');
			instance.scope = scope;
		});

		afterEach(function () {
			errorSpy.restore();
		});

		it('Unknown transaction type', function () {
			instance.process(trs, false, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Unknown transaction type');
		});

		it('Missing sender', function () {
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			instance.process(trs, false, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Missing sender');
		});

		it('Failed to get transaction id', function () {
			getIdStub = sinon.stub(instance, 'getId').throws();
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			instance.process(trs, true, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Failed to get transaction id'
			);
			expect(errorSpy.calledOnce).to.be.true;
			getIdStub.restore();
		});

		it('Invalid transaction id', function () {
			getIdStub = sinon.stub(instance, 'getId').returns('456');
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			instance.process(trs, true, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction id');
			expect(errorSpy.calledOnce).to.be.false;
			getIdStub.restore();
		});

		it('error', function () {
			var vote;
			vote = new Vote();
			var processStub = sinon
				.stub(vote, 'process')
				.callsFake(function (trs, sender, cb) {
					setImmediate(cb, 'fakeError');
				});
			getIdStub = sinon.stub(instance, 'getId').returns('123');
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.process(trs, true, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('fakeError');
			expect(errorSpy.calledOnce).to.be.false;
			getIdStub.restore();
			processStub.restore();
		});

		it('success', function () {
			var vote;
			vote = new Vote();
			var processStub = sinon
				.stub(vote, 'process')
				.callsFake(function (trs, sender, cb) {
					setImmediate(cb, null, { success: true });
				});
			getIdStub = sinon.stub(instance, 'getId').returns('123');
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.process(trs, true, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(null);
			expect(callback.args[0][1]).to.deep.equal({ success: true });
			expect(errorSpy.calledOnce).to.be.false;
			getIdStub.restore();
			processStub.restore();
		});
	});

	describe('verify()', function () {

		var instance, scope, requesterRevert, debugSpy, errorSpy, vote;

		beforeEach(function () {
			requesterRevert = Transaction.__set__('requester', {
				secondSignature: true
			});
			scope = {
				genesisblock: { block: { id: 456 } },
				logger: {
					debug: function () {},
					error: function () {

					}
				}
			};
			debugSpy = sinon.spy(scope.logger, 'debug');
			errorSpy = sinon.spy(scope.logger, 'error');
			instance = new Transaction();
			instance.scope = scope;
			vote = new Vote();
			instance.attachAssetType(transactionTypes.VOTE, vote);
		});

		afterEach(function () {
			requesterRevert();
			debugSpy.restore();
			errorSpy.restore();
		});

		it('Missing sender', function () {
			instance.verify(false, false, false, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Missing sender');
		});

		it('Unknown transaction type', function () {
			Transaction.__set__('__private', { types: {} });
			instance.verify({ type: transactionTypes.VOTE }, true, false, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Unknown transaction type');
		});

		it('Missing sender second signature', function () {
			instance.verify(
				{ type: transactionTypes.VOTE, blockId: 123 },
				{ secondSignature: true },
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Missing sender second signature'
			);
		});

		it('Sender does not have a second signature', function () {
			instance.verify(
				{ type: transactionTypes.VOTE, blockId: 123, signSignature: 'abc' },
				{ secondSignature: false },
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Sender does not have a second signature'
			);
		});

		it('Missing requester second signature', function () {
			instance.verify(
				{
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: false,
					requesterPublicKey: true
				},
				{ secondSignature: false },
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Missing requester second signature'
			);
		});

		it('Requester does not have a second signature', function () {
			requesterRevert = Transaction.__set__('requester', {
				secondSignature: false
			});
			instance.verify(
				{
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: true
				},
				{ secondSignature: false },
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Requester does not have a second signature'
			);
		});

		it('Invalid sender public key: Calling to callback', function () {
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: true,
					senderPublicKey: '123'
				},
				{ secondSignature: false, publicKey: '456' },
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Invalid sender public key: 123 expected: 456'
			);
			expect(debugSpy.called).to.be.false;
		});

		it('Invalid sender. Can not send from genesis account', function () {
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: true,
					senderPublicKey:
						'3c4bd532ef8a90c0105f1b21458abf652b1e7ca100f664c39a3bbfc2e682efef'
				},
				{
					secondSignature: false,
					publicKey:
						'3c4bd532ef8a90c0105f1b21458abf652b1e7ca100f664c39a3bbfc2e682efef'
				},
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Invalid sender. Can not send from genesis account'
			);
			expect(debugSpy.called).to.be.false;
		});

		it('Invalid sender address', function () {
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: true,
					senderPublicKey: '12345678',
					senderId: 'abcdefg'
				},
				{
					secondSignature: false,
					publicKey: '12345678',
					address: '123abcdefg'
				},
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid sender address');
			expect(debugSpy.called).to.be.false;
		});

		it('Invalid member in keysgroup', function () {
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: true,
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {multisignature: {
						keysgroup: [1,2,3]
					}}
				},
				{
					secondSignature: false,
					publicKey: '12345678',
					address: '123R',
					multisignatures: [],
					u_multisignatures: []
				},
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid member in keysgroup');
			expect(debugSpy.called).to.be.false;
		});

		it('Account does not belong to multisignature group', function () {
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {multisignature: {
						keysgroup: ['1','2','3']
					}}
				},
				{
					secondSignature: false,
					publicKey: '12345678',
					address: '123R',
					multisignatures: [],
					u_multisignatures: []
				},
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Account does not belong to multisignature group');
			expect(debugSpy.called).to.be.false;
		});

		it('Verify signature throws error', function () {
			var verifySignatureStub = sinon.stub(instance, 'verifySignature').throws('fakeError');
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {multisignature: {
						keysgroup: ['AAA','BBB','CCC']
					}}
				},
				{
					secondSignature: false,
					publicKey: '12345678',
					address: '123R',
					multisignatures: ['ABC'],
					u_multisignatures: []
				},
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('fakeError');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.true;
			expect(verifySignatureStub.calledOnce).to.be.true;
			verifySignatureStub.restore();
		});

		it('Failed to verify signature: Call to callback', function () {
			var verifySignatureStub = sinon.stub(instance, 'verifySignature').returns(false);
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {multisignature: {
						keysgroup: ['AAA','BBB','CCC']
					}}
				},
				{
					secondSignature: false,
					publicKey: '12345678',
					address: '123R',
					multisignatures: ['ABC'],
					u_multisignatures: []
				},
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Failed to verify signature');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.calledOnce).to.be.true;
			verifySignatureStub.restore();
		});

		it('Verify second signature throws error', function () {
			var verifySignatureStub = sinon.stub(instance, 'verifySignature').returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').throws('fakeError2');
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {multisignature: {
						keysgroup: ['AAA','BBB','CCC']
					}}
				},
				{
					secondSignature: true,
					publicKey: '12345678',
					address: '123R',
					multisignatures: ['ABC'],
					u_multisignatures: []
				},
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('fakeError2');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.calledOnce).to.be.true;
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
		});

		it('Failed to verify second signature', function () {
			var verifySignatureStub = sinon.stub(instance, 'verifySignature').returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(false);
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {multisignature: {
						keysgroup: ['AAA','BBB','CCC']
					}}
				},
				{
					secondSignature: true,
					publicKey: '12345678',
					address: '123R',
					multisignatures: ['ABC'],
					u_multisignatures: []
				},
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Failed to verify second signature');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.calledOnce).to.be.true;
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
		});

		it('Encountered duplicate signature in transaction', function () {
			var verifySignatureStub = sinon.stub(instance, 'verifySignature').returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {multisignature: {
						keysgroup: ['AAA','BBB','CCC']
					}},
					signatures: ['a','b','c','b','c']
				},
				{
					secondSignature: true,
					publicKey: '12345678',
					address: '123R',
					multisignatures: ['ABC'],
					u_multisignatures: []
				},
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Encountered duplicate signature in transaction');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.calledOnce).to.be.true;
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
		});

		it('Failed to verify multisignature', function () {
			var verifySignatureStub = sinon.stub(instance, 'verifySignature');
			verifySignatureStub.onFirstCall().returns(true);
			verifySignatureStub.returns(false);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {multisignature: {
						keysgroup: ['AAA','BBB','CCC']
					}},
					signatures: ['a','b','c','d']
				},
				{
					secondSignature: true,
					publicKey: '12345678',
					address: '123R',
					multisignatures: ['ABC'],
					u_multisignatures: []
				},
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Failed to verify multisignature');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.calledTwice).to.be.true;
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
		});

		it('Invalid transaction fee', function () {
			var calculateFeeStub = sinon.stub(vote, 'calculateFee').returns(false);
			var verifySignatureStub = sinon.stub(instance, 'verifySignature');
			verifySignatureStub.returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {multisignature: {
					keysgroup: ['AAA','BBB','CCC']
				}},
				signatures: ['a','b','c','d'],
				fee: 123
			};
			var sender = {
				secondSignature: true,
				publicKey: '12345678',
				address: '123R',
				multisignatures: ['ABC'],
				u_multisignatures: []
			};
			instance.verify(
				trs,
				sender,
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction fee');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.callCount).to.equal(5);
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0]).to.deep.equal(trs);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(sender);
			expect(calculateFeeStub.args[0][2]).to.deep.equal(false);
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
			calculateFeeStub.restore();
		});

		it('Amount is less than zero', function () {
			var calculateFeeStub = sinon.stub(vote, 'calculateFee').returns(50);
			var verifySignatureStub = sinon.stub(instance, 'verifySignature');
			verifySignatureStub.returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {multisignature: {
					keysgroup: ['AAA','BBB','CCC']
				}},
				signatures: ['a','b','c','d'],
				fee: 50,
				amount: -1
			};
			var sender = {
				secondSignature: true,
				publicKey: '12345678',
				address: '123R',
				multisignatures: ['ABC'],
				u_multisignatures: []
			};
			instance.verify(
				trs,
				sender,
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction amount');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.callCount).to.equal(5);
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0]).to.deep.equal(trs);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(sender);
			expect(calculateFeeStub.args[0][2]).to.deep.equal(false);
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
			calculateFeeStub.restore();
		});

		it('Amount is greater than constants.totalAmount', function () {
			var calculateFeeStub = sinon.stub(vote, 'calculateFee').returns(50);
			var verifySignatureStub = sinon.stub(instance, 'verifySignature');
			verifySignatureStub.returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			var amount = constants.totalAmount + 10;
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {multisignature: {
					keysgroup: ['AAA','BBB','CCC']
				}},
				signatures: ['a','b','c','d'],
				fee: 50,
				amount: amount
			};
			var sender = {
				secondSignature: true,
				publicKey: '12345678',
				address: '123R',
				multisignatures: ['ABC'],
				u_multisignatures: []
			};
			instance.verify(
				trs,
				sender,
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction amount');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.callCount).to.equal(5);
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0]).to.deep.equal(trs);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(sender);
			expect(calculateFeeStub.args[0][2]).to.deep.equal(false);
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
			calculateFeeStub.restore();
		});

		it('Amount contains dots', function () {
			var calculateFeeStub = sinon.stub(vote, 'calculateFee').returns(50);
			var verifySignatureStub = sinon.stub(instance, 'verifySignature');
			verifySignatureStub.returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {multisignature: {
					keysgroup: ['AAA','BBB','CCC']
				}},
				signatures: ['a','b','c','d'],
				fee: 50,
				amount: 123.45
			};
			var sender = {
				secondSignature: true,
				publicKey: '12345678',
				address: '123R',
				multisignatures: ['ABC'],
				u_multisignatures: []
			};
			instance.verify(
				trs,
				sender,
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction amount');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.callCount).to.equal(5);
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0]).to.deep.equal(trs);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(sender);
			expect(calculateFeeStub.args[0][2]).to.deep.equal(false);
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
			calculateFeeStub.restore();
		});

		it('Amount contains scientific notation', function () {
			var calculateFeeStub = sinon.stub(vote, 'calculateFee').returns(50);
			var verifySignatureStub = sinon.stub(instance, 'verifySignature');
			verifySignatureStub.returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {multisignature: {
					keysgroup: ['AAA','BBB','CCC']
				}},
				signatures: ['a','b','c','d'],
				fee: 50,
				amount: '123e10'
			};
			var sender = {
				secondSignature: true,
				publicKey: '12345678',
				address: '123R',
				multisignatures: ['ABC'],
				u_multisignatures: []
			};
			instance.verify(
				trs,
				sender,
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction amount');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.callCount).to.equal(5);
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0]).to.deep.equal(trs);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(sender);
			expect(calculateFeeStub.args[0][2]).to.deep.equal(false);
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
			calculateFeeStub.restore();
		});

		it('Sender balance error', function () {
			var calculateFeeStub = sinon.stub(vote, 'calculateFee').returns(50);
			var verifySignatureStub = sinon.stub(instance, 'verifySignature');
			verifySignatureStub.returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {multisignature: {
					keysgroup: ['AAA','BBB','CCC']
				}},
				signatures: ['a','b','c','d'],
				fee: 50,
				amount: '100'
			};
			var sender = {
				secondSignature: true,
				publicKey: '12345678',
				address: '123R',
				multisignatures: ['ABC'],
				u_multisignatures: [],
				balance: 149
			};
			instance.verify(
				trs,
				sender,
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Account does not have enough RISE: 123R balance: 0.00000149');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.callCount).to.equal(5);
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0]).to.deep.equal(trs);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(sender);
			expect(calculateFeeStub.args[0][2]).to.deep.equal(false);
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
			calculateFeeStub.restore();
		});

		it('Invalid transaction timestamp. Timestamp is in the future', function () {
			var calculateFeeStub = sinon.stub(vote, 'calculateFee').returns(50);
			var verifySignatureStub = sinon.stub(instance, 'verifySignature');
			verifySignatureStub.returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			var transactionTimestamp = ((Date.now()/1000)-(constants.epochTime.getTime()/1000)) + 1000;
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {multisignature: {
					keysgroup: ['AAA','BBB','CCC']
				}},
				signatures: ['a','b','c','d'],
				fee: 50,
				amount: '100',
				timestamp: transactionTimestamp
			};
			var sender = {
				secondSignature: true,
				publicKey: '12345678',
				address: '123R',
				multisignatures: ['ABC'],
				u_multisignatures: [],
				balance: 151
			};
			instance.verify(
				trs,
				sender,
				false,
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction timestamp. Timestamp is in the future');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.callCount).to.equal(5);
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0]).to.deep.equal(trs);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(sender);
			expect(calculateFeeStub.args[0][2]).to.deep.equal(false);
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
			calculateFeeStub.restore();
		});

		it('verify() call from transaction type returns error', function () {
			var calculateFeeStub = sinon.stub(vote, 'calculateFee').returns(50);
			var verifyStub = sinon.stub(vote, 'verify').callsFake(function (trs, sender, cb) {
				setImmediate(cb, 'verifyError');
			});
			var verifySignatureStub = sinon.stub(instance, 'verifySignature');
			verifySignatureStub.returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			var transactionTimestamp = ((Date.now()/1000)-(constants.epochTime.getTime()/1000)) - 1000;
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {multisignature: {
					keysgroup: ['AAA','BBB','CCC']
				}},
				signatures: ['a','b','c','d'],
				fee: 50,
				amount: '100',
				timestamp: transactionTimestamp
			};
			var sender = {
				secondSignature: true,
				publicKey: '12345678',
				address: '123R',
				multisignatures: ['ABC'],
				u_multisignatures: [],
				balance: 151
			};
			instance.verify(
				trs,
				sender,
				false,
				callback
			);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('verifyError');
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.callCount).to.equal(5);
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0]).to.deep.equal(trs);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(sender);
			expect(calculateFeeStub.args[0][2]).to.deep.equal(false);
			expect(verifyStub.calledOnce).to.be.true;
			expect(verifyStub.args[0][0]).to.deep.equal(trs);
			expect(verifyStub.args[0][1]).to.deep.equal(sender);
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
			calculateFeeStub.restore();
			verifyStub.restore();
		});

		it('Success', function () {
			var checkConfirmedStub = sinon.stub(instance, 'checkConfirmed').callsFake(function (trs, cb) {
				setImmediate(cb);
			});
			var calculateFeeStub = sinon.stub(vote, 'calculateFee').returns(50);
			var verifyStub = sinon.stub(vote, 'verify').callsFake(function (trs, sender, cb) {
				setImmediate(cb);
			});
			var verifySignatureStub = sinon.stub(instance, 'verifySignature');
			verifySignatureStub.returns(true);
			var verifySecondSignatureStub = sinon.stub(instance, 'verifySecondSignature').returns(true);
			var transactionTimestamp = ((Date.now()/1000)-(constants.epochTime.getTime()/1000)) - 1000;
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {multisignature: {
					keysgroup: ['AAA','BBB','CCC']
				}},
				signatures: ['a','b','c','d'],
				fee: 50,
				amount: '100',
				timestamp: transactionTimestamp
			};
			var sender = {
				secondSignature: true,
				publicKey: '12345678',
				address: '123R',
				multisignatures: ['ABC'],
				u_multisignatures: [],
				balance: 151
			};
			instance.verify(
				trs,
				sender,
				false,
				callback
			);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(undefined);
			expect(debugSpy.called).to.be.false;
			expect(errorSpy.called).to.be.false;
			expect(verifySignatureStub.callCount).to.equal(5);
			expect(verifySecondSignatureStub.calledOnce).to.be.true;
			expect(calculateFeeStub.calledOnce).to.be.true;
			expect(calculateFeeStub.args[0][0]).to.deep.equal(trs);
			expect(calculateFeeStub.args[0][1]).to.deep.equal(sender);
			expect(calculateFeeStub.args[0][2]).to.deep.equal(false);
			expect(verifyStub.calledOnce).to.be.true;
			expect(verifyStub.args[0][0]).to.deep.equal(trs);
			expect(verifyStub.args[0][1]).to.deep.equal(sender);
			expect(checkConfirmedStub.calledOnce).to.be.true;
			expect(checkConfirmedStub.args[0][0]).to.deep.equal(trs);
			verifySignatureStub.restore();
			verifySecondSignatureStub.restore();
			calculateFeeStub.restore();
			verifyStub.restore();
			checkConfirmedStub.restore();
		});
	});

	describe('verifySignature()', function () {});
	describe('verifySecondSignature()', function () {});
	describe('verifyBytes()', function () {});
	describe('apply()', function () {});
	describe('undo()', function () {});
	describe('applyUnconfirmed()', function () {});
	describe('undoUnconfirmed()', function () {});
	describe('dbSave()', function () {});
	describe('afterSave()', function () {});
	describe('objectNormalize()', function () {});
	describe('dbRead()', function () {});
	describe('bindModules()', function () {});
});
