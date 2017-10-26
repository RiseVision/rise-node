var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var rewire = require('rewire');
var Transaction = rewire('../../../logic/transaction');
var transactionTypes = require('../../../helpers/transactionTypes');
var Vote = require('../../../logic/vote.js');
var slots = require('../../../helpers/slots.js');
var ed = require('../../../helpers/ed');
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
});
