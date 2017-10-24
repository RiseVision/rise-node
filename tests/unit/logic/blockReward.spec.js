var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var BlockReward = rewire(path.join(rootDir, "logic/blockReward"));
var constants = require(path.join(rootDir, "helpers/constants"));

describe("logic/blockReward", function() {
	var instance;

	beforeEach(function() {
		instance = new BlockReward();
	});

	describe("constructor", function() {
		it("should be a function", function(done) {
			expect(BlockReward).to.be.a("function");
			done();
		});
		it("should be an instance of blockReward", function(done) {
			expect(instance).to.be.an.instanceOf(BlockReward);
			expect(instance.rewards).to.be.deep.equal(constants.rewards);
			done();
		});
	});

	describe("private.parseHeight", function() {
		it("returns error", function() {
			var throwError = function() {
				BlockReward.__get__("__private").parseHeight("string");
			};

			expect(throwError).to.throw("Invalid block height");
		});

		it("returns success", function() {
			var result = 1234;

			var parseHeight = function() {
				return BlockReward.__get__("__private").parseHeight(1234);
			};

			expect(parseHeight()).to.equal(result);
		});
	});

	describe("calcMilestone", function() {
		it("parseHeight is called", function() {
			var __private = BlockReward.__get__("__private");
			var parseHeight = sinon.stub(__private, "parseHeight").returns(1);

			instance.calcMilestone(10);

			expect(parseHeight.calledOnce).to.be.true;
			expect(parseHeight.getCall(0).args.length).to.equal(1);
			expect(parseHeight.getCall(0).args[0]).to.equal(10);

			parseHeight.restore();
		});

		it("correct block height", function() {
			expect(instance.calcMilestone(1)).to.equal(0);
		});
	});

	describe("calcReward", function() {
		it("calcMilestone is called", function() {
			var calcMilestone = sinon
				.stub(BlockReward.prototype, "calcMilestone")
				.returns(0);

			instance.calcReward(10);

			expect(calcMilestone.calledOnce).to.be.true;
			expect(calcMilestone.getCall(0).args.length).to.equal(1);
			expect(calcMilestone.getCall(0).args[0]).to.equal(10);

			calcMilestone.restore();
		});
	});

	describe("calcSupply", function() {
		var parseHeight, calcMilestone, mockedThis;

		beforeEach(function() {
			var __private = BlockReward.__get__("__private");
			mockedThis = {
				calcMilestone: function() {},
				rewards: constants.rewards
			};
			parseHeight = sinon.stub(__private, "parseHeight").returns(1);
			calcMilestone = sinon.stub(mockedThis, "calcMilestone").returns(0);

			BlockReward.__set__("__private.parseHeight", parseHeight);
			BlockReward.__set__("this.calcMilestone", calcMilestone);
		});

		afterEach(function() {
			calcMilestone.restore();
			parseHeight.restore();
		});

		it("parseHeight is called", function() {
			instance.calcSupply(10);

			expect(parseHeight.getCall(0).args.length).to.equal(1);
			expect(parseHeight.getCall(0).args[0]).to.equal(10);
		});

		it("calcMilestone is called", function() {
			instance.calcSupply.call(mockedThis, 10);

			expect(calcMilestone.getCall(0).args.length).to.equal(1);
			expect(calcMilestone.getCall(0).args[0]).to.equal(1);
		});

		it("correct supply", function() {
			debugger;
			calcMilestone.restore();
			parseHeight.restore();

			expect(instance.calcSupply(10)).to.equal(11000001491000000);
		});
	});
});
