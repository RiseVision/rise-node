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
    instance = new BlockReward;
  });

  describe("constructor", function() {
    it("should be a function", function(done) {
      expect(BlockReward).to.be.a('function');
      done()
    });
    it("should be an instance of blockReward", function(done) {

      expect(instance).to.be.an.instanceOf(BlockReward);
      expect(instance.rewards).to.be.deep.equal(constants.rewards);
      done()
    });
  });

  describe("private.parseHeight", function() {

    it("returns error", function() {
      var throwError = function() {
        BlockReward.__get__("__private").parseHeight('string');
      };

      expect(throwError).to.throw('Invalid block height');
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

      var parseHeight = sinon.stub().returns(1);
      BlockReward.__set__('__private.parseHeight', parseHeight);

      instance.calcMilestone(10);

      expect(parseHeight.calledOnce).to.be.true;
      expect(parseHeight.getCall(0).args.length).to.equal(1);
      expect(parseHeight.getCall(0).args[0]).to.equal(10);

      BlockReward.__get__('__private').parseHeight.reset();

    });

    it("correct block height", function() {

      expect(instance.calcMilestone(1)).to.equal(0);

    });

  });

  describe("calcReward", function() {

    it("calcMilestone is called", function() {

      var calcMilestone = sinon.stub().returns(1);
      BlockReward.__set__('BlockReward.prototype.calcMilestone', calcMilestone);

      instance.calcReward(10);

      expect(calcMilestone.calledOnce).to.be.true;
      expect(calcMilestone.getCall(0).args.length).to.equal(1);
      expect(calcMilestone.getCall(0).args[0]).to.equal(10);

    });

  });

  describe("calcSupply", function() {

    var parseHeight, calcMilestone, mockedThis;


    beforeEach(function() {
      parseHeight = sinon.stub().returns(1);
      calcMilestone = sinon.stub().returns(0);
      mockedThis = {
        calcMilestone: calcMilestone,
        rewards: constants.rewards
      };

      BlockReward.__set__('__private.parseHeight', parseHeight);
      BlockReward.__set__('this.calcMilestone', calcMilestone);
    });

    afterEach(function() {
      BlockReward.__get__('__private').parseHeight.reset();
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

      expect(instance.calcSupply(10)).to.equal(10999987991000000);

    });

  });

});
