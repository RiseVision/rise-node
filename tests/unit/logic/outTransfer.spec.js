var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");
var valid_url = require("valid-url");
var sql = require("../../../sql/dapps.js");

var rootDir = path.join(__dirname, "../../..");

var constants = require(path.join(rootDir, "helpers/constants"));
var exceptions = require(path.join(rootDir, "helpers/exceptions"));
var OutTransfer = rewire(path.join(rootDir, "logic/outTransfer"));

describe("modules/dapp", function() {

  var instance,
    callback,
    schema,
    logger,
    db,
    clock,
    trs,
    dapps,
    sender,
    system,
    accounts,
    rounds;

  beforeEach(function() {
    db = {
      one: sinon.stub().resolves(true)
    };
    schema = {};
    logger = {
      error: sinon.stub()
    };

    accounts = {};
    rounds = {};
    dapps = [];
    system = {};

    trs = {
      amount: 100,
      recipientId: 'carbonara',
      asset: {
        outTransfer: {
          dappId: "123",
          transactionId: "1234",
        }
      }
    };
    sender = {
      multisignatures: ["1", "2"]
    };
    clock = sinon.useFakeTimers("setImmediate");
    OutTransfer.__set__("setImmediate", setImmediate);
    callback = sinon.stub();
    instance = new OutTransfer(db, schema, logger);
  });
  afterEach(function() {
    clock.restore();
  });

  describe("constructor", function() {
    it("should be a function", function() {
      expect(OutTransfer).to.be.a("function");
    });

    it("success", function() {
      var expectedLibrary = {
        db: db,
        schema: schema,
        logger: logger,
      };
      var library = OutTransfer.__get__("library");

      expect(library).to.deep.equal(expectedLibrary);
    });
  });

  describe("bind", function() {
    it("binds modules", function() {
      var expectedModules;
      expectedModules = {
        accounts: accounts,
        rounds: rounds,
        dapps: dapps,
        system: system
      };

      instance.bind(accounts, rounds, dapps, system);
      var modules = OutTransfer.__get__("modules");

      expect(modules).to.deep.equal(expectedModules);
    });
  });

  describe("create", function() {
    it("binds modules", function() {
      var data, trs, expectedTrs;
      trs = {
        asset: {}
      };
      data = {
        recipientId: 'carbonara',
        amount: 100,
        dappId: 'dappId',
        transactionId: 'transactionId'
      };
      expectedTrs = {
        recipientId: data.recipientId,
        amount: data.amount,
        asset: {
          outTransfer: {
            dappId: data.dappId,
            transactionId: data.transactionId
          }
        }
      };

      var retVal = instance.create(data, trs);

      expect(retVal).to.deep.equal(expectedTrs);
    });
  });

  describe("calculateFee", function() {
    it("returns correct trs", function() {
      var modules, getFees, height;

      height = 10;
      modules = OutTransfer.__get__("modules");
      modules.system = { getFees: function() {} };
      getFees = sinon.stub(modules.system, "getFees").returns({
        fees: {
          send: 1
        }
      });

      var retVal = instance.calculateFee(null, null, height);

      expect(retVal).to.deep.equal(1);
      expect(getFees.calledOnce).to.be.true;
      expect(getFees.firstCall.args.length).to.equal(1);
      expect(getFees.firstCall.args[0]).to.equal(height);

      getFees.restore();
    });
  });

  describe("verify", function() {

    it("returns 'Invalid recipient'", function() {
      trs.recipientId = false;
      instance.verify(trs, {}, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args.length).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal("Invalid recipient");
    });

    it("returns 'Invalid transaction amount'", function() {

      trs.amount = false;
      instance.verify(trs, {}, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args.length).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal("Invalid transaction amount");
    });

    it("returns 'Invalid transaction asset'", function() {

      delete trs.asset.outTransfer;
      instance.verify(trs, sender, callback);
      clock.tick();

      delete trs.asset;
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledTwice).to.be.true;
      expect(callback.firstCall.args.length).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal("Invalid transaction asset");
      expect(callback.secondCall.args.length).to.equal(1);
      expect(callback.secondCall.args[0]).to.equal("Invalid transaction asset");
    });

    it("returns 'Invalid outTransfer dappId", function() {

      trs.asset.outTransfer.dappId = '....';
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args.length).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal("Invalid outTransfer dappId");
    });

    it("returns 'Invalid outTransfer transactionId", function() {

      trs.asset.outTransfer.transactionId = '....';
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args.length).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal("Invalid outTransfer transactionId");
    });

    it("returns cb with no errors", function() {

      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args.length).to.equal(2);
      expect(callback.firstCall.args[0]).to.equal(null);
      expect(callback.firstCall.args[1]).to.equal(trs);
    });
  });

  describe("process", function() {



    it("catches the rejection from db.query", function(done) {
      db.one.rejects();
      instance.bind(accounts, rounds, dapps, system);
      instance.process(trs, sender, callback);
      expect(db.one.calledOnce).to.be.true;
      expect(db.one.firstCall.args.length).to.equal(2);
      expect(db.one.firstCall.args[0]).to.equal(sql.countByTransactionId);
      expect(db.one.firstCall.args[1]).to.deep.equal({
        id: trs.asset.outTransfer.dappId
      });

      setTimeout(function() {
        clock.tick();
        expect(callback.calledOnce).to.be.true;
        expect(callback.firstCall.args.length).to.equal(1);
        expect(callback.firstCall.args[0]).to.be.instanceOf(Error);
        done();
      }, 0);
    });

    it("resolves Application not found:", function(done) {
      db.one.resolves({count: 0});
      instance.bind(accounts, rounds, dapps, system);
      instance.process(trs, sender, callback);
      expect(db.one.calledOnce).to.be.true;
      expect(db.one.firstCall.args.length).to.equal(2);
      expect(db.one.firstCall.args[0]).to.equal(sql.countByTransactionId);
      expect(db.one.firstCall.args[1]).to.deep.equal({
        id: trs.asset.outTransfer.dappId
      });

      setTimeout(function() {
        clock.tick();
        expect(callback.calledOnce).to.be.true;
        expect(callback.firstCall.args.length).to.equal(1);
        expect(callback.firstCall.args[0]).to.equal('Application not found: 123');
        done();
      }, 0);
    });

    it("resolves Transaction is already processed:", function(done) {

      var private = OutTransfer.__get__("__private");
      OutTransfer.__set__("__private", {
        unconfirmedOutTansfers: {
          "1234": true
        }
      });

      db.one.resolves({count: 1});
      instance.bind(accounts, rounds, dapps, system);
      instance.process(trs, sender, callback);
      expect(db.one.calledOnce).to.be.true;
      expect(db.one.firstCall.args.length).to.equal(2);
      expect(db.one.firstCall.args[0]).to.equal(sql.countByTransactionId);
      expect(db.one.firstCall.args[1]).to.deep.equal({
        id: trs.asset.outTransfer.dappId
      });

      setTimeout(function() {
        clock.tick();
        expect(callback.calledOnce).to.be.true;
        expect(callback.firstCall.args.length).to.equal(1);
        expect(callback.firstCall.args[0]).to.equal('Transaction is already processed: 1234');

        OutTransfer.__set__("__private", private);
        done();
      }, 0);
    });

    it("resolves Transaction is already processed:", function(done) {

      var private = OutTransfer.__get__("__private");
      OutTransfer.__set__("__private", {
        unconfirmedOutTansfers: {
          "1234": true
        }
      });

      db.one.resolves({count: 1});
      instance.bind(accounts, rounds, dapps, system);
      instance.process(trs, sender, callback);
      expect(db.one.calledOnce).to.be.true;
      expect(db.one.firstCall.args.length).to.equal(2);
      expect(db.one.firstCall.args[0]).to.equal(sql.countByTransactionId);
      expect(db.one.firstCall.args[1]).to.deep.equal({
        id: trs.asset.outTransfer.dappId
      });

      setTimeout(function() {
        clock.tick();
        expect(callback.calledOnce).to.be.true;
        expect(callback.firstCall.args.length).to.equal(1);
        expect(callback.firstCall.args[0]).to.equal('Transaction is already processed: 1234');

        OutTransfer.__set__("__private", private);
        done();
      }, 0);
    });






    it("returns 'Invalid recipient'", function() {
      trs.recipientId = false;
      instance.verify(trs, {}, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args.length).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal("Invalid recipient");
    });

    it("returns 'Invalid transaction amount'", function() {

      trs.amount = false;
      instance.verify(trs, {}, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args.length).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal("Invalid transaction amount");
    });

    it("returns 'Invalid transaction asset'", function() {

      delete trs.asset.outTransfer;
      instance.verify(trs, sender, callback);
      clock.tick();

      delete trs.asset;
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledTwice).to.be.true;
      expect(callback.firstCall.args.length).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal("Invalid transaction asset");
      expect(callback.secondCall.args.length).to.equal(1);
      expect(callback.secondCall.args[0]).to.equal("Invalid transaction asset");
    });

    it("returns 'Invalid outTransfer dappId", function() {

      trs.asset.outTransfer.dappId = '....';
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args.length).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal("Invalid outTransfer dappId");
    });

    it("returns 'Invalid outTransfer transactionId", function() {

      trs.asset.outTransfer.transactionId = '....';
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args.length).to.equal(1);
      expect(callback.firstCall.args[0]).to.equal("Invalid outTransfer transactionId");
    });

    it("returns cb with no errors", function() {

      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args.length).to.equal(2);
      expect(callback.firstCall.args[0]).to.equal(null);
      expect(callback.firstCall.args[1]).to.equal(trs);
    });
  });


});
