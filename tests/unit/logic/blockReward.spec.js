var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var {BlockRewardLogic} = require('../../../logic/blockReward.ts');
var constants = require(path.join(rootDir, "helpers/constants")).default;

describe("logic/blockReward", function() {
	var instance;

	beforeEach(function() {
		instance = new BlockRewardLogic();
	});

	describe("constructor", function() {
		it("should be a function", function(done) {
			expect(BlockRewardLogic).to.be.a("function");
			done();
		});
		it("should be an instance of blockReward", function(done) {
			expect(instance).to.be.an.instanceOf(BlockRewardLogic);
			expect(instance.rewards).to.be.deep.equal(constants.rewards);
			done();
		});
	});

	describe("private.parseHeight", function() {
		it("returns error", function() {
			expect(() => instance.parseHeight('string')).to.throw("Invalid block height");
		});

		it("returns success", function() {
      expect(instance.parseHeight(1237)).to.eq(1237);
		});
	});

	describe("calcMilestone", function() {
		it("parseHeight is called", function() {
			var parseHeight = sinon.stub(instance, "parseHeight").returns(1);

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
			const calcMilestone = sinon.stub(instance, 'calcMilestone').returns(0);

			instance.calcReward(10);

			expect(calcMilestone.calledOnce).to.be.true;
			expect(calcMilestone.getCall(0).args.length).to.equal(1);
			expect(calcMilestone.getCall(0).args[0]).to.equal(10);

		});
	});

	describe("calcSupply", function() {

		it("parseHeight is called", function() {
			const parseHeight = sinon.stub(instance, 'parseHeight').returns(10);
			instance.calcSupply(10);

			expect(parseHeight.getCall(0).args.length).to.equal(1);
			expect(parseHeight.getCall(0).args[0]).to.equal(10);
		});

		it("calcMilestone is called", function() {
      const calcMilestone = sinon.stub(instance, 'calcMilestone').returns(1);
			instance.calcSupply(1);

			expect(calcMilestone.getCall(0).args.length).to.equal(1);
			expect(calcMilestone.getCall(0).args[0]).to.equal(1);
		});

		const tests = [
			{height: 10, supply: 11000001491000000},
			{height: 11, supply: 11000001491000000 + 30000000},
			{height: 12, supply: 11000001491000000 + 30000000 + 20000000},
			{height: 13, supply: 11000001491000000 + 30000000 + 20000000 + 1500000000},
			{height: 100, supply: 11000001491000000 + 30000000 + 20000000 + 1500000000 * (100-12)},

		];
		tests.forEach((supplyTest) => {
			it(`Correct supply for height ${supplyTest.height}`, () => {

        expect(instance.calcSupply(supplyTest.height)).to.equal(supplyTest.supply);
			});
		});

	});
});
