var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");
var jsonSql = require('json-sql')();
jsonSql.setDialect('postgresql');

var rootDir = path.join(__dirname, "../../..");

var InTransfer = rewire(path.join(rootDir, "logic/inTransfer"));
var constants = require(path.join(rootDir, "helpers/constants"));


describe("logic/inTransfer", function() {

  var callback, trs, instance;


  beforeEach(function() {
    trs = {
      id: 'theId',
      amount: '10000000',
      asset: {
        inTransfer: 'foo',
        dappId: '1919191'
      },
      signatures: ['']
    };
    instance = new InTransfer;
    callback = sinon.stub();
  });


  describe("constructor", function() {
    it("should be a function", function(done) {
      expect(InTransfer).to.be.a('function');
      done()
    });
    it("should be an instance of inTransfer", function(done) {

      expect(instance).to.be.an.instanceOf(InTransfer);
      // todo: test db and schema to be equal to input
      done()
    });
  });

  // Todo: bind
  describe("bind", function() {
    it("should change the values of modules, library, shared", function(done) {
      instance.bind('accounts', 'rounds', 'sharedApi', 'system');

      // todo-ask: how do I test the modules and shared?

      done()
    });
  });

  describe("create", function() {
    it("returns correct trs", function(done) {

      var data = {
        amount: 10,
        dappId: '1919191'
      };
      var expectedValue = trs;
      expectedValue.recipientId = null;
      expectedValue.amount = data.amount;
      expectedValue.dappId = data.dappId;

      expect(instance.create(data, trs)).to.be.deep.equal(expectedValue);

      done()
    });
  });

  describe("calculateFee", function() {
    it("returns constant fee", function(done) {

      // todo-ask: how to test getFees? If you uncomment this line test fails
      // expect(instance.calculateFee()).to.be.equal(constants.fees.send);

      done()
    });
  });


  describe("verify", function() {
    var clock, instance;

    beforeEach(function() {
      clock = sinon.useFakeTimers("setImmediate");
      InTransfer.__set__("setImmediate", setImmediate);

      instance = new InTransfer;
    });
    afterEach(function() {
      clock.restore();
      InTransfer.__set__("setImmediate", setImmediate);
    });

    it("error Invalid recipient", function(done) {
      trs.recipientId = 'foo';
      instance.verify(trs,null, callback);
      clock.tick();
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Invalid recipient');

      done()
    });

    it("error Invalid transaction amount", function(done) {
      delete trs.amount;
      instance.verify(trs,null, callback);
      clock.tick();
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Invalid transaction amount');

      done()
    });

    it("no asset -> error Invalid transaction asset", function(done) {
      delete trs.asset;
      instance.verify(trs,null, callback);
      clock.tick();
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Invalid transaction asset');

      done()
    });

    it("no inTransfer -> error Invalid transaction asset", function(done) {
      delete trs.asset.inTransfer;
      instance.verify(trs,null, callback);
      clock.tick();
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Invalid transaction asset');

      done()
    });

    it("todo x3", function(done) {

      // todo-ask: stuck on how to test library.db.one

      // todo: I will add then test error Application not found:
      // todo: I will add then add test success
      // todo: I will add then add test catch error

      done()
    });
  });

  describe("process", function() {
    it("invokes callback", function(done) {

      var trs = {};
      var clock = sinon.useFakeTimers("setImmediate");
      InTransfer.__set__("setImmediate", setImmediate);

      instance.process(trs, '', callback);

      clock.tick();
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(2);
      expect(callback.getCall(0).args[0]).to.equal(null);
      expect(callback.getCall(0).args[1]).to.deep.equal(trs);

      done()
    });
  });

  describe("getBytes", function () {
    var instance;

    beforeEach(function() {
      instance = new InTransfer;
      trs.asset = {
        inTransfer: {
          dappId: '1919191'
        }
      }
    });

    it("catches the error", function(done) {
      delete trs.asset.inTransfer.dappId;
      expect(instance.getBytes.bind(null,trs)).to.throw();
      done();
    });

    it("success", function(done) {
      expect(instance.getBytes(trs)).to.be.instanceof(Buffer);
      done()
    });

  });

  describe("apply", function () {

    // todo-ask: confused on how to test getGenesis

  });

  describe("undo", function () {

    // todo-ask: confused on how to test getGenesis

  });

  describe("applyUnconfirmed", function () {

    it("invokes callback", function(done) {

      var clock = sinon.useFakeTimers("setImmediate");
      InTransfer.__set__("setImmediate", setImmediate);

      instance.applyUnconfirmed(null, null, callback);

      clock.tick();
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(0);

      done()
    });

  });

  describe("undoUnconfirmed", function () {
    it("invokes callback", function(done) {

      var clock = sinon.useFakeTimers("setImmediate");
      InTransfer.__set__("setImmediate", setImmediate);

      instance.undoUnconfirmed(null, null, callback);

      clock.tick();
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(0);

      done()
    });

  });

  describe("schema", function () {
    it("schema is the same", function(done) {
      expect(instance.schema).to.deep.equal({
        id: 'InTransfer',
        object: true,
        properties: {
          dappId: {
            type: 'string',
            format: 'id',
            minLength: 1,
            maxLength: 20
          },
        },
        required: ['dappId']
      });

      done()
    });
  });


  // todo-ask: this test fails because objectNormalize cannot read validate from library.schema
  // describe("objectNormalize", function () {
  //   it("catches the error", function(done) {
  //     var trsResult = instance.objectNormalize({});
  //     console.log(trsResult);
  //     done()
  //   });
  //
  //   it("success", function(done) {
  //     done()
  //   });
  // });
  //

  describe("dbRead", function () {
    it("returns null when no in_dappId", function(done) {
      var retVal = instance.dbRead({});
      expect(retVal).to.equal(null);
      done()
    });

    it("success", function(done) {
      var retVal = instance.dbRead({in_dappId: '1919191'});
      expect(retVal).to.deep.equal({
        inTransfer: {
          dappId: '1919191'
        }
      });
      done()
    });
  });

  describe("table and fields", function () {
    it("correct values", function(done) {
      expect(instance.dbTable).to.equal('intransfer');
      expect(instance.dbFields).to.deep.equal([ 'dappId', 'transactionId' ]);
      done()
    });
  });

  describe("dbSave", function () {
    it("correct query", function(done) {
      var query = instance.dbSave(trs);
      var expectedValue = {
        table: 'intransfer',
        fields: [ 'dappId', 'transactionId' ],
        values: {
          dappId: trs.asset.inTransfer.dappId,
          transactionId: trs.id
        }
      };
      expect(query).to.deep.equal(expectedValue);
      done()
    });
  });

  describe("afterSave", function () {
    it("cb called", function(done) {

      var clock = sinon.useFakeTimers("setImmediate");
      InTransfer.__set__("setImmediate", setImmediate);

      instance.afterSave(trs, callback);

      clock.tick();
      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(0);

      done()
    });
  });

  describe("ready", function () {
    it("multisignatures with no trs.signatures", function(done) {

      var sender = {
        multisignatures: [
          ''
        ]
      };
      delete trs.signatures;
      var retVal = instance.ready(trs, sender);

      expect(retVal).to.be.false;

      done()
    });
    it("multisignatures with trs.signatures", function(done) {

      var sender = {
        multisignatures: [
          ''
        ]
      };
      var retVal = instance.ready(trs, sender);

      expect(retVal).to.be.false;

      done()
    });
    it("no multisignatures", function(done) {

      var sender = {};
      var retVal = instance.ready(trs, sender);

      expect(retVal).to.be.true;

      done()
    });
  });


});
