var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var rewire = require('rewire');
var Transaction = rewire('../../../logic/transaction');
var transactionTypes = require('../../../helpers/transactionTypes');
var Vote = require('../../../logic/vote');
var Delegate = require('../../../logic/delegate');
var Dapp = require('../../../logic/dapp');
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
	var sandbox, instance, callback, transactionRevert, scope;

	before(function () {
		sandbox = sinon.sandbox.create({
			injectInto: null,
			properties: ['spy', 'stub', 'clock'],
			useFakeTimers: true,
			useFakeServer: false
		});

		scope = {
			db: {
				one: function () {}
			},
			logger: {
				debug: function () {},
				error: function (error) {},
				trace: function () {}
			},
			genesisblock: { block: { id: 0 } },
			ed: ed,
			account: {
				merge: function (address, diff, cb) {}
			},
			schema: {
				validate: function () {},
				getLastErrors: function () {
					return [{ message: 'foo #1' }, { message: 'foo #2' }];
				}
			}
		};

		sandbox.spy(scope.logger, 'debug');
		sandbox.spy(scope.logger, 'error');
		sandbox.spy(scope.logger, 'trace');
		sandbox.stub(scope.db, 'one');
		sandbox.stub(scope.ed, 'verify');
		sandbox.stub(scope.account, 'merge');
		sandbox.stub(scope.schema, 'validate');

		transactionRevert = Transaction.__set__('setImmediate', setImmediate);
		callback = sandbox.spy();
		sandbox.spy(slots, 'getTime');
		sandbox.spy(Buffer, 'from');
		sandbox.spy(ed, 'sign');
		sandbox.spy(crypto, 'createHash');
	});

	beforeEach(function () {});

	afterEach(function () {
		sandbox.reset();
		callback.reset();
		Transaction.__set__('__private', { types: {} });
	});

	after(function () {
		sandbox.restore();
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
			sandbox.clock.tick();
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
		var vote;

		beforeEach(function () {
			instance = new Transaction();
			vote = new Vote();
			sandbox.stub(vote, 'create').callsFake(function (data, trs) {
				if (data.type === trs.type) {
					return trs;
				} else {
					return false;
				}
			});
			sandbox.stub(vote, 'calculateFee').returns(456);
			sandbox.stub(instance, 'sign').callsFake(function (keypair, trs) {
				if (keypair && trs.type) {
					return true;
				} else {
					return false;
				}
			});
			sandbox.stub(instance, 'getId').returns(123);
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
			expect(slots.getTime.calledOnce).to.be.true;
			expect(vote.create.calledOnce).to.be.true;
			expect(vote.create.args[0][0]).to.deep.equal(data);
			expect(vote.create.args[0][1].type).to.equal(transactionTypes.VOTE);
			expect(instance.sign.calledTwice).to.be.true;
			expect(instance.sign.args[0][0]).to.deep.equal(data.keypair);
			expect(instance.sign.args[0][1].type).to.equal(transactionTypes.VOTE);
			expect(instance.sign.args[1][0]).to.equal(data.secondKeypair);
			expect(instance.sign.args[1][1].type).to.equal(transactionTypes.VOTE);
			expect(instance.getId.calledOnce).to.be.true;
			expect(instance.getId.args[0][0].type).to.equal(transactionTypes.VOTE);
			expect(vote.calculateFee.calledOnce).to.be.true;
			expect(vote.calculateFee.args[0][0].type).to.equal(transactionTypes.VOTE);
			expect(vote.calculateFee.args[0][1]).to.deep.equal(data.sender);
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
			expect(slots.getTime.calledOnce).to.be.true;
			expect(vote.create.calledOnce).to.be.true;
			expect(vote.create.args[0][0]).to.deep.equal(data);
			expect(vote.create.args[0][1].type).to.equal(transactionTypes.VOTE);
			expect(instance.sign.calledOnce).to.be.true;
			expect(instance.sign.args[0][0]).to.deep.equal(data.keypair);
			expect(instance.sign.args[0][1].type).to.equal(transactionTypes.VOTE);
			expect(instance.getId.calledOnce).to.be.true;
			expect(instance.getId.args[0][0].type).to.equal(transactionTypes.VOTE);
			expect(vote.calculateFee.calledOnce).to.be.true;
			expect(vote.calculateFee.args[0][0].type).to.equal(transactionTypes.VOTE);
			expect(vote.calculateFee.args[0][1]).to.deep.equal(data.sender);
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
		it('success', function () {
			instance = new Transaction(null, ed);
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			sandbox.spy(instance, 'getHash');
			var result = instance.sign(senderKeypair, validTransaction);
			expect(instance.getHash.calledOnce).to.be.true;
			expect(instance.getHash.args[0][0]).to.deep.equal(validTransaction);
			expect(instance.scope.ed.sign.calledOnce).to.be.true;
			expect(instance.scope.ed.sign.args[0][0]).to.be.instanceof(Buffer);
			expect(instance.scope.ed.sign.args[0][1]).to.deep.equal(senderKeypair);
			expect(result).to.be.a('string');
		});
	});

	describe('multisign()', function () {
		it('success', function () {
			instance = new Transaction(null, ed);
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			sandbox.spy(instance, 'getBytes');
			var result = instance.multisign(senderKeypair, validTransaction);
			expect(instance.getBytes.calledOnce).to.be.true;
			expect(instance.getBytes.args[0][0]).to.deep.equal(validTransaction);
			expect(instance.getBytes.args[0][1]).to.be.true;
			expect(instance.getBytes.args[0][2]).to.be.true;
			expect(crypto.createHash.calledOnce).to.be.true;
			expect(crypto.createHash.args[0][0]).to.equal('sha256');
			expect(instance.scope.ed.sign.calledOnce).to.be.true;
			expect(instance.scope.ed.sign.args[0][0]).to.be.instanceof(Buffer);
			expect(instance.scope.ed.sign.args[0][1]).to.deep.equal(senderKeypair);
			expect(result).to.be.a('string');
		});
	});

	describe('getId', function () {
		it('success', function () {
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			sandbox.spy(instance, 'getHash');
			sandbox.spy(bignum, 'fromBuffer');
			var idresult = instance.getId(validTransaction);
			expect(idresult).to.be.a('string');
			expect(instance.getHash.calledOnce).to.be.true;
			expect(instance.getHash.args[0][0]).to.deep.equal(validTransaction);
			expect(bignum.fromBuffer.calledOnce).to.be.true;
			expect(bignum.fromBuffer.args[0][0]).to.be.instanceof(Buffer);
		});
	});

	describe('getHash()', function () {
		it('success', function () {
			instance = new Transaction();
			sandbox.spy(instance, 'getBytes');
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			var hashResult = instance.getHash(validTransaction);
			expect(crypto.createHash.calledOnce).to.be.true;
			expect(instance.getBytes.calledOnce).to.be.true;
			expect(hashResult).to.be.instanceof(Buffer);
		});
	});

	describe('getBytes()', function () {
		var vote, result;

		beforeEach(function () {
			vote = new Vote();
			sandbox.spy(vote, 'getBytes');
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
			expect(vote.getBytes.calledOnce).to.be.true;
			expect(Buffer.from.calledOnce).to.be.true;
			expect(Buffer.from.args[0][0]).to.be.equal(
				validTransaction.senderPublicKey
			);
			expect(Buffer.from.args[0][1]).to.be.equal('hex');
			expect(result).to.be.instanceof(Buffer);
		});

		it('with requesterPublicKey and skipping Signature and SecondSignature', function () {
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, vote);
			validTransaction.requesterPublicKey =
				'c094ebee7ec0c50ebee32918655e089f6e1a604b83bcaa760293c61e0f18ab6f';
			result = instance.getBytes(validTransaction, true, true);
			expect(vote.getBytes.calledOnce).to.be.true;
			expect(Buffer.from.calledTwice).to.be.true;
			expect(Buffer.from.args[0][0]).to.be.equal(
				validTransaction.senderPublicKey
			);
			expect(Buffer.from.args[0][1]).to.be.equal('hex');
			expect(Buffer.from.args[1][0]).to.be.equal(
				validTransaction.requesterPublicKey
			);
			expect(Buffer.from.args[1][1]).to.be.equal('hex');
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
			expect(vote.getBytes.calledOnce).to.be.true;
			expect(Buffer.from.callCount).to.equal(4);
			expect(Buffer.from.args[0][0]).to.be.equal(
				validTransaction.senderPublicKey
			);
			expect(Buffer.from.args[0][1]).to.be.equal('hex');
			expect(Buffer.from.args[1][0]).to.be.equal(
				validTransaction.requesterPublicKey
			);
			expect(Buffer.from.args[1][1]).to.be.equal('hex');
			expect(Buffer.from.args[2][0]).to.be.equal(validTransaction.signature);
			expect(Buffer.from.args[2][1]).to.be.equal('hex');
			expect(Buffer.from.args[3][0]).to.be.equal(
				validTransaction.signSignature
			);
			expect(Buffer.from.args[3][1]).to.be.equal('hex');
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
			sandbox.spy(vote, 'ready');
			instance.attachAssetType(transactionTypes.VOTE, vote);
			validTransaction.type = transactionTypes.VOTE;
			instance.ready(validTransaction, true);
			expect(vote.ready.calledOnce).to.be.true;
		});
	});

	describe('countById()', function () {
		beforeEach(function () {
			instance = new Transaction();
			instance.scope = scope;
		});

		it('success', function () {
			instance.scope.db.one.resolves({ count: 2 });
			instance.countById({ id: 123 }, callback);
			expect(instance.scope.db.one.called).to.be.true;

			return Promise.resolve().then(function () {
				sandbox.clock.tick();
				expect(callback.called).to.be.true;
				expect(callback.args[0][0]).to.equal(null);
				expect(callback.args[0][1]).to.equal(2);
				expect(scope.logger.error.called).to.be.false;
			});
		});

		it('error', function () {
			instance.scope.db.one.rejects('abc');
			instance.countById({ id: 123 }, callback);
			expect(instance.scope.db.one.called).to.be.true;

			return Promise.reject()
				.then(function () {})
				.catch(function (error) {
					sandbox.clock.tick();
					expect(callback.called).to.be.true;
					expect(callback.args[0][0]).to.equal('Transaction#countById error');
					expect(instance.scope.logger.error.called).to.be.true;
				});
		});
	});

	describe('checkConfirmed()', function () {
		beforeEach(function () {
			instance = new Transaction();
			instance.scope = scope;
		});

		it('error', function () {
			instance.scope.db.one.rejects();
			instance.checkConfirmed({ id: 123 }, callback);
			return Promise.reject()
				.then(function (response) {})
				.catch(function (error) {
					sandbox.clock.runAll();
					expect(callback.called).to.be.true;
					expect(callback.args[0][0]).to.equal('Transaction#countById error');
					expect(instance.scope.logger.error.called).to.be.true;
				});
		});

		it('count > 0', function () {
			instance.scope.db.one.resolves({ count: 1 });
			instance.checkConfirmed({ id: 123 }, callback);
			return Promise.resolve().then(function (response) {
				sandbox.clock.runAll();
				expect(callback.called).to.be.true;
				expect(callback.args[0][0]).to.have.string(
					'Transaction is already confirmed: 123'
				);
				expect(instance.scope.logger.error.called).to.be.false;
			});
		});

		it('count <= 0', function () {
			instance.scope.db.one.resolves({ count: 0 });
			instance.checkConfirmed({ id: 123 }, callback);

			return Promise.resolve().then(function (response) {
				sandbox.clock.runAll();
				expect(callback.called).to.be.true;
				expect(callback.args[0][0]).to.equal(undefined);
				expect(instance.scope.logger.error.called).to.be.false;
			});
		});
	});

	describe('checkBalance()', function () {
		var amount, balance, trs, sender, result;

		beforeEach(function () {
			balance = 'abc';
			trs = { blockId: 456 };
			sender = { abc: 1000, address: '123R' };
			instance = new Transaction();
			instance.scope = scope;
			instance.scope.genesisblock.block.id = 123;
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
		var trs, instance;

		beforeEach(function () {
			trs = { id: '123', type: transactionTypes.VOTE };
			instance = new Transaction();
			instance.scope = scope;
		});

		it('Unknown transaction type', function () {
			instance.process(trs, false, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Unknown transaction type');
		});

		it('Missing sender', function () {
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			instance.process(trs, false, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Missing sender');
		});

		it('Failed to get transaction id', function () {
			sandbox.stub(instance, 'getId').throws();
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			instance.process(trs, true, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Failed to get transaction id'
			);
			expect(instance.scope.logger.error.calledOnce).to.be.true;
		});

		it('Invalid transaction id', function () {
			sandbox.stub(instance, 'getId').returns('456');
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			instance.process(trs, true, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction id');
			expect(instance.scope.logger.error.calledOnce).to.be.false;
		});

		it('error', function () {
			var vote;
			vote = new Vote();
			sandbox.stub(vote, 'process').callsFake(function (trs, sender, cb) {
				setImmediate(cb, 'fakeError');
			});
			sandbox.stub(instance, 'getId').returns('123');
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.process(trs, true, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('fakeError');
			expect(instance.scope.logger.error.calledOnce).to.be.false;
		});

		it('success', function () {
			var vote;
			vote = new Vote();
			sandbox.stub(vote, 'process').callsFake(function (trs, sender, cb) {
				setImmediate(cb, null, { success: true });
			});
			sandbox.stub(instance, 'getId').returns('123');
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.process(trs, true, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(null);
			expect(callback.args[0][1]).to.deep.equal({ success: true });
			expect(instance.scope.logger.error.calledOnce).to.be.false;
		});
	});

	describe('verify()', function () {
		var requesterRevert, vote;

		beforeEach(function () {
			requesterRevert = Transaction.__set__('requester', {
				secondSignature: true
			});
			instance = new Transaction();
			instance.scope = scope;
			instance.scope.genesisblock.block.id = 456;
			vote = new Vote();
			instance.attachAssetType(transactionTypes.VOTE, vote);
		});

		afterEach(function () {
			requesterRevert();
		});

		it('Success', function () {
			sandbox.stub(instance, 'checkConfirmed').callsFake(function (trs, cb) {
				setImmediate(cb);
			});
			sandbox.stub(vote, 'calculateFee').returns(50);
			sandbox.stub(vote, 'verify').callsFake(function (trs, sender, cb) {
				setImmediate(cb);
			});
			sandbox.stub(instance, 'verifySignature').returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			var transactionTimestamp =
				Date.now() / 1000 - constants.epochTime.getTime() / 1000 - 1000;
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {
					multisignature: {
						keysgroup: ['AAA', 'BBB', 'CCC']
					}
				},
				signatures: ['a', 'b', 'c', 'd'],
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
			instance.verify(trs, sender, false, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(undefined);
			expect(instance.scope.logger.debug.called).to.be.false;
			expect(instance.scope.logger.error.called).to.be.false;
			expect(instance.verifySignature.callCount).to.equal(5);
			expect(instance.verifySecondSignature.calledOnce).to.be.true;
			expect(vote.calculateFee.calledOnce).to.be.true;
			expect(vote.calculateFee.args[0][0]).to.deep.equal(trs);
			expect(vote.calculateFee.args[0][1]).to.deep.equal(sender);
			expect(vote.calculateFee.args[0][2]).to.deep.equal(false);
			expect(vote.verify.calledOnce).to.be.true;
			expect(vote.verify.args[0][0]).to.deep.equal(trs);
			expect(vote.verify.args[0][1]).to.deep.equal(sender);
			expect(instance.checkConfirmed.calledOnce).to.be.true;
			expect(instance.checkConfirmed.args[0][0]).to.deep.equal(trs);
		});

		it('Missing sender', function () {
			instance.verify(false, false, false, callback);
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Missing sender');
		});

		it('Unknown transaction type', function () {
			Transaction.__set__('__private', { types: {} });
			instance.verify({ type: transactionTypes.VOTE }, true, false, callback);
			sandbox.clock.tick();
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
			sandbox.clock.tick();
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
			sandbox.clock.tick();
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
			sandbox.clock.tick();
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
			sandbox.clock.tick();
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Invalid sender public key: 123 expected: 456'
			);
			expect(instance.scope.logger.debug.called).to.be.false;
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Invalid sender. Can not send from genesis account'
			);
			expect(instance.scope.logger.debug.called).to.be.false;
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid sender address');
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
					asset: {
						multisignature: {
							keysgroup: [1, 2, 3]
						}
					}
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid member in keysgroup');
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
					asset: {
						multisignature: {
							keysgroup: ['1', '2', '3']
						}
					}
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Account does not belong to multisignature group'
			);
		});

		it('Verify signature throws error', function () {
			sandbox.stub(instance, 'verifySignature').throws('fakeError');
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {
						multisignature: {
							keysgroup: ['AAA', 'BBB', 'CCC']
						}
					}
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('fakeError');
			expect(instance.scope.logger.error.called).to.be.true;
			expect(instance.verifySignature.calledOnce).to.be.true;
		});

		it('Failed to verify signature: Call to callback', function () {
			sandbox.stub(instance, 'verifySignature').returns(false);
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {
						multisignature: {
							keysgroup: ['AAA', 'BBB', 'CCC']
						}
					}
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Failed to verify signature');
			expect(instance.verifySignature.calledOnce).to.be.true;
		});

		it('Verify second signature throws error', function () {
			sandbox.stub(instance, 'verifySignature').returns(true);
			sandbox.stub(instance, 'verifySecondSignature').throws('fakeError2');
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {
						multisignature: {
							keysgroup: ['AAA', 'BBB', 'CCC']
						}
					}
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('fakeError2');
			expect(instance.verifySecondSignature.calledOnce).to.be.true;
		});

		it('Failed to verify second signature', function () {
			sandbox.stub(instance, 'verifySignature').returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(false);
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {
						multisignature: {
							keysgroup: ['AAA', 'BBB', 'CCC']
						}
					}
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Failed to verify second signature'
			);
			expect(instance.verifySignature.calledOnce).to.be.true;
			expect(instance.verifySecondSignature.calledOnce).to.be.true;
		});

		it('Encountered duplicate signature in transaction', function () {
			sandbox.stub(instance, 'verifySignature').returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {
						multisignature: {
							keysgroup: ['AAA', 'BBB', 'CCC']
						}
					},
					signatures: ['a', 'b', 'c', 'b', 'c']
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Encountered duplicate signature in transaction'
			);
			expect(instance.verifySignature.calledOnce).to.be.true;
			expect(instance.verifySecondSignature.calledOnce).to.be.true;
		});

		it('Failed to verify multisignature', function () {
			sandbox.stub(instance, 'verifySignature');
			instance.verifySignature.onFirstCall().returns(true);
			instance.verifySignature.returns(false);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			instance.verify(
				{
					id: '123',
					type: transactionTypes.VOTE,
					blockId: 123,
					signSignature: 'abc',
					requesterPublicKey: 'ABC',
					senderPublicKey: '12345678',
					senderId: '123R',
					asset: {
						multisignature: {
							keysgroup: ['AAA', 'BBB', 'CCC']
						}
					},
					signatures: ['a', 'b', 'c', 'd']
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
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Failed to verify multisignature'
			);
			expect(instance.verifySignature.calledTwice).to.be.true;
			expect(instance.verifySecondSignature.calledOnce).to.be.true;
		});

		it('Invalid transaction fee', function () {
			sandbox.stub(vote, 'calculateFee').returns(false);
			sandbox.stub(instance, 'verifySignature');
			instance.verifySignature.returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {
					multisignature: {
						keysgroup: ['AAA', 'BBB', 'CCC']
					}
				},
				signatures: ['a', 'b', 'c', 'd'],
				fee: 123
			};
			var sender = {
				secondSignature: true,
				publicKey: '12345678',
				address: '123R',
				multisignatures: ['ABC'],
				u_multisignatures: []
			};
			instance.verify(trs, sender, false, callback);
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction fee');
			expect(instance.verifySignature.callCount).to.equal(5);
			expect(vote.calculateFee.calledOnce).to.be.true;
			expect(vote.calculateFee.args[0][0]).to.deep.equal(trs);
			expect(vote.calculateFee.args[0][1]).to.deep.equal(sender);
			expect(vote.calculateFee.args[0][2]).to.deep.equal(false);
		});

		it('Amount is less than zero', function () {
			sandbox.stub(vote, 'calculateFee').returns(50);
			sandbox.stub(instance, 'verifySignature');
			instance.verifySignature.returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {
					multisignature: {
						keysgroup: ['AAA', 'BBB', 'CCC']
					}
				},
				signatures: ['a', 'b', 'c', 'd'],
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
			instance.verify(trs, sender, false, callback);
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction amount');
			expect(vote.calculateFee.calledOnce).to.be.true;
			expect(vote.calculateFee.args[0][0]).to.deep.equal(trs);
			expect(vote.calculateFee.args[0][1]).to.deep.equal(sender);
			expect(vote.calculateFee.args[0][2]).to.deep.equal(false);
		});

		it('Amount is greater than constants.totalAmount', function () {
			sandbox.stub(vote, 'calculateFee').returns(50);
			sandbox.stub(instance, 'verifySignature');
			instance.verifySignature.returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			var amount = constants.totalAmount + 10;
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {
					multisignature: {
						keysgroup: ['AAA', 'BBB', 'CCC']
					}
				},
				signatures: ['a', 'b', 'c', 'd'],
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
			instance.verify(trs, sender, false, callback);
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction amount');
			expect(vote.calculateFee.calledOnce).to.be.true;
			expect(vote.calculateFee.args[0][0]).to.deep.equal(trs);
			expect(vote.calculateFee.args[0][1]).to.deep.equal(sender);
			expect(vote.calculateFee.args[0][2]).to.deep.equal(false);
		});

		it('Amount contains dots', function () {
			sandbox.stub(vote, 'calculateFee').returns(50);
			sandbox.stub(instance, 'verifySignature');
			instance.verifySignature.returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {
					multisignature: {
						keysgroup: ['AAA', 'BBB', 'CCC']
					}
				},
				signatures: ['a', 'b', 'c', 'd'],
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
			instance.verify(trs, sender, false, callback);
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction amount');
			expect(vote.calculateFee.calledOnce).to.be.true;
			expect(vote.calculateFee.args[0][0]).to.deep.equal(trs);
			expect(vote.calculateFee.args[0][1]).to.deep.equal(sender);
			expect(vote.calculateFee.args[0][2]).to.deep.equal(false);
		});

		it('Amount contains scientific notation', function () {
			sandbox.stub(vote, 'calculateFee').returns(50);
			sandbox.stub(instance, 'verifySignature');
			instance.verifySignature.returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {
					multisignature: {
						keysgroup: ['AAA', 'BBB', 'CCC']
					}
				},
				signatures: ['a', 'b', 'c', 'd'],
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
			instance.verify(trs, sender, false, callback);
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('Invalid transaction amount');
			expect(vote.calculateFee.calledOnce).to.be.true;
			expect(vote.calculateFee.args[0][0]).to.deep.equal(trs);
			expect(vote.calculateFee.args[0][1]).to.deep.equal(sender);
			expect(vote.calculateFee.args[0][2]).to.deep.equal(false);
		});

		it('Sender balance error', function () {
			sandbox.stub(vote, 'calculateFee').returns(50);
			sandbox.stub(instance, 'verifySignature');
			instance.verifySignature.returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {
					multisignature: {
						keysgroup: ['AAA', 'BBB', 'CCC']
					}
				},
				signatures: ['a', 'b', 'c', 'd'],
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
			instance.verify(trs, sender, false, callback);
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Account does not have enough RISE: 123R balance: 0.00000149'
			);
			expect(vote.calculateFee.calledOnce).to.be.true;
			expect(vote.calculateFee.args[0][0]).to.deep.equal(trs);
			expect(vote.calculateFee.args[0][1]).to.deep.equal(sender);
			expect(vote.calculateFee.args[0][2]).to.deep.equal(false);
		});

		it('Invalid transaction timestamp. Timestamp is in the future', function () {
			sandbox.stub(vote, 'calculateFee').returns(50);
			sandbox.stub(instance, 'verifySignature');
			instance.verifySignature.returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			var transactionTimestamp =
				Date.now() / 1000 - constants.epochTime.getTime() / 1000 + 1000;
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {
					multisignature: {
						keysgroup: ['AAA', 'BBB', 'CCC']
					}
				},
				signatures: ['a', 'b', 'c', 'd'],
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
			instance.verify(trs, sender, false, callback);
			sandbox.clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string(
				'Invalid transaction timestamp. Timestamp is in the future'
			);
			expect(vote.calculateFee.calledOnce).to.be.true;
			expect(vote.calculateFee.args[0][0]).to.deep.equal(trs);
			expect(vote.calculateFee.args[0][1]).to.deep.equal(sender);
			expect(vote.calculateFee.args[0][2]).to.deep.equal(false);
		});

		it('verify() call from transaction type returns error', function () {
			sandbox.stub(vote, 'calculateFee').returns(50);
			sandbox.stub(vote, 'verify').callsFake(function (trs, sender, cb) {
				setImmediate(cb, 'verifyError');
			});
			sandbox.stub(instance, 'verifySignature');
			instance.verifySignature.returns(true);
			sandbox.stub(instance, 'verifySecondSignature').returns(true);
			var transactionTimestamp =
				Date.now() / 1000 - constants.epochTime.getTime() / 1000 - 1000;
			var trs = {
				id: '123',
				type: transactionTypes.VOTE,
				blockId: 123,
				signSignature: 'abc',
				requesterPublicKey: 'ABC',
				senderPublicKey: '12345678',
				senderId: '123R',
				asset: {
					multisignature: {
						keysgroup: ['AAA', 'BBB', 'CCC']
					}
				},
				signatures: ['a', 'b', 'c', 'd'],
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
			instance.verify(trs, sender, false, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.have.string('verifyError');
			expect(vote.verify.calledOnce).to.be.true;
			expect(vote.verify.args[0][0]).to.deep.equal(trs);
			expect(vote.verify.args[0][1]).to.deep.equal(sender);
		});
	});

	describe('verifySignature()', function () {
		beforeEach(function () {
			instance = new Transaction();
			sandbox.stub(instance, 'getBytes');
			sandbox.stub(instance, 'verifyBytes');
		});

		it('Success', function () {
			instance.getBytes.returns(3);
			instance.verifyBytes.returns(4);
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			var trs = { type: transactionTypes.VOTE };
			var result = instance.verifySignature(trs, 1, 2);
			expect(instance.getBytes.called).to.be.true;
			expect(instance.getBytes.args[0][0]).to.deep.equal(trs);
			expect(instance.getBytes.args[0][1]).to.be.true;
			expect(instance.getBytes.args[0][2]).to.be.true;
			expect(instance.verifyBytes.called).to.be.true;
			expect(instance.verifyBytes.args[0][0]).to.equal(3);
			expect(instance.verifyBytes.args[0][1]).to.equal(1);
			expect(instance.verifyBytes.args[0][2]).to.equal(2);
			expect(result).to.equal(4);
		});

		it('Unknown transaction type', function () {
			expect(function () {
				instance.verifySignature({ type: transactionTypes.VOTE });
			}).throws('Unknown transaction type');
			expect(instance.getBytes.called).to.be.false;
			expect(instance.verifyBytes.called).to.be.false;
		});

		it('Not signature received', function () {
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			var result = instance.verifySignature({ type: transactionTypes.VOTE });
			expect(result).to.be.false;
			expect(instance.getBytes.called).to.be.false;
			expect(instance.verifyBytes.called).to.be.false;
		});

		it('getBytes() throws error', function () {
			instance.getBytes.throws(Error('getBytesError'));
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			var trs = { type: transactionTypes.VOTE };
			expect(function () {
				instance.verifySignature(trs, true, true);
			}).throws('getBytesError');
			expect(instance.getBytes.called).to.be.true;
			expect(instance.getBytes.args[0][0]).to.deep.equal(trs);
			expect(instance.getBytes.args[0][1]).to.be.true;
			expect(instance.getBytes.args[0][2]).to.be.true;
			expect(instance.verifyBytes.called).to.be.false;
		});

		it('verifyBytes() throws error', function () {
			instance.getBytes.returns(3);
			instance.verifyBytes.throws(Error('verifyBytesError'));
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			var trs = { type: transactionTypes.VOTE };
			expect(function () {
				instance.verifySignature(trs, 1, 2);
			}).throws('verifyBytesError');
		});
	});

	describe('verifySecondSignature()', function () {
		beforeEach(function () {
			instance = new Transaction();
			sandbox.stub(instance, 'getBytes');
			sandbox.stub(instance, 'verifyBytes');
		});

		it('Success', function () {
			instance.getBytes.returns(3);
			instance.verifyBytes.returns(4);
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			var trs = { type: transactionTypes.VOTE };
			var result = instance.verifySecondSignature(trs, 1, 2);
			expect(instance.getBytes.called).to.be.true;
			expect(instance.getBytes.args[0][0]).to.deep.equal(trs);
			expect(instance.getBytes.args[0][1]).to.be.false;
			expect(instance.getBytes.args[0][2]).to.be.true;
			expect(instance.verifyBytes.called).to.be.true;
			expect(instance.verifyBytes.args[0][0]).to.equal(3);
			expect(instance.verifyBytes.args[0][1]).to.equal(1);
			expect(instance.verifyBytes.args[0][2]).to.equal(2);
			expect(result).to.equal(4);
		});

		it('Unknown transaction type', function () {
			expect(function () {
				instance.verifySecondSignature({ type: transactionTypes.VOTE });
			}).throws('Unknown transaction type');
			expect(instance.getBytes.called).to.be.false;
			expect(instance.verifyBytes.called).to.be.false;
		});

		it('Not signature received', function () {
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			var result = instance.verifySecondSignature({
				type: transactionTypes.VOTE
			});
			expect(result).to.be.false;
			expect(instance.getBytes.called).to.be.false;
			expect(instance.verifyBytes.called).to.be.false;
		});

		it('getBytes() throws error', function () {
			instance.getBytes.throws(Error('getBytesError'));
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			var trs = { type: transactionTypes.VOTE };
			expect(function () {
				instance.verifySecondSignature(trs, true, true);
			}).throws('getBytesError');
			expect(instance.getBytes.called).to.be.true;
			expect(instance.verifyBytes.called).to.be.false;
		});

		it('verifyBytes() throws error', function () {
			instance.getBytes.returns(3);
			instance.verifyBytes.throws(Error('verifyBytesError'));
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			var trs = { type: transactionTypes.VOTE };
			expect(function () {
				instance.verifySecondSignature(trs, 1, 2);
			}).throws('verifyBytesError');
			expect(instance.getBytes.called).to.be.true;
			expect(instance.verifyBytes.called).to.be.true;
		});
	});

	describe('verifyBytes()', function () {
		var bytes, publicKey, signature;

		beforeEach(function () {
			bytes = [1, 2, 3];
			publicKey =
				'c094ebee7ec0c50ebee32918655e089f6e1a604b83bcaa760293c61e0f18ab6f';
			signature =
				'7ff5f0ee2c4d4c83d6980a46efe31befca41f7aa8cda5f7b4c2850e4942d923af058561a6a3312005ddee566244346bdbccf004bc8e2c84e653f9825c20be008';
			instance = new Transaction();
			instance.scope = scope;
		});

		after(function () {
			scope.ed.verify.restore();
		});

		it('Throws error', function () {
			instance.scope.ed.verify.throws(Error('verifyError'));
			expect(function () {
				instance.verifyBytes(bytes, publicKey, signature);
			}).throw('verifyError');
		});

		it('Success', function () {
			instance.scope.ed.verify.returns('success');
			var result = instance.verifyBytes(bytes, publicKey, signature);
			expect(result).to.equal('success');
		});
	});

	describe('apply()', function () {
		var trs, block, sender, amount, traceParam2, modules, vote;

		beforeEach(function () {
			modules = {
				rounds: {
					calc: function () {}
				}
			};
			vote = new Vote();
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.scope = scope;
			sandbox.stub(vote, 'apply');
			sandbox.stub(instance, 'ready');
			sandbox.stub(instance, 'checkBalance');
			sandbox.stub(modules.rounds, 'calc').returns(500);
		});

		it('Success', function () {
			vote.apply.callsFake(function (trs, block, sender, cb) {
				setImmediate(cb, 'applyError');
			});
			instance.bindModules(modules);
			instance.ready.returns(true);
			instance.checkBalance.returns({ exceeded: false });
			trs = { amount: 100, fee: 50, type: transactionTypes.VOTE };
			block = { id: 600, height: 70 };
			sender = { address: 700 };
			amount = new bignum(150);
			traceParam2 = {
				sender: sender.address,
				balance: -amount,
				blockId: block.id,
				round: 500
			};
			var mergeParam2 = {
				balance: -150,
				blockId: block.id,
				round: 500
			};
			instance.scope.account.merge.callsFake(function (address, diff, cb) {
				setImmediate(cb, undefined, { address: 700 });
			});
			instance.apply(trs, block, sender, callback);
			sandbox.clock.runAll();
			expect(instance.ready.calledOnce).to.be.true;
			expect(instance.ready.args[0][0]).to.deep.equal(trs);
			expect(instance.ready.args[0][1]).to.equal(sender);
			expect(instance.checkBalance.calledOnce).to.be.true;
			expect(instance.checkBalance.args[0][0]).to.deep.equal(amount);
			expect(instance.checkBalance.args[0][1]).to.equal('balance');
			expect(instance.checkBalance.args[0][2]).to.deep.equal(trs);
			expect(instance.checkBalance.args[0][3]).to.equal(sender);
			expect(instance.scope.logger.trace.calledTwice).to.be.true;
			expect(instance.scope.logger.trace.args[0][0]).to.equal(
				'Logic/Transaction->bindModules'
			);
			expect(instance.scope.logger.trace.args[1][0]).to.equal(
				'Logic/Transaction->apply'
			);
			expect(instance.scope.logger.trace.args[1][1]).to.deep.equal(traceParam2);
			expect(modules.rounds.calc.called).to.be.true;
			expect(modules.rounds.calc.args[0][0]).to.equal(block.height);
			expect(modules.rounds.calc.args[1][0]).to.equal(block.height);
			expect(instance.scope.account.merge.calledTwice).to.be.true;
			expect(instance.scope.account.merge.args[0][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[0][1]).to.deep.equal(
				mergeParam2
			);
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(undefined);
		});

		it('Transaction is not ready', function () {
			instance.ready.returns(false);
			trs = { amount: 100, fee: 50 };
			block = 2;
			sender = 3;
			instance.apply(trs, block, sender, callback);
			sandbox.clock.tick();
			expect(instance.ready.calledOnce).to.be.true;
			expect(instance.ready.args[0][0]).to.deep.equal(trs);
			expect(instance.ready.args[0][1]).to.equal(sender);
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal('Transaction is not ready');
		});

		it('Balance exceeded', function () {
			instance.ready.returns(true);
			instance.checkBalance.returns({
				exceeded: true,
				error: 'BalanceExceededError'
			});
			trs = { amount: 100, fee: 50 };
			block = 2;
			sender = 3;
			amount = new bignum(150);
			instance.apply(trs, block, sender, callback);
			sandbox.clock.tick();
			expect(instance.checkBalance.calledOnce).to.be.true;
			expect(instance.checkBalance.args[0][0]).to.deep.equal(amount);
			expect(instance.checkBalance.args[0][1]).to.equal('balance');
			expect(instance.checkBalance.args[0][2]).to.deep.equal(trs);
			expect(instance.checkBalance.args[0][3]).to.equal(sender);
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal('BalanceExceededError');
		});

		it('account.merge() returns error #1', function () {
			instance.bindModules(modules);
			instance.ready.returns(true);
			instance.checkBalance.returns({ exceeded: false });
			trs = { amount: 100, fee: 50 };
			block = { id: 600, height: 70 };
			sender = { address: 700 };
			amount = new bignum(150);
			traceParam2 = {
				sender: sender.address,
				balance: -amount,
				blockId: block.id,
				round: 500
			};
			var mergeParam2 = {
				balance: -150,
				blockId: block.id,
				round: 500
			};
			instance.scope.account.merge.callsFake(function (address, diff, cb) {
				setImmediate(cb, 'mergeError');
			});
			instance.apply(trs, block, sender, callback);
			sandbox.clock.runAll();
			expect(instance.scope.logger.trace.calledTwice).to.be.true;
			expect(instance.scope.logger.trace.args[0][0]).to.equal(
				'Logic/Transaction->bindModules'
			);
			expect(instance.scope.logger.trace.args[1][0]).to.equal(
				'Logic/Transaction->apply'
			);
			expect(instance.scope.logger.trace.args[1][1]).to.deep.equal(traceParam2);
			expect(modules.rounds.calc.called).to.be.true;
			expect(modules.rounds.calc.args[0][0]).to.equal(block.height);
			expect(modules.rounds.calc.args[1][0]).to.equal(block.height);
			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.args[0][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[0][1]).to.deep.equal(
				mergeParam2
			);
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal('mergeError');
		});

		it('account.merge() returns error #2', function () {
			vote.apply.callsFake(function (trs, block, sender, cb) {
				setImmediate(cb, 'applyError');
			});
			instance.bindModules(modules);
			instance.ready.returns(true);
			instance.checkBalance.returns({ exceeded: false });
			trs = { amount: 100, fee: 50, type: transactionTypes.VOTE };
			block = { id: 600, height: 70 };
			sender = { address: 700 };
			amount = new bignum(150);
			traceParam2 = {
				sender: sender.address,
				balance: -amount,
				blockId: block.id,
				round: 500
			};
			var mergeParam2 = {
				balance: -150,
				blockId: block.id,
				round: 500
			};
			instance.scope.account.merge
				.onCall(0)
				.callsFake(function (address, diff, cb) {
					setImmediate(cb, undefined, { address: 700 });
				});
			instance.scope.account.merge
				.onCall(1)
				.callsFake(function (address, diff, cb) {
					setImmediate(cb, 'mergeError2');
				});
			instance.apply(trs, block, sender, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal('mergeError2');
		});
	});

	describe('undo()', function () {
		var trs, block, sender, modules, vote;

		beforeEach(function () {
			modules = {
				rounds: {
					calc: function () {}
				}
			};
			sandbox.stub(modules.rounds, 'calc').returns(500);
			vote = new Vote();
			sandbox.stub(vote, 'undo');
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.scope = scope;
			instance.bindModules(modules);
		});

		it('success', function () {
			trs = {
				amount: 100,
				fee: 50,
				type: transactionTypes.VOTE
			};
			block = {
				id: '100',
				height: '4'
			};
			sender = {
				address: '123'
			};
			var traceParam = {
				sender: sender.address,
				balance: 150,
				blockId: block.id,
				round: 500
			};
			var mergeParam1 = {
				balance: 150,
				blockId: block.id,
				round: 500
			};
			var mergeParam2 = {
				balance: -150,
				blockId: block.id,
				round: 500
			};
			instance.scope.account.merge.callsFake(function (address, diff, cb) {
				setImmediate(cb, undefined, { address: '123' });
			});
			vote.undo.callsFake(function (trs, block, sender, cb) {
				setImmediate(cb);
			});
			instance.undo(trs, block, sender, callback);
			sandbox.clock.runAll();
			expect(instance.scope.logger.trace.calledTwice).to.be.true;
			expect(instance.scope.logger.trace.args[0][0]).to.equal(
				'Logic/Transaction->bindModules'
			);
			expect(instance.scope.logger.trace.args[1][0]).to.equal(
				'Logic/Transaction->undo'
			);
			expect(instance.scope.logger.trace.args[1][1]).to.deep.equal(traceParam);
			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.args[0][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[0][1]).to.deep.equal(
				mergeParam1
			);
			expect(vote.undo.calledOnce).to.be.true;
			expect(vote.undo.args[0][0]).to.deep.equal(trs);
			expect(vote.undo.args[0][1]).to.deep.equal(block);
			expect(vote.undo.args[0][2]).to.deep.equal(sender);
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(undefined);
		});

		it('account.merge() returns error #1', function () {
			trs = {
				amount: 100,
				fee: 50
			};
			block = {
				id: '100',
				height: '4'
			};
			sender = {
				address: '123'
			};
			var traceParam = {
				sender: sender.address,
				balance: 150,
				blockId: block.id,
				round: 500
			};
			var mergeParam = {
				balance: 150,
				blockId: block.id,
				round: 500
			};
			instance.scope.account.merge.callsFake(function (address, diff, cb) {
				setImmediate(cb, 'mergeError1');
			});
			instance.undo(trs, block, sender, callback);
			sandbox.clock.runAll();
			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.args[0][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[0][1]).to.deep.equal(mergeParam);
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal('mergeError1');
		});

		it('account.merge() returns error #2', function () {
			trs = {
				amount: 100,
				fee: 50,
				type: transactionTypes.VOTE
			};
			block = {
				id: '100',
				height: '4'
			};
			sender = {
				address: '123'
			};
			var traceParam = {
				sender: sender.address,
				balance: 150,
				blockId: block.id,
				round: 500
			};
			var mergeParam1 = {
				balance: 150,
				blockId: block.id,
				round: 500
			};
			var mergeParam2 = {
				balance: -150,
				blockId: block.id,
				round: 500
			};
			instance.scope.account.merge
				.onCall(0)
				.callsFake(function (address, diff, cb) {
					setImmediate(cb, undefined, { address: '123' });
				});
			instance.scope.account.merge
				.onCall(1)
				.callsFake(function (address, diff, cb) {
					setImmediate(cb, 'mergeError2');
				});
			vote.undo.callsFake(function (trs, block, sender, cb) {
				setImmediate(cb, 'undoError');
			});
			instance.undo(trs, block, sender, callback);
			sandbox.clock.runAll();
			expect(instance.scope.account.merge.calledTwice).to.be.true;
			expect(instance.scope.account.merge.args[0][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[0][1]).to.deep.equal(
				mergeParam1
			);
			expect(instance.scope.account.merge.args[1][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[1][1]).to.deep.equal(
				mergeParam2
			);
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal('mergeError2');
		});
	});

	describe('applyUnconfirmed()', function () {
		var trs, sender, amount, vote;

		beforeEach(function () {
			vote = new Vote();
			sandbox.stub(vote, 'applyUnconfirmed');
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.scope = scope;
			sandbox.stub(instance, 'checkBalance');
		});

		it('success', function () {
			trs = { amount: 100, fee: 50, type: transactionTypes.VOTE };
			sender = { address: '123' };
			instance.checkBalance.returns({ exceeded: false });
			instance.scope.account.merge.callsFake(function (address, diff, cb) {
				setImmediate(cb, undefined, { address: address });
			});
			vote.applyUnconfirmed.callsFake(function (trs, sender, cb) {
				setImmediate(cb);
			});
			var mergeParam1 = { u_balance: -150 };
			instance.applyUnconfirmed(trs, sender, callback);
			amount = new bignum(150);
			sandbox.clock.runAll();
			expect(instance.checkBalance.calledOnce).to.be.true;
			expect(instance.checkBalance.args[0][0]).to.deep.equal(amount);
			expect(instance.checkBalance.args[0][1]).to.equal('u_balance');
			expect(instance.checkBalance.args[0][2]).to.deep.equal(trs);
			expect(instance.checkBalance.args[0][3]).to.deep.equal(sender);
			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.args[0][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[0][1]).to.deep.equal(
				mergeParam1
			);
			expect(callback.args[0][0]).to.equal(undefined);
		});

		it('Balance exceeded', function () {
			trs = { amount: 100, fee: 50 };
			sender = { address: '123' };
			instance.checkBalance.returns({
				exceeded: true,
				error: 'balanceExceeded'
			});
			instance.applyUnconfirmed(trs, sender, callback);
			amount = new bignum(150);
			sandbox.clock.runAll();
			expect(callback.args[0][0]).to.equal('balanceExceeded');
		});

		it('account.merge() returns error #1', function () {
			trs = { amount: 100, fee: 50 };
			sender = { address: '123' };
			instance.checkBalance.returns({ exceeded: false });
			instance.scope.account.merge.callsFake(function (address, diff, cb) {
				setImmediate(cb, 'mergeError1');
			});
			var mergeParam1 = { u_balance: -150 };
			instance.applyUnconfirmed(trs, sender, callback);
			amount = new bignum(150);
			sandbox.clock.runAll();
			expect(callback.args[0][0]).to.equal('mergeError1');
		});

		it('account.merge() returns error #2', function () {
			trs = { amount: 100, fee: 50, type: transactionTypes.VOTE };
			sender = { address: '123' };
			instance.checkBalance.returns({ exceeded: false });
			instance.scope.account.merge
				.onCall(0)
				.callsFake(function (address, diff, cb) {
					setImmediate(cb, undefined, { address: address });
				});
			instance.scope.account.merge
				.onCall(1)
				.callsFake(function (address, diff, cb) {
					setImmediate(cb, 'mergeError2');
				});
			vote.applyUnconfirmed.callsFake(function (trs, sender, cb) {
				setImmediate(cb, 'applyUnconfirmedError');
			});
			var mergeParam1 = { u_balance: -150 };
			var mergeParam2 = { u_balance: 150 };
			instance.applyUnconfirmed(trs, sender, callback);
			amount = new bignum(150);
			sandbox.clock.runAll();
			expect(instance.scope.account.merge.calledTwice).to.be.true;
			expect(instance.scope.account.merge.args[0][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[0][1]).to.deep.equal(
				mergeParam1
			);
			expect(instance.scope.account.merge.args[1][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[1][1]).to.deep.equal(
				mergeParam2
			);
			expect(callback.args[0][0]).to.equal('mergeError2');
		});
	});

	describe('undoUnconfirmed()', function () {
		var vote, sender, trs, mergeParam1, mergeParam2;

		beforeEach(function () {
			vote = new Vote();
			sandbox.stub(vote, 'undoUnconfirmed');
			instance = new Transaction();
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.scope = scope;
		});

		it('Success', function () {
			trs = { amount: 100, fee: 50, type: transactionTypes.VOTE };
			sender = { address: '123' };
			mergeParam1 = { u_balance: 150 };
			instance.scope.account.merge.callsFake(function (trs, sender, cb) {
				setImmediate(cb, undefined, { address: '123' });
			});
			vote.undoUnconfirmed.callsFake(function (address, diff, cb) {
				setImmediate(cb);
			});
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.undoUnconfirmed(trs, sender, callback);
			sandbox.clock.runAll();
			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.args[0][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[0][1]).to.deep.equal(
				mergeParam1
			);
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(undefined);
		});

		it('account.merge() error #1', function () {
			trs = { amount: 100, fee: 50 };
			sender = { address: '123' };
			mergeParam1 = { u_balance: 150 };
			instance.scope.account.merge.callsFake(function (trs, sender, cb) {
				setImmediate(cb, 'mergeError1');
			});
			instance.undoUnconfirmed(trs, sender, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal('mergeError1');
		});

		it('account.merge() error #2', function () {
			trs = { amount: 100, fee: 50, type: transactionTypes.VOTE };
			sender = { address: '123' };
			mergeParam1 = { u_balance: 150 };
			mergeParam2 = { u_balance: -150 };
			instance.scope.account.merge
				.onCall(0)
				.callsFake(function (trs, sender, cb) {
					setImmediate(cb, undefined, { address: '123' });
				});
			instance.scope.account.merge
				.onCall(1)
				.callsFake(function (trs, sender, cb) {
					setImmediate(cb, 'mergeError2');
				});
			vote.undoUnconfirmed.callsFake(function (address, diff, cb) {
				setImmediate(cb, 'undoUnconfirmedError');
			});
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.undoUnconfirmed(trs, sender, callback);
			sandbox.clock.runAll();
			expect(instance.scope.account.merge.calledTwice).to.be.true;
			expect(instance.scope.account.merge.args[0][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[0][1]).to.deep.equal(
				mergeParam1
			);
			expect(instance.scope.account.merge.args[1][0]).to.equal(sender.address);
			expect(instance.scope.account.merge.args[1][1]).to.deep.equal(
				mergeParam2
			);
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal('mergeError2');
		});
	});

	describe('dbSave()', function () {
		var trs, vote;

		beforeEach(function () {
			instance = new Transaction();
			vote = new Vote();
		});

		it('Unknown transaction type', function () {
			expect(function () {
				instance.dbSave({ type: transactionTypes.VOTE });
			}).throws('Unknown transaction type');
		});

		it('throws Error', function () {
			instance.attachAssetType(transactionTypes.VOTE, vote);
			expect(function () {
				instance.dbSave({ type: transactionTypes.VOTE });
			}).throws();
		});

		it('Success', function () {
			instance.attachAssetType(transactionTypes.VOTE, vote);
			trs = {
				id: '123',
				type: transactionTypes.VOTE,
				senderPublicKey:
					'c094ebee7ec0c50ebee32918655e089f6e1a604b83bcaa760293c61e0f18ab6f',
				signature:
					'7ff5f0ee2c4d4c83d6980a46efe31befca41f7aa8cda5f7b4c2850e4942d923af058561a6a3312005ddee566244346bdbccf004bc8e2c84e653f9825c20be008',
				signSignature: null,
				requesterPublicKey: null,
				blockId: '456',
				timestamp: 33363661,
				senderId: '123456789R',
				recipientId: '123456780R',
				amount: 100,
				fee: 50,
				signatures: null,
				asset: { votes: [] }
			};
			var result = instance.dbSave(trs);
			expect(result).to.have.length(2);
		});
	});

	describe('afterSave()', function () {
		beforeEach(function () {
			instance = new Transaction();
		});

		it('Unknown transaction type', function () {
			instance.afterSave({ type: transactionTypes.VOTE }, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(
				'Unknown transaction type ' + transactionTypes.VOTE
			);
		});

		it('afterSave() doesn\'t exist', function () {
			instance.attachAssetType(transactionTypes.VOTE, new Vote());
			instance.afterSave({ type: transactionTypes.VOTE }, callback);
			sandbox.clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equal(undefined);
		});

		it('Success', function () {
			var dappInstance = new Dapp();
			sandbox.stub(dappInstance, 'afterSave');
			instance.attachAssetType(transactionTypes.DAPP, dappInstance);
			var trs = { type: transactionTypes.DAPP };
			instance.afterSave({ type: transactionTypes.DAPP }, callback);
			sandbox.clock.runAll();
			expect(callback.called).to.be.false;
			expect(dappInstance.afterSave.calledOnce).to.be.true;
			expect(dappInstance.afterSave.args[0][0]).to.deep.equal(trs);
		});
	});

	describe('objectNormalize()', function () {
		var trs, vote;

		beforeEach(function () {
			instance = new Transaction();
			instance.scope = scope;
			trs = { type: transactionTypes.VOTE };
			vote = new Vote();
			sandbox.stub(vote, 'objectNormalize');
		});

		it('Unknown transaction type', function () {
			expect(function () {
				instance.objectNormalize(trs);
			}).throws('Unknown transaction type');
		});

		it('Failed to validate transaction schema', function () {
			instance.attachAssetType(transactionTypes.VOTE, vote);
			instance.scope.schema.validate.returns(false);
			expect(function () {
				instance.objectNormalize(trs);
			}).throws('Failed to validate transaction schema');
			expect(instance.scope.schema.validate.args[0][0]).to.deep.equal(trs);
			expect(instance.scope.schema.validate.args[0][1]).to.deep.equal(
				instance.schema
			);
		});

		it('Throws error', function () {
			instance.scope.schema.validate.returns(true);
			vote.objectNormalize.throws(Error('fooError'));
			instance.attachAssetType(transactionTypes.VOTE, vote);
			expect(function () {
				instance.objectNormalize(trs);
			}).throws('fooError');
		});

		it('Success', function () {
			instance.scope.schema.validate.returns(true);
			vote.objectNormalize.returns(trs);
			instance.attachAssetType(transactionTypes.VOTE, vote);
			var result = instance.objectNormalize(trs);
			expect(result).to.deep.equal(trs);
		});
	});

	describe('dbRead()', function () {
		var raw, vote, trs;

		beforeEach(function () {
			instance = new Transaction();
			raw = {
				t_id: 'a',
				b_height: 'b',
				b_id: 'c',
				t_type: '3',
				t_timestamp: Date.now(),
				t_senderPublicKey: 'f',
				t_requesterPublicKey: 'g',
				t_senderId: 'h',
				t_recipientId: 'i',
				m_recipientPublicKey: 'j',
				t_amount: '100',
				t_fee: '50',
				t_signature: 'm',
				t_signSignature: 'n',
				t_signatures: 'o,p,q',
				confirmations: '2'
			};
			trs = {
				id: raw.t_id,
				height: raw.b_height,
				blockId: raw.b_id || raw.t_blockId,
				type: parseInt(raw.t_type),
				timestamp: parseInt(raw.t_timestamp),
				senderPublicKey: raw.t_senderPublicKey,
				requesterPublicKey: raw.t_requesterPublicKey,
				senderId: raw.t_senderId,
				recipientId: raw.t_recipientId,
				recipientPublicKey: raw.m_recipientPublicKey || null,
				amount: parseInt(raw.t_amount),
				fee: parseInt(raw.t_fee),
				signature: raw.t_signature,
				signSignature: raw.t_signSignature,
				signatures: raw.t_signatures ? raw.t_signatures.split(',') : [],
				confirmations: parseInt(raw.confirmations),
				asset: {}
			};
			vote = new Vote();
			sandbox.stub(vote, 'dbRead');
		});

		it('returns null', function () {
			var result = instance.dbRead({});
			expect(result).to.be.null;
		});

		it('Unknown transaction type', function () {
			expect(function () {
				instance.dbRead(raw);
			}).throws('Unknown transaction type');
		});

		it('Success and extending asset', function () {
			var asset = ['x', 'y', 'z'];
			vote.dbRead.returns(asset);
			instance.attachAssetType(transactionTypes.VOTE, vote);
			trs.asset['0'] = asset[0];
			trs.asset['1'] = asset[1];
			trs.asset['2'] = asset[2];
			var result = instance.dbRead(raw);
			expect(result).to.deep.equal(trs);
			expect(vote.dbRead.calledOnce).to.be.true;
			expect(vote.dbRead.args[0][0]).to.deep.equal(raw);
		});

		it('Success without extending asset', function () {
			vote.dbRead.returns(false);
			instance.attachAssetType(transactionTypes.VOTE, vote);
			var result = instance.dbRead(raw);
			expect(result).to.deep.equal(trs);
			expect(vote.dbRead.calledOnce).to.be.true;
			expect(vote.dbRead.args[0][0]).to.deep.equal(raw);
		});
	});

	describe('bindModules()', function () {
		var modules, dummyModules;

		it('success', function () {
			dummyModules = { rounds: 123 };
			instance = new Transaction();
			instance.scope = scope;
			instance.bindModules(dummyModules);
			expect(instance.scope.logger.trace.calledOnce).to.be.true;
			expect(instance.scope.logger.trace.args[0][0]).to.equal(
				'Logic/Transaction->bindModules'
			);
			modules = Transaction.__get__('modules');
			expect(modules).to.deep.equal(dummyModules);
		});
	});
});
