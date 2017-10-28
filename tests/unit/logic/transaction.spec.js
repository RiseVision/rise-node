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
var crypto = require('crypto');
var senderHash = crypto
	.createHash('sha256')
	.update('Hello World!', 'utf8')
	.digest();
var senderKeypair = ed.makeKeypair(senderHash);

describe('logic/transaction', function () {
	var instance, callback, clock, transactionRevert;

	beforeEach(function () {
		clock = sinon.useFakeTimers();
		callback = sinon.spy();
		transactionRevert = Transaction.__set__('setImmediate', setImmediate);
	});

	afterEach(function () {
		callback.reset();
		clock.restore();
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
		var getHashSpy, signSpy, validTransaction;

		it('success', function () {
			validTransaction = {
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

		describe('multisign()', function () {
			var getBytesSpy, createHashSpy, signSpy, validTransaction;

			it('success', function () {
				validTransaction = {
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
	});

	describe('getId', function () {});
});
