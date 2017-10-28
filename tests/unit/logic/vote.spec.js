var chai = require('chai');
var assertArrays = require('chai-arrays');
chai.use(assertArrays);
var expect = chai.expect;
var sinon = require('sinon');
var rewire = require('rewire');
var Vote = rewire('../../../logic/vote');
var zSchema = require('../../../helpers/z_schema').default;
var constants = require('../../../helpers/constants').default;
var crypto = require('crypto');
var Diff = require('../../../helpers/diff');

describe('logic/vote', function () {
	var callback,
		clock,
		delegates = {},
		rounds = {},
		system = {};

	beforeEach(function () {
		callback = sinon.spy();
		clock = sinon.useFakeTimers();
		Vote.__set__('setImmediate', setImmediate);
	});

	afterEach(function () {
		clock.restore();
		callback.reset();
	});

	it('should be a function', function () {
		expect(Vote).to.be.a('function');
	});

	it('when Vote is instantiated', function () {
		var logger = 1,
			schema = 2,
			library;
		new Vote(logger, schema);
		library = Vote.__get__('library');
		expect(library.logger).to.equals(logger);
		expect(library.schema).to.equals(schema);
	});

	it('bind()', function () {
		delegates = 'a';
		rounds = 'b';
		system = 'c';
		var modules, vote;
		vote = new Vote();
		vote.bind(delegates, rounds, system);
		modules = Vote.__get__('modules');
		expect(modules.delegates).to.equals(delegates);
		expect(modules.rounds).to.equals(rounds);
		expect(modules.system).to.equals(system);
	});

	it('create()', function () {
		var data = { sender: { address: 10 }, votes: 20 },
			trs = { recipientId: 0, asset: { votes: 0 } },
			vote;
		vote = new Vote();
		var transaction = vote.create(data, trs);
		expect(transaction.recipientId).to.equals(data.sender.address);
		expect(transaction.asset.votes).to.equals(data.votes);
	});

	it('calculateFee()', function () {
		var height = 50,
			system = {
				getFees: function (height) {
					return { fees: { vote: 100 } };
				}
			},
			vote;
		vote = new Vote();
		vote.bind(undefined, undefined, system);
		var fee = vote.calculateFee(undefined, undefined, height);
		expect(fee).to.equals(100);
	});

	describe('verify()', function () {
		var trs, sender, vote;

		beforeEach(function () {
			vote = new Vote();
		});

		it('If recipientId is not equal to senderId', function () {
			trs = { recipientId: 1, senderId: 2 };
			vote.verify(trs, sender, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals('Invalid recipient');
		});

		it('if trs.asset is not true', function () {
			trs = { asset: {} };
			vote.verify(trs, sender, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals('Invalid transaction asset');
		});

		it('if trs.asset.votes is not true', function () {
			trs = { asset: { votes: undefined } };
			vote.verify(trs, sender, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals('Invalid transaction asset');
		});

		it('If trs.asset.votes is not an Array', function () {
			trs = { asset: { votes: 'foo' } };
			vote.verify(trs, sender, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals('Invalid votes. Must be an array');
		});

		it('if trs.asset.votes.length is not true', function () {
			trs = { asset: { votes: [] } };
			vote.verify(trs, sender, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals('Invalid votes. Must not be empty');
		});

		it('if trs.asset.votes.length is not true', function () {
			trs = { asset: { votes: [] } };
			vote.verify(trs, sender, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals('Invalid votes. Must not be empty');
		});

		it('if trs.asset.votes is greater than maxVotesPerTransaction', function () {
			trs = { asset: { votes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } };
			vote.verify(trs, sender, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.include('Voting limit exceeded');
		});

		it('if vote has not a valid format', function () {
			trs = { asset: { votes: [123] } };
			vote.verify(trs, sender, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.include('Invalid vote at index');
		});

		it('if there are duplicate votes', function () {
			trs = {
				asset: {
					votes: [
						'+b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
						'+b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
					]
				}
			};
			vote.verify(trs, sender, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.include(
				'Multiple votes for same delegate are not allowed'
			);
		});

		it('success', function () {
			Vote.__set__('self.checkConfirmedDelegates', function (trs, cb) {
				return setImmediate(cb);
			});
			trs = {
				asset: {
					votes: [
						'+b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
						'+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22'
					]
				}
			};
			vote.verify(trs, sender, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals(undefined);
		});
	});

	describe('verifyVote()', function () {
		var vote;

		beforeEach(function () {
			vote = new Vote();
		});

		it('if vote is not a string', function () {
			vote.verifyVote(123, callback);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals('Invalid vote type');
		});

		it('if vote has not a valid format', function () {
			vote.verifyVote(
				'+b94d27b993-d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals('Invalid vote format');
		});

		it('if vote length is not 65', function () {
			vote.verifyVote(
				'+b94d27b993d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9zz',
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals('Invalid vote length');
		});

		it('success', function () {
			vote.verifyVote(
				'+b94d27b993d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9z',
				callback
			);
			clock.tick();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals(undefined);
		});
	});

	describe('checkConfirmedDelegates()', function () {
		var trs, vote;

		it('should call to callback without errors', function () {
			trs = { senderPublicKey: 'foo', asset: { votes: [] } };
			vote = new Vote();
			vote.bind(delegates, rounds, system);
			Vote.__set__({
				modules: {
					delegates: {
						checkConfirmedDelegates: function (trs, votes, cb) {
							return setImmediate(cb);
						}
					}
				}
			});
			vote.checkConfirmedDelegates(trs, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals(undefined);
		});
	});

	describe('checkUnconfirmedDelegates()', function () {
		var trs, vote, delegatesStub;

		afterEach(function () {
			delegatesStub.restore();
		});

		it('should call to callback without errors', function () {
			trs = { senderPublicKey: 'foo', asset: { votes: [] } };
			delegates = { checkUnconfirmedDelegates: function () {} };
			delegatesStub = sinon
				.stub(delegates, 'checkUnconfirmedDelegates')
				.callsFake(function (trs, votes, cb) {
					return setImmediate(cb);
				});
			vote = new Vote();
			vote.bind(delegates, rounds, system);
			vote.checkUnconfirmedDelegates(trs, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][0]).to.equals(undefined);
			expect(delegatesStub.calledOnce).to.be.true;
			expect(delegatesStub.args[0][0]).to.equal(trs.senderPublicKey);
			expect(delegatesStub.args[0][1]).to.equal(trs.asset.votes);
		});
	});

	describe('process()', function () {
		var trs, vote;

		it('should call to callback passing the same transaction parameter received', function () {
			trs = 1;
			vote = new Vote();
			vote.process(trs, null, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(callback.args[0][1]).to.equals(trs);
		});
	});

	describe('getBytes()', function () {
		var trs, result, getBytes, vote;

		beforeEach(function () {
			vote = new Vote();
		});

		it('if the input data is wrong', function () {
			trs = { asset: { votes: 123 } };
			getBytes = function () {
				vote.getBytes(trs);
			};
			expect(getBytes).to.throw();
		});

		it('if trs.asset.votes is undefined', function () {
			trs = { asset: { votes: undefined } };
			result = vote.getBytes(trs);
			expect(result).to.equals(null);
		});

		it('success', function () {
			trs = {
				asset: {
					votes: [
						'+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22',
						'+9f59d4260dcd848f71d17824f53df31f3dfb87542042590554419ff40542c55e'
					]
				}
			};
			result = vote.getBytes(trs);
			expect(result).to.be.an.instanceof(Buffer);
		});
	});

	describe('apply()', function () {
		var trs,
			block,
			sender,
			vote,
			mergeStub,
			checkConfirmedDelegatesStub,
			calcSpy;

		beforeEach(function () {
			vote = new Vote();
      vote.scope = {
        account: {
          merge: function(){}
        }
      };
      mergeStub = sinon
        .stub(vote.scope.account, 'merge')
        .callsFake(function (address, block, cb) {
          setImmediate(cb);
        });
			checkConfirmedDelegatesStub = sinon
				.stub(vote, 'checkConfirmedDelegates')
				.callsFake(function (trs, seriesCb) {
					return setImmediate(seriesCb);
				});
		});

		afterEach(function () {
			checkConfirmedDelegatesStub.restore();
			calcSpy.restore();
      mergeStub.restore();
		});

		it('should call to callback', function () {
			rounds = {
				calc: function (height) {
					return height;
				}
			};
			calcSpy = sinon.spy(rounds, 'calc');
			trs = { asset: { votes: [] } };
			block = { id: 123, height: 123 };
			sender = { address: 123 };
			vote.bind(delegates, rounds, system);
			vote.apply(trs, block, sender, callback);
			clock.runAll();
			expect(checkConfirmedDelegatesStub.calledOnce).to.be.true;
			expect(checkConfirmedDelegatesStub.args[0][0]).to.deep.equal(trs);
			expect(vote.scope.account.merge.calledOnce).to.be.true;
			expect(vote.scope.account.merge.args[0][0]).to.equal(sender.address);
			expect(calcSpy.calledOnce).to.be.true;
			expect(callback.calledOnce).to.be.true;
		});
	});

	describe('undo()', function () {
		var trs, block, sender, schema, logger, vote, calcSpy, mergeStub, DiffStub;

		beforeEach(function () {
			schema = new zSchema();
			vote = new Vote(logger, schema);
			vote.scope = {
				account: {
					merge: function(){}
				}
			};
			mergeStub = sinon
				.stub(vote.scope.account, 'merge')
				.callsFake(function (address, block, cb) {
					setImmediate(cb);
				});
			rounds = {
				calc: function (height) {
					return height;
				}
			};
			calcSpy = sinon.spy(rounds, 'calc');
			sender = { address: 123 };
			block = { id: 123, height: 123 };
			vote.bind(delegates, rounds, system);
			DiffStub = sinon.stub(Diff, 'reverse');
		});

		afterEach(function () {
			calcSpy.reset();
			mergeStub.restore();
			DiffStub.restore();
		});

		it('if trs.asset.votes is null', function () {
			trs = { asset: { votes: null } };
			vote.undo(trs, block, sender, callback);
			clock.runAll();
			expect(mergeStub.calledOnce).to.be.false;
			expect(calcSpy.calledOnce).to.be.false;
			expect(callback.calledOnce).to.be.true;
			expect(DiffStub.called).to.be.false;
		});

		it('if trs.asset.votes is empty', function () {
			trs = { asset: { votes: [] } };
			vote.undo(trs, block, sender, callback);
			clock.runAll();
			expect(mergeStub.calledOnce).to.be.false;
			expect(callback.calledOnce).to.be.true;
			expect(DiffStub.called).to.be.false;
		});

		it('if trs.asset.votes is undefined', function () {
			trs = { asset: { votes: undefined } };
			vote.undo(trs, block, sender, callback);
			clock.runAll();
			expect(mergeStub.calledOnce).to.be.false;
			expect(callback.calledOnce).to.be.true;
			expect(DiffStub.called).to.be.false;
		});

		it('if trs.asset.votes has not a valid format', function () {
			trs = { asset: { votes: [1, 2] } };
			vote.undo(trs, block, sender, callback);
			clock.runAll();
			expect(mergeStub.calledOnce).to.be.false;
			expect(callback.calledOnce).to.be.true;
			expect(DiffStub.called).to.be.false;
		});

		it('if trs.asset.votes is an Array and have items', function () {
			trs = {
				asset: {
					votes: [
						'+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22',
						'+b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
					]
				}
			};
			vote.undo(trs, block, sender, callback);
			clock.runAll();
			expect(mergeStub.calledOnce).to.be.true;
			expect(callback.calledOnce).to.be.true;
			expect(DiffStub.called).to.be.true;
		});
	});

	describe('applyUnconfirmed', function () {
		var trs, sender, scope, vote, checkUnconfirmedDelegatesStub, mergeStub;

		beforeEach(function () {
			vote = new Vote();
      vote.scope = {
        account: {
          merge: function(){}
        }
      }
			checkUnconfirmedDelegatesStub = sinon
				.stub(vote, 'checkUnconfirmedDelegates')
				.callsFake(function (trs, cb) {
					return setImmediate(cb);
				});
			mergeStub = sinon
				.stub(vote.scope.account, 'merge')
				.callsFake(function (address, block, cb) {
					setImmediate(cb);
				});
		});

		afterEach(function () {
			checkUnconfirmedDelegatesStub.restore();
			mergeStub.restore();
		});

		it('should call to callback', function () {
			sender = { address: 123 };
			scope = {
				account: {
					merge: function (address, data, cb) {
						cb();
					}
				}
			};
			trs = { asset: { votes: [] } };
			vote.applyUnconfirmed(trs, sender, callback);
			clock.runAll();
			expect(callback.calledOnce).to.be.true;
			expect(checkUnconfirmedDelegatesStub.calledOnce).to.be.true;
			expect(checkUnconfirmedDelegatesStub.args[0][0]).to.deep.equal(trs);
			expect(mergeStub.calledOnce).to.be.true;
			expect(mergeStub.args[0][0]).to.equal(sender.address);
		});
	});

	describe('undoUnconfirmed()', function () {
		var trs, sender, schema, logger, vote, mergeStub, calcSpy, DiffStub;

		beforeEach(function () {
			schema = new zSchema();
			vote = new Vote(logger, schema);
      vote.scope = {
        account: {
          merge: function(){}
        }
      };
			mergeStub = sinon
				.stub(vote.scope.account, 'merge')
				.callsFake(function (address, block, cb) {
					setImmediate(cb);
				});
			rounds = {
				calc: function (height) {
					return height;
				}
			};
			calcSpy = sinon.spy(rounds, 'calc');
			sender = { address: 123 };
			DiffStub = sinon.stub(Diff, 'reverse');
			vote.bind(delegates, rounds, system);
		});

		afterEach(function () {
			mergeStub.restore();
			calcSpy.reset();
			DiffStub.restore();
		});

		it('if trs.asset.votes is null', function () {
			trs = { asset: { votes: null } };
			vote.undoUnconfirmed(trs, sender, callback);
			clock.runAll();
			expect(Diff.reverse.called).to.be.false;
			expect(mergeStub.calledOnce).to.be.false;
			expect(callback.calledOnce).to.be.true;
		});

		it('if trs.asset.votes is empty', function () {
			trs = { asset: { votes: [] } };
			vote.undoUnconfirmed(trs, sender, callback);
			clock.runAll();
			expect(Diff.reverse.called).to.be.false;
			expect(mergeStub.calledOnce).to.be.false;
			expect(callback.calledOnce).to.be.true;
		});

		it('if trs.asset.votes is undefined', function () {
			trs = { asset: { votes: undefined } };
			vote.undoUnconfirmed(trs, sender, callback);
			clock.runAll();
			expect(Diff.reverse.called).to.be.false;
			expect(mergeStub.calledOnce).to.be.false;
			expect(callback.calledOnce).to.be.true;
		});

		it('if trs.asset.votes has not a valid format', function () {
			trs = { asset: { votes: [1, 2] } };
			vote.undoUnconfirmed(trs, sender, callback);
			clock.runAll();
			expect(Diff.reverse.called).to.be.false;
			expect(mergeStub.calledOnce).to.be.false;
			expect(callback.calledOnce).to.be.true;
		});

		it('if trs.asset.votes is an Array and have items', function () {
			trs = {
				asset: {
					votes: [
						'+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22',
						'+b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
					]
				}
			};
			vote.undoUnconfirmed(trs, sender, callback);
			clock.runAll();
			expect(Diff.reverse.called).to.be.true;
			expect(mergeStub.calledOnce).to.be.true;
			expect(mergeStub.args[0][0]).to.equal(sender.address);
			expect(callback.calledOnce).to.be.true;
		});
	});

	describe('objectNormalize()', function () {
		var trs, vote, logger, schema, execMethod;

		beforeEach(function () {
			schema = new zSchema();
			vote = new Vote(logger, schema);
		});

		it('Fail 1: if trs.asset is undefined', function () {
			trs = { asset: undefined };
			execMethod = function () {
				vote.objectNormalize(trs);
			};
			expect(execMethod).to.throw(
				'Expected type object but found type undefined'
			);
		});

		it('Fail 2: if trs.asset.votes is undefined', function () {
			trs = { asset: { votes: undefined } };
			execMethod = function () {
				vote.objectNormalize(trs);
			};
			expect(execMethod).to.throw('Missing required property: votes');
		});

		it('Fail 3: if trs.asset.votes is null', function () {
			trs = { asset: { votes: null } };
			execMethod = function () {
				vote.objectNormalize(trs);
			};
			expect(execMethod).to.throw('Expected type array but found type null');
		});

		it('Fail 4: if trs.asset.votes is an empty Array', function () {
			trs = { asset: { votes: [] } };
			execMethod = function () {
				vote.objectNormalize(trs);
			};
			expect(execMethod).to.throw('Array is too short');
		});

		it('Fail 5: if trs.asset.votes has duplicates', function () {
			trs = {
				asset: {
					votes: [
						'+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22',
						'+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22'
					]
				}
			};
			execMethod = function () {
				vote.objectNormalize(trs);
			};
			expect(execMethod).to.throw('Array items are not unique');
		});

		it('Fail 6: if trs.asset.votes is greater than constants.maxVotesPerTransaction', function () {
			trs = { asset: { votes: [] } };
			for (var i = 0; i <= constants.maxVotesPerTransaction; i++) {
				trs.asset.votes.push(
					'+' +
						crypto
							.createHash('sha256')
							.update(i.toString(), 'utf8')
							.digest('hex')
				);
			}
			execMethod = function () {
				vote.objectNormalize(trs);
			};
			expect(execMethod).to.throw('Array is too long');
		});

		it('Fail 7: if trs.asset has additional properties', function () {
			trs = {
				asset: {
					votes: [
						'+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22'
					],
					foo: {}
				}
			};
			execMethod = function () {
				vote.objectNormalize(trs);
			};
			expect(execMethod).to.throw('Additional properties not allowed');
		});

		it('Fail 8: if trs.asset.votes items has a wrong format', function () {
			trs = { asset: { votes: [123, 'abc'] } };
			execMethod = function () {
				vote.objectNormalize(trs);
			};
			expect(execMethod).to.throw('String does not match pattern');
			expect(execMethod).to.throw(
				'Expected type string but found type integer'
			);
		});

		it('success', function () {
			trs = {
				asset: {
					votes: [
						'+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22',
						'-6d1103674f29502c873de14e48e9e432ec6cf6db76272c7b0dad186bb92c9a9a'
					]
				}
			};
			var result = vote.objectNormalize(trs);
			expect(result).to.deep.equal(trs);
		});
	});

	describe('dbRead()', function () {
		var raw, result, vote;

		beforeEach(function () {
			vote = new Vote();
		});

		it('Fail 1: If v_votes is undefined', function () {
			raw = { v_votes: undefined };
			result = vote.dbRead(raw);
			expect(result).to.equals(null);
		});

		it('Fail 2: If v_votes is null', function () {
			raw = { v_votes: null };
			result = vote.dbRead(raw);
			expect(result).to.equals(null);
		});

		it('Fail 3: If v_votes is false', function () {
			raw = { v_votes: false };
			result = vote.dbRead(raw);
			expect(result).to.equals(null);
		});

		it('Fail 4: If v_votes is an empty string', function () {
			raw = { v_votes: '' };
			result = vote.dbRead(raw);
			expect(result).to.equals(null);
		});

		it('Fail 5: If v_votes is not a string', function () {
			raw = { v_votes: [] };
      throwError = function () {
        vote.dbRead(raw);
      };
			expect(throwError).to.throws();
		});

		it('success', function () {
			raw = { v_votes: '1,3,4' };
			result = vote.dbRead(raw);
			expect(result).to.have.deep.property('votes');
			expect(result).to.deep.equal({ votes: ['1', '3', '4'] });
		});
	});

	describe('dbSave()', function () {
		it('If trs.asset.votes is an Array', function () {
			var trs = { id: 123, asset: { votes: [1, 2, 3] } };
			var vote = new Vote();
			var result = vote.dbSave(trs);
			expect(result).to.deep.equal({
				table: 'votes',
				fields: ['votes', 'transactionId'],
				values: { votes: '1,2,3', transactionId: 123 }
			});
		});

		it('If trs.asset.votes is not an Array', function () {
			var trs = { id: 123, asset: { votes: 'foo' } };
			var vote = new Vote();
			var result = vote.dbSave(trs);
			expect(result).to.deep.equal({
				table: 'votes',
				fields: ['votes', 'transactionId'],
				values: { votes: null, transactionId: 123 }
			});
		});
	});

	describe('ready()', function () {
		var trs, trs_b, sender, result, vote;

		beforeEach(function () {
			vote = new Vote();
		});

		it('Case 1: If sender.multisignatures is not an Array', function () {
			sender = { multisignatures: undefined };
			trs = {};
			result = vote.ready(trs, sender);
			expect(result).to.equals(true);
		});

		it('Case 2: If sender.multisignatures is an empty Array', function () {
			sender = { multisignatures: [] };
			trs = {};
			result = vote.ready(trs, sender);
			expect(result).to.equals(true);
		});

		it('Case 3: If trs.signatures is not an Array', function () {
			sender = { multisignatures: [1, 2, 3] };
			trs = {};
			result = vote.ready(trs, sender);
			expect(result).to.equals(false);
		});

		it('Case 4: If trs.signatures greater or equal than sender.multimin', function () {
			sender = { multisignatures: [1, 2, 3], multimin: 2 };
			trs = { signatures: [1, 2, 3] };
			trs_b = { signatures: [1, 2] };
			result = vote.ready(trs, sender);
			var result_b = vote.ready(trs_b, sender);
			expect(result).to.equals(true);
			expect(result_b).to.equals(true);
		});

		it('Case 5: If trs.signatures less than sender.multimin', function () {
			sender = { multisignatures: [1, 2, 3], multimin: 2 };
			trs = { signatures: [1] };
			result = vote.ready(trs, sender);
			expect(result).to.equals(false);
		});
	});
});
