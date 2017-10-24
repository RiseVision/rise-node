var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var Round = rewire(path.join(rootDir, "logic/round"));

describe("logic/logic", function() {
	var instance, scope, callback, clock, task;

	beforeEach(function() {
		scope = {
			backwards: false,
			round: {},
			roundOutsiders: ["1", "2", "3"],
			roundDelegates: [{}],
			roundFees: {},
			roundRewards: {},
			library: {
				logger: {
					debug: sinon.stub(),
					trace: sinon.stub()
				}
			},
			modules: {
				accounts: {
					mergeAccountAndGet: sinon.stub().returns("yes"),
					generateAddressByPublicKey: sinon.stub().returns(1)
				}
			},
			block: {
				generatorPublicKey: "carbonara",
				id: "was",
				height: "here"
			}
		};
		callback = sinon.stub();
		task = {
			none: sinon.stub().returns("it works!"),
			query: sinon.stub().returns("query works!")
		};
		instance = new Round(scope, task);
	});

	describe("constructor", function() {
		it("should be a function", function() {
			expect(Round).to.be.a("function");
		});

		it("throws error when a property is missing", function() {
			var scopeOriginal = Object.assign({}, scope);
			var requiredProperties = [
				"library",
				"modules",
				"block",
				"round",
				"backwards"
			];

			requiredProperties.forEach(function(prop) {
				scope = Object.assign({}, scopeOriginal);

				delete scope[prop];
				var throwError = function() {
					new Round(scope, callback);
				};
				expect(throwError).to.throw();
			});
		});
		it("finishRound throws error, missing requiredPorperty", function() {
			scope.finishRound = true;
			var scopeOriginal = Object.assign({}, scope);
			var requiredProperties = [
				"library",
				"modules",
				"block",
				"round",
				"backwards",
				"roundFees",
				"roundRewards",
				"roundDelegates",
				"roundOutsiders"
			];

			requiredProperties.forEach(function(prop) {
				scope = Object.assign({}, scopeOriginal);

				delete scope[prop];
				var throwError = function() {
					new Round(scope, callback);
				};
				expect(throwError).to.throw();
			});
		});
		it("success", function() {
			expect(instance.scope).to.deep.equal(scope);
			expect(instance.t).to.deep.equal(task);
		});
	});

	describe("mergeBlockGenerator", function() {
		it("none and mergeAccountAndGet are called", function() {
			instance.mergeBlockGenerator();

			expect(task.none.calledOnce).to.equal(true);
			expect(scope.modules.accounts.mergeAccountAndGet.calledOnce).to.equal(true);
			expect(
				scope.modules.accounts.mergeAccountAndGet.firstCall.args[0]
			).to.deep.equal({
				publicKey: scope.block.generatorPublicKey,
				producedblocks: scope.backwards ? -1 : 1,
				blockId: scope.block.id,
				round: scope.round
			});
		});
	});

	describe("updateMissedBlocks", function() {
		it("returns task", function() {
			scope.roundOutsiders = [];
			var instanceTest = new Round(scope, task);
			var retVal = instanceTest.updateMissedBlocks();

			expect(retVal).to.deep.equal(task);
			expect(task.none.notCalled).to.equal(true);
		});

		it("returns response from updateMissedBlocks", function() {
			var sql = Round.__get__("sql");
			var updateMissedBlocks = sinon.stub(sql, "updateMissedBlocks").returns(true);
			var retVal = instance.updateMissedBlocks();

			expect(task.none.calledOnce).to.equal(true);
			expect(task.none.firstCall.args.length).to.equal(2);
			expect(task.none.firstCall.args[0]).to.equal(true);
			expect(task.none.firstCall.args[1]).to.deep.equal([scope.roundOutsiders]);
			expect(updateMissedBlocks.calledOnce).to.equal(true);
			expect(updateMissedBlocks.firstCall.args.length).to.equal(1);
			expect(updateMissedBlocks.firstCall.args[0]).to.deep.equal(scope.backwards);
			expect(retVal).to.equal("it works!");

			updateMissedBlocks.restore();
		});
	});

	describe("getVotes", function() {
		it("returns response from updateMissedBlocks", function() {
			var retVal = instance.getVotes();

			expect(task.query.calledOnce).to.equal(true);
			expect(task.query.firstCall.args.length).to.equal(2);
			expect(task.query.firstCall.args[0]).to.equal(
				'SELECT d."delegate", d."amount" FROM (SELECT m."delegate", SUM(m."amount") AS "amount", "round" FROM mem_round m GROUP BY m."delegate", m."round") AS d WHERE "round" = (${round})::bigint'
			);
			expect(task.query.firstCall.args[1]).to.deep.equal({ round: scope.round });
			expect(retVal).to.equal("query works!");
		});
	});

	describe("updateVotes", function() {
		it("getVotes is called", function(done) {
			var pgpOriginal = Round.__get__("pgp");
			var updateVotes =
				'UPDATE mem_accounts SET "vote" = "vote" + (${amount})::bigint WHERE "address" = ${address};';
			var pgp = {
				as: {
					format: sinon.stub().returns([updateVotes])
				}
			};
			Round.__set__("pgp", pgp);
			var getVotes = sinon.stub(instance, "getVotes").resolves([
				{
					delegate: "carbonara",
					amount: "10"
				}
			]);
			var expectedParam = {
				address: 1,
				amount: 10
			};

			var retVal = instance.updateVotes();
			expect(getVotes.calledOnce).to.equal(true);
			setTimeout(function() {
				expect(pgp.as.format.calledOnce).to.equal(true);
				expect(pgp.as.format.firstCall.args.length).to.equal(2);
				expect(pgp.as.format.firstCall.args[0]).to.equal(updateVotes);
				expect(pgp.as.format.firstCall.args[1]).to.deep.equal(expectedParam);

				expect(task.none.calledOnce).to.equal(true);
				expect(task.none.firstCall.args.length).to.equal(1);
				expect(task.none.firstCall.args[0]).to.equal(
					'UPDATE mem_accounts SET "vote" = "vote" + (${amount})::bigint WHERE "address" = ${address};'
				);

				expect(retVal).to.deep.equal({});

				Round.__set__("pgp", pgpOriginal);
				getVotes.restore();

				done();
			}, 0);
		});
		it("getVotes is called", function(done) {
			var pgpOriginal = Round.__get__("pgp");
			var updateVotes =
				'UPDATE mem_accounts SET "vote" = "vote" + (${amount})::bigint WHERE "address" = ${address};';
			var pgp = {
				as: {
					format: sinon.stub().returns([])
				}
			};
			Round.__set__("pgp", pgp);
			var getVotes = sinon.stub(instance, "getVotes").resolves([
				{
					delegate: "carbonara",
					amount: "10"
				}
			]);
			var expectedParam = {
				address: 1,
				amount: 10
			};

			var retVal = instance.updateVotes();
			expect(getVotes.calledOnce).to.equal(true);
			setTimeout(function() {
				expect(pgp.as.format.calledOnce).to.equal(true);
				expect(pgp.as.format.firstCall.args.length).to.equal(2);
				expect(pgp.as.format.firstCall.args[0]).to.equal(updateVotes);
				expect(pgp.as.format.firstCall.args[1]).to.deep.equal(expectedParam);

				expect(task.none.calledOnce).to.equal(false);

				expect(retVal).to.deep.equal({});

				Round.__set__("pgp", pgpOriginal);
				getVotes.restore();

				done();
			}, 0);
		});
	});

	describe("markBlockId", function() {
		it("calls task.none", function() {
			var updateBlockId =
				'UPDATE mem_accounts SET "blockId" = ${newId} WHERE "blockId" = ${oldId};';
			scope.backwards = true;

			var instanceTest = new Round(scope, task);
			var retVal = instanceTest.markBlockId();

			expect(task.none.calledOnce).to.be.true;
			expect(task.none.firstCall.args.length).to.equal(2);
			expect(task.none.firstCall.args[0]).to.equal(updateBlockId);
			expect(task.none.firstCall.args[1]).to.deep.equal({
				oldId: scope.block.id,
				newId: "0"
			});
			expect(retVal).to.equal("it works!");
		});
		it("returns task", function() {
			var retVal = instance.markBlockId();
			expect(retVal).to.deep.equal(task);
		});
	});

	describe("truncateBlocks", function() {
		it("calls task.none", function() {
			var truncateBlocks =
				'DELETE FROM blocks WHERE "height" > (${height})::bigint;';
			scope.backwards = true;

			var instanceTest = new Round(scope, task);
			var retVal = instanceTest.truncateBlocks();

			expect(task.none.calledOnce).to.be.true;
			expect(task.none.firstCall.args.length).to.equal(2);
			expect(task.none.firstCall.args[0]).to.equal(truncateBlocks);
			expect(task.none.firstCall.args[1]).to.deep.equal({
				height: scope.block.height
			});
			expect(retVal).to.equal("it works!");
		});
	});

	describe("restoreRoundSnapshot", function() {
		it("calls task.none", function() {
			var restoreRoundSnapshot =
				"INSERT INTO mem_round SELECT * FROM mem_round_snapshot";
			scope.backwards = true;

			var instanceTest = new Round(scope, task);
			var retVal = instanceTest.restoreRoundSnapshot();

			expect(scope.library.logger.debug.calledOnce).to.be.true;
			expect(scope.library.logger.debug.firstCall.args.length).to.equal(1);
			expect(scope.library.logger.debug.firstCall.args[0]).to.equal(
				"Restoring mem_round snapshot..."
			);

			expect(task.none.calledOnce).to.be.true;
			expect(task.none.firstCall.args.length).to.equal(1);
			expect(task.none.firstCall.args[0]).to.equal(restoreRoundSnapshot);
			expect(retVal).to.equal("it works!");
		});
	});

	describe("restoreVotesSnapshot", function() {
		it("calls task.none", function() {
			var restoreVotesSnapshot =
				"UPDATE mem_accounts m SET vote = b.vote FROM mem_votes_snapshot b WHERE m.address = b.address";
			scope.backwards = true;

			var instanceTest = new Round(scope, task);
			var retVal = instanceTest.restoreVotesSnapshot();

			expect(scope.library.logger.debug.calledOnce).to.be.true;
			expect(scope.library.logger.debug.firstCall.args.length).to.equal(1);
			expect(scope.library.logger.debug.firstCall.args[0]).to.equal(
				"Restoring mem_accounts.vote snapshot..."
			);

			expect(task.none.calledOnce).to.be.true;
			expect(task.none.firstCall.args.length).to.equal(1);
			expect(task.none.firstCall.args[0]).to.equal(restoreVotesSnapshot);
			expect(retVal).to.equal("it works!");
		});
	});

	describe("applyRound", function() {
		it("Applies round changes to each delegate backwards false, fees > 0", function() {
			var roundChangesOriginal = Round.__get__("RoundChanges");
			var at = sinon.stub().returns({
				feesRemaining: 10
			});
			var RoundChanges = function() {
				return { at: at };
			};
			Round.__set__("RoundChanges", RoundChanges);

			var retVal = instance.applyRound();

			expect(at.calledTwice).to.be.true;
			expect(at.firstCall.args.length).to.equal(1);
			expect(at.firstCall.args[0]).to.equal(0);
			expect(at.secondCall.args[0]).to.equal(0);
			expect(scope.library.logger.trace.calledThrice).to.be.true;
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
				"Delegate changes"
			);
			expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
				delegate: {},
				changes: {
					feesRemaining: 10
				}
			});
			expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
				"Fees remaining"
			);
			expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal({
				index: 0,
				delegate: {},
				fees: 10
			});
			expect(scope.library.logger.trace.thirdCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.thirdCall.args[0]).to.be.equal(
				"Applying round"
			);
			expect(scope.library.logger.trace.thirdCall.args[1]).to.deep.equal([
				"yes",
				"yes"
			]);
			expect(retVal).to.equal("it works!");
			expect(task.none.calledOnce).to.be.true;
			expect(task.none.firstCall.args.length).to.equal(1);
			expect(task.none.firstCall.args[0]).to.equal("yesyes");

			Round.__set__("RoundChanges", roundChangesOriginal);
		});
		it("no delegates backwards false, fees > 0", function() {
			var roundChangesOriginal = Round.__get__("RoundChanges");
			var at = sinon.stub().returns({
				feesRemaining: 10
			});
			var RoundChanges = function() {
				return { at: at };
			};

			Round.__set__("RoundChanges", RoundChanges);
			scope.roundDelegates = [];

			var instance = new Round(scope, task);
			var retVal = instance.applyRound();

			expect(at.calledOnce).to.be.true;
			expect(at.firstCall.args.length).to.equal(1);
			expect(at.firstCall.args[0]).to.equal(-1);
			expect(scope.library.logger.trace.calledTwice).to.be.true;
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
				"Fees remaining"
			);
			expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
				index: -1,
				delegate: undefined,
				fees: 10
			});
			expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
				"Applying round"
			);
			expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal(["yes"]);
			expect(retVal).to.equal("it works!");
			expect(task.none.calledOnce).to.be.true;
			expect(task.none.firstCall.args.length).to.equal(1);
			expect(task.none.firstCall.args[0]).to.equal("yes");

			Round.__set__("RoundChanges", roundChangesOriginal);
		});
		it("Applies round changes to each delegate backwards false, fees = 0", function() {
			var roundChangesOriginal = Round.__get__("RoundChanges");
			var at = sinon.stub().returns({
				feesRemaining: 0
			});
			var RoundChanges = function() {
				return { at: at };
			};
			Round.__set__("RoundChanges", RoundChanges);

			var retVal = instance.applyRound();

			expect(at.calledTwice).to.be.true;
			expect(at.firstCall.args.length).to.equal(1);
			expect(at.firstCall.args[0]).to.equal(0);
			expect(at.secondCall.args[0]).to.equal(0);
			expect(scope.library.logger.trace.calledTwice).to.be.true;
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
				"Delegate changes"
			);
			expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
				delegate: {},
				changes: {
					feesRemaining: 0
				}
			});
			expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
				"Applying round"
			);
			expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal(["yes"]);
			expect(retVal).to.equal("it works!");
			expect(task.none.calledOnce).to.be.true;
			expect(task.none.firstCall.args.length).to.equal(1);
			expect(task.none.firstCall.args[0]).to.equal("yes");

			Round.__set__("RoundChanges", roundChangesOriginal);
		});
		it("no delegates backwards false, fees = 0", function() {
			var roundChangesOriginal = Round.__get__("RoundChanges");
			var at = sinon.stub().returns({
				feesRemaining: 0
			});
			var RoundChanges = function() {
				return { at: at };
			};

			Round.__set__("RoundChanges", RoundChanges);
			scope.roundDelegates = [];

			var instance = new Round(scope, task);
			var retVal = instance.applyRound();

			expect(at.calledOnce).to.be.true;
			expect(at.firstCall.args.length).to.equal(1);
			expect(at.firstCall.args[0]).to.equal(-1);
			expect(scope.library.logger.trace.calledOnce).to.be.true;
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
				"Applying round"
			);
			expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal([]);
			expect(retVal).to.deep.equal(task);

			Round.__set__("RoundChanges", roundChangesOriginal);
		});

		it("Applies round changes to each delegate backwards true, fees > 0", function() {
			var roundChangesOriginal = Round.__get__("RoundChanges");
			var at = sinon.stub().returns({
				feesRemaining: 10
			});
			var RoundChanges = function() {
				return { at: at };
			};
			Round.__set__("RoundChanges", RoundChanges);
			scope.backwards = true;

			var instance = new Round(scope, task);
			var retVal = instance.applyRound();

			expect(at.calledTwice).to.be.true;
			expect(at.firstCall.args.length).to.equal(1);
			expect(at.firstCall.args[0]).to.equal(0);
			expect(at.secondCall.args[0]).to.equal(0);
			expect(scope.library.logger.trace.calledThrice).to.be.true;
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
				"Delegate changes"
			);
			expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
				delegate: {},
				changes: {
					feesRemaining: 10
				}
			});
			expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
				"Fees remaining"
			);
			expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal({
				index: 0,
				delegate: {},
				fees: -10
			});
			expect(scope.library.logger.trace.thirdCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.thirdCall.args[0]).to.be.equal(
				"Applying round"
			);
			expect(scope.library.logger.trace.thirdCall.args[1]).to.deep.equal([
				"yes",
				"yes"
			]);
			expect(retVal).to.equal("it works!");
			expect(task.none.calledOnce).to.be.true;
			expect(task.none.firstCall.args.length).to.equal(1);
			expect(task.none.firstCall.args[0]).to.equal("yesyes");

			Round.__set__("RoundChanges", roundChangesOriginal);
		});
		it("no delegates backwards true, fees > 0", function() {
			var roundChangesOriginal = Round.__get__("RoundChanges");
			var at = sinon.stub().returns({
				feesRemaining: 10
			});
			var RoundChanges = function() {
				return { at: at };
			};

			Round.__set__("RoundChanges", RoundChanges);
			scope.roundDelegates = [];
			scope.backwards = true;

			var instance = new Round(scope, task);
			var retVal = instance.applyRound();

			expect(at.calledOnce).to.be.true;
			expect(at.firstCall.args.length).to.equal(1);
			expect(at.firstCall.args[0]).to.equal(0);
			expect(scope.library.logger.trace.calledTwice).to.be.true;
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
				"Fees remaining"
			);
			expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
				index: 0,
				delegate: undefined,
				fees: -10
			});
			expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
				"Applying round"
			);
			expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal(["yes"]);
			expect(retVal).to.equal("it works!");
			expect(task.none.calledOnce).to.be.true;
			expect(task.none.firstCall.args.length).to.equal(1);
			expect(task.none.firstCall.args[0]).to.equal("yes");

			Round.__set__("RoundChanges", roundChangesOriginal);
		});
		it("Applies round changes to each delegate backwards true, fees = 0", function() {
			var roundChangesOriginal = Round.__get__("RoundChanges");
			var at = sinon.stub().returns({
				feesRemaining: 0
			});
			var RoundChanges = function() {
				return { at: at };
			};
			Round.__set__("RoundChanges", RoundChanges);
			scope.backwards = true;

			var instance = new Round(scope, task);
			var retVal = instance.applyRound();

			expect(at.calledTwice).to.be.true;
			expect(at.firstCall.args.length).to.equal(1);
			expect(at.firstCall.args[0]).to.equal(0);
			expect(at.secondCall.args[0]).to.equal(0);
			expect(scope.library.logger.trace.calledTwice).to.be.true;
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
				"Delegate changes"
			);
			expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
				delegate: {},
				changes: {
					feesRemaining: 0
				}
			});
			expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
				"Applying round"
			);
			expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal(["yes"]);
			expect(retVal).to.equal("it works!");
			expect(task.none.calledOnce).to.be.true;
			expect(task.none.firstCall.args.length).to.equal(1);
			expect(task.none.firstCall.args[0]).to.equal("yes");

			Round.__set__("RoundChanges", roundChangesOriginal);
		});
		it("no delegates backwards true, fees = 0", function() {
			var roundChangesOriginal = Round.__get__("RoundChanges");
			var at = sinon.stub().returns({
				feesRemaining: 0
			});
			var RoundChanges = function() {
				return { at: at };
			};

			Round.__set__("RoundChanges", RoundChanges);
			scope.roundDelegates = [];
			scope.backwards = true;

			var instance = new Round(scope, task);
			var retVal = instance.applyRound();

			expect(at.calledOnce).to.be.true;
			expect(at.firstCall.args.length).to.equal(1);
			expect(at.firstCall.args[0]).to.equal(0);
			expect(scope.library.logger.trace.calledOnce).to.be.true;
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
			expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
				"Applying round"
			);
			expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal([]);
			expect(retVal).to.deep.equal(task);

			Round.__set__("RoundChanges", roundChangesOriginal);
		});
	});

	describe("land", function(done) {
		it("returns this.t", function() {
			var updateVotes = sinon.stub(instance, "updateVotes").resolves(true);
			var updateMissedBlocks = sinon
				.stub(instance, "updateMissedBlocks")
				.resolves(true);
			var flushRound = sinon.stub(instance, "flushRound").resolves(true);
			var applyRound = sinon.stub(instance, "applyRound").resolves(true);

			var retVal = instance.land();

			setTimeout(function() {
				expect(updateVotes.calledTwice).to.equal.true;
				expect(updateMissedBlocks.calledOnce).to.equal.true;
				expect(flushRound.calledTwice).to.equal.true;
				expect(applyRound.calledOnce).to.equal.true;
				expect(retVal).to.deep.equal(task);

				updateVotes.restore();
				updateMissedBlocks.restore();
				flushRound.restore();
				applyRound.restore();
				done();
			}, 0);
		});
	});

	describe("backwardLand", function(done) {
		it("returns this.t", function() {
			var updateVotes = sinon.stub(instance, "updateVotes").resolves(true);
			var updateMissedBlocks = sinon
				.stub(instance, "updateMissedBlocks")
				.resolves(true);
			var flushRound = sinon.stub(instance, "flushRound").resolves(true);
			var applyRound = sinon.stub(instance, "applyRound").resolves(true);
			var restoreRoundSnapshot = sinon
				.stub(instance, "restoreRoundSnapshot")
				.resolves(true);

			var retVal = instance.land();

			setTimeout(function() {
				expect(updateVotes.calledTwice).to.equal.true;
				expect(updateMissedBlocks.calledOnce).to.equal.true;
				expect(flushRound.calledTwice).to.equal.true;
				expect(applyRound.calledOnce).to.equal.true;
				expect(restoreRoundSnapshot.calledTwice).to.equal.true;
				expect(retVal).to.deep.equal(task);

				updateVotes.restore();
				updateMissedBlocks.restore();
				flushRound.restore();
				applyRound.restore();
				restoreRoundSnapshot.restore();

				done();
			}, 0);
		});
	});
});
