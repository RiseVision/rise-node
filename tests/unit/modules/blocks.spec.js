var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var constants = require(path.join(rootDir, "helpers/constants"));
var blocksModule = rewire(path.join(rootDir, "modules/blocks"));

describe("modules/blocks", function() {
  var __private = blocksModule.__get__("__private");

  var sandbox;

  var blocks;
  var entityCallback;

  var blocksAPI;
  var blocksVerify;
  var blocksProcess;
  var blocksUtils;
  var blocksChain;

  var blocksAPIEntity = {};
  var blocksVerifyEntity = {};
  var blocksProcessEntity = {};
  var blocksUtilsEntity = {};
  var blocksChainEntity = {
    saveGenesisBlock: function() {}
  };

  var scope = {
    logger: {
      info: function() {}
    },
    db: {},
    logic: {
      block: {},
      transaction: {},
      peers: {}
    },
    schema: {},
    sequence: {},
    dbSequence: {},
    genesisblock: {},
    bus: {},
    balancesSequence: {}
  };

  before(function() {
    sandbox = sinon.sandbox.create({
      injectInto: null,
      properties: ["spy", "stub", "clock"],
      useFakeTimers: true,
      useFakeServer: false
    });

    blocksAPI = sandbox.stub();
    blocksVerify = sandbox.stub();
    blocksProcess = sandbox.stub();
    blocksUtils = sandbox.stub();
    blocksChain = sandbox.stub();

    blocksModule.__set__("blocksAPI", blocksAPI);
    blocksModule.__set__("blocksVerify", blocksVerify);
    blocksModule.__set__("blocksProcess", blocksProcess);
    blocksModule.__set__("blocksUtils", blocksUtils);
    blocksModule.__set__("blocksChain", blocksChain);
  });

  beforeEach(function() {
    blocksAPI.returns(blocksAPIEntity);
    blocksVerify.returns(blocksVerifyEntity);
    blocksProcess.returns(blocksProcessEntity);
    blocksUtils.returns(blocksUtilsEntity);
    blocksChain.returns(blocksChainEntity);

    blocksChainEntity.saveGenesisBlock = sandbox.stub().callsArgWith(0, null);
    entityCallback = sandbox.stub();
    scope.logger.info = sandbox.stub();
    blocks = new blocksModule(entityCallback, scope);
    sandbox.clock.tick();
    blocksModule.__set__("setImmediate", setImmediate);
    blocksModule.__set__("setTimeout", setTimeout);
  });

  afterEach(function() {
    sandbox.reset();
  });

  describe("constructor", function() {
    it("blocksAPI creation", function() {
      expect(blocksAPI.calledOnce).to.be.true;
      expect(blocksAPI.calledWithNew()).to.be.true;
      expect(blocksAPI.getCall(0).args.length).to.equal(5);
      expect(blocksAPI.getCall(0).args[0]).to.equal(scope.logger);
      expect(blocksAPI.getCall(0).args[1]).to.equal(scope.db);
      expect(blocksAPI.getCall(0).args[2]).to.equal(scope.logic.block);
      expect(blocksAPI.getCall(0).args[3]).to.equal(scope.schema);
      expect(blocksAPI.getCall(0).args[4]).to.equal(scope.dbSequence);

      expect(blocks).to.have.property("submodules");

      expect(blocks.submodules).to.have.property("api");
      expect(blocks.submodules.api).to.equal(blocksAPIEntity);

      expect(blocks).to.have.property("shared");
      expect(blocks.shared).to.equal(blocksAPIEntity);
    });

    it("blocksVerify creation", function() {
      expect(blocksVerify.calledOnce).to.be.true;
      expect(blocksVerify.calledWithNew()).to.be.true;
      expect(blocksVerify.getCall(0).args.length).to.equal(4);
      expect(blocksVerify.getCall(0).args[0]).to.equal(scope.logger);
      expect(blocksVerify.getCall(0).args[1]).to.equal(scope.logic.block);
      expect(blocksVerify.getCall(0).args[2]).to.equal(scope.logic.transaction);
      expect(blocksVerify.getCall(0).args[3]).to.equal(scope.db);

      expect(blocks).to.have.property("submodules");

      expect(blocks.submodules).to.have.property("verify");
      expect(blocks.submodules.verify).to.equal(blocksVerifyEntity);

      expect(blocks).to.have.property("verify");
      expect(blocks.verify).to.equal(blocksVerifyEntity);
    });

    it("blocksProcess creation", function() {
      expect(blocksProcess.calledOnce).to.be.true;
      expect(blocksProcess.calledWithNew()).to.be.true;
      expect(blocksProcess.getCall(0).args.length).to.equal(9);
      expect(blocksProcess.getCall(0).args[0]).to.equal(scope.logger);
      expect(blocksProcess.getCall(0).args[1]).to.equal(scope.logic.block);
      expect(blocksProcess.getCall(0).args[2]).to.equal(scope.logic.peers);
      expect(blocksProcess.getCall(0).args[3]).to.equal(
        scope.logic.transaction
      );
      expect(blocksProcess.getCall(0).args[4]).to.equal(scope.schema);
      expect(blocksProcess.getCall(0).args[5]).to.equal(scope.db);
      expect(blocksProcess.getCall(0).args[6]).to.equal(scope.dbSequence);
      expect(blocksProcess.getCall(0).args[7]).to.equal(scope.sequence);
      expect(blocksProcess.getCall(0).args[8]).to.equal(scope.genesisblock);

      expect(blocks).to.have.property("submodules");

      expect(blocks.submodules).to.have.property("process");
      expect(blocks.submodules.process).to.equal(blocksProcessEntity);

      expect(blocks).to.have.property("process");
      expect(blocks.process).to.equal(blocksProcessEntity);
    });

    it("blocksUtils creation", function() {
      expect(blocksUtils.calledOnce).to.be.true;
      expect(blocksUtils.calledWithNew()).to.be.true;
      expect(blocksUtils.getCall(0).args.length).to.equal(6);
      expect(blocksUtils.getCall(0).args[0]).to.equal(scope.logger);
      expect(blocksUtils.getCall(0).args[1]).to.equal(scope.logic.block);
      expect(blocksUtils.getCall(0).args[2]).to.equal(scope.logic.transaction);
      expect(blocksUtils.getCall(0).args[3]).to.equal(scope.db);
      expect(blocksUtils.getCall(0).args[4]).to.equal(scope.dbSequence);
      expect(blocksUtils.getCall(0).args[5]).to.equal(scope.genesisblock);

      expect(blocks).to.have.property("submodules");

      expect(blocks.submodules).to.have.property("utils");
      expect(blocks.submodules.utils).to.equal(blocksUtilsEntity);

      expect(blocks).to.have.property("utils");
      expect(blocks.utils).to.equal(blocksUtilsEntity);
    });

    it("blocksChain creation", function() {
      expect(blocksChain.calledOnce).to.be.true;
      expect(blocksChain.calledWithNew()).to.be.true;
      expect(blocksChain.getCall(0).args.length).to.equal(7);
      expect(blocksChain.getCall(0).args[0]).to.equal(scope.logger);
      expect(blocksChain.getCall(0).args[1]).to.equal(scope.logic.block);
      expect(blocksChain.getCall(0).args[2]).to.equal(scope.logic.transaction);
      expect(blocksChain.getCall(0).args[3]).to.equal(scope.db);
      expect(blocksChain.getCall(0).args[4]).to.equal(scope.genesisblock);
      expect(blocksChain.getCall(0).args[5]).to.equal(scope.bus);
      expect(blocksChain.getCall(0).args[6]).to.equal(scope.balancesSequence);

      expect(blocks).to.have.property("submodules");

      expect(blocks.submodules).to.have.property("utils");
      expect(blocks.submodules.chain).to.equal(blocksChainEntity);

      expect(blocks).to.have.property("chain");
      expect(blocks.chain).to.equal(blocksChainEntity);
    });

    it("callback", function() {
      expect(blocksChainEntity.saveGenesisBlock.calledOnce).to.be.true;
      expect(
        blocksChainEntity.saveGenesisBlock.getCall(0).args.length
      ).to.equal(1);
      expect(blocksChainEntity.saveGenesisBlock.getCall(0).args[0]).to.be.a(
        "function"
      );

      expect(entityCallback.calledOnce).to.be.true;
      expect(entityCallback.getCall(0).args.length).to.equal(2);
      expect(entityCallback.getCall(0).args[0]).to.be.null;
      expect(entityCallback.getCall(0).args[1]).to.equal(blocks);
      expect(entityCallback.getCall(0).args[1]).to.be.instanceof(blocksModule);
    });
  });

  describe("blocks.lastBlock", function() {
    it("get", function() {
      var lastBlock = blocks.lastBlock.get();

      expect(lastBlock).to.equal(__private.lastBlock);
    });

    it("set", function() {
      var newLastBlock = {};
      var lastBlock = blocks.lastBlock.set(newLastBlock);

      expect(lastBlock).to.equal(newLastBlock);
      expect(lastBlock).to.equal(__private.lastBlock);
    });

    it("isFresh returns false", function() {
      sandbox.clock.restore();

      __private.lastBlock = {
        timestamp: 0
      };

      var isFresh = blocks.lastBlock.isFresh();
      expect(isFresh).to.be.false;

      sandbox.clock = sinon.useFakeTimers();
    });

    it("isFresh returns true", function() {
      sandbox.clock.restore();

      __private.lastBlock = {
        timestamp:
          Math.floor(Date.now() / 1000) - Math.floor(constants.epochTime / 1000)
      };

      var isFresh = blocks.lastBlock.isFresh();
      expect(isFresh).to.be.true;

      sandbox.clock = sinon.useFakeTimers();
    });
  });

  describe("blocks.lastReceipt", function() {
    it("get", function() {
      var lastReceipt = blocks.lastReceipt.get();

      expect(lastReceipt).to.equal(__private.lastReceipt);
    });

    it("upadte", function() {
      var lastReceipt = blocks.lastReceipt.update();

      expect(lastReceipt).to.equal(__private.lastReceipt);
      expect(lastReceipt).to.not.be.above(Math.floor(Date.now() / 1000));
    });

    it("isStale true", function() {
      sandbox.clock.restore();

      var isStale = blocks.lastReceipt.isStale();

      expect(isStale).to.be.true;

      sandbox.clock = sinon.useFakeTimers();
    });

    it("isStale false", function() {
      sandbox.clock.restore();

      blocks.lastReceipt.update();
      var isStale = blocks.lastReceipt.isStale();

      expect(isStale).to.be.false;

      sandbox.clock = sinon.useFakeTimers();
    });
  });

  describe("blocks.isActive", function() {
    it("get", function() {
      var isActive = blocks.isActive.get();

      expect(isActive).to.equal(__private.isActive);
    });

    it("set", function() {
      var newIsActive = {};
      var isActive = blocks.isActive.set(newIsActive);

      expect(isActive).to.equal(newIsActive);
      expect(isActive).to.equal(__private.isActive);
    });
  });

  describe("blocks.isCleaning", function() {
    it("get", function() {
      var isCleaning = blocks.isCleaning.get();

      expect(isCleaning).to.equal(__private.cleanup);
    });
  });

  describe("blocks.sandboxApi", function() {
    it("sandbox.callMethod", function() {
      var call = "method";
      var args = [];
      var callback = function() {};

      var sandboxHelper = blocksModule.__get__("sandboxHelper");

      sandbox.stub(sandboxHelper, "callMethod");

      blocks.sandboxApi(call, args, callback);

      expect(sandboxHelper.callMethod.calledOnce).to.be.true;
      expect(sandboxHelper.callMethod.getCall(0).args.length).to.equal(4);
      expect(sandboxHelper.callMethod.getCall(0).args[0]).to.equal(
        blocksModule.prototype.shared
      );
      expect(sandboxHelper.callMethod.getCall(0).args[1]).to.equal(call);
      expect(sandboxHelper.callMethod.getCall(0).args[2]).to.equal(args);
      expect(sandboxHelper.callMethod.getCall(0).args[3]).to.equal(callback);
    });
  });

  describe("blocks.onBind", function() {
    it("check loaded is changed", function() {
      expect(__private.loaded).to.be.false;
      blocks.onBind({});
      expect(__private.loaded).to.be.true;
    });
  });

  describe("blocks.cleanup", function() {
    it("isActive = false", function() {
      var callback = sandbox.stub();

      __private.isActive = false;
      blocks.cleanup(callback);
      expect(callback.called).to.be.false;
      sandbox.clock.tick();
      expect(callback.calledOnce).to.be.true;
    });

    it("isActive = false, next = true", function() {
      var callback = sandbox.stub();

      __private.isActive = true;
      blocks.cleanup(callback);
      __private.isActive = false;

      expect(callback.called).to.be.false;
      sandbox.clock.tick(2);
      expect(callback.calledOnce).to.be.true;
    });

    it("isActive = false, next wait, next false", function() {
      var callback = sandbox.stub();

      __private.isActive = true;
      blocks.cleanup(callback);
      __private.isActive = true;

      expect(scope.logger.info.called).to.be.false;
      sandbox.clock.tick();
      expect(scope.logger.info.calledOnce).to.be.true;
      expect(scope.logger.info.getCall(0).args.length).to.equal(1);
      expect(scope.logger.info.getCall(0).args[0]).to.equal(
        "Waiting for block processing to finish..."
      );

      __private.isActive = false;
      sandbox.clock.tick(10000);
      expect(callback.called).to.be.false;
      sandbox.clock.tick(1);
      expect(callback.called).to.be.true;
    });
  });

  describe("blocks.isLoaded", function() {
    it("__private.loaded", function() {
      expect(blocks.isLoaded()).to.equal(__private.loaded);
    });
  });
});
