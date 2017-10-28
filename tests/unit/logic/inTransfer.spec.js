var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var InTransfer = rewire(path.join(rootDir, "logic/inTransfer"));
var constants = require(path.join(rootDir, "helpers/constants")).default;

describe("logic/inTransfer", function() {

  var callback, trs, instance, db = {}, schema = {};


  beforeEach(function() {
    trs = {
      id: 'theId',
      amount: '10000000',
      asset: {
        inTransfer: {
          dappId: '1919191'
        }
      },
      signatures: ['']
    };
    instance = new InTransfer(db, schema);
    callback = sinon.stub();
  });


  describe("constructor", function() {
    it("should be a function", function(done) {
      expect(InTransfer).to.be.a('function');
      done()
    });
    it("should be an instance of inTransfer", function(done) {

      var library =InTransfer.__get__("library");

      expect(instance).to.be.an.instanceOf(InTransfer);
      expect(library.db).to.be.equal(db);
      expect(library.schema).to.be.equal(schema);

      done()
    });
  });

  describe("bind", function() {
    it("should change the values of modules, library, shared", function(done) {
      instance.bind('accounts', 'rounds', 'sharedApi', 'system');

      var modules =InTransfer.__get__("modules");
      var shared =InTransfer.__get__("shared");
      var expectedModules = {
        accounts: 'accounts',
        rounds: 'rounds',
        system: 'system'
      };
      var expectedShared = 'sharedApi';

      expect(modules).to.be.deep.equal(expectedModules);
      expect(shared).to.be.equal(expectedShared);

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

      var modules = {
        system: {
          getFees: sinon.stub().callsFake(function(height){
            var i;
            for (i=constants.fees.length-1; i>0; i--)	{
              if (height>=constants.fees[i].height) {
                break;
              }
            }

            return {
              fromHeight: constants.fees[i].height,
              toHeight: i == constants.fees.length-1 ? null : constants.fees[i+1].height-1,
              height: height,
              fees: constants.fees[i].fees
            };
          })
        }
      };

      InTransfer.__set__("modules", modules);

      expect(instance.calculateFee(null, null, 10)).to.be.equal(10000000);
      expect(modules.system.getFees.calledOnce).to.true;
      expect(modules.system.getFees.getCall(0).args.length).to.equal(1);
      expect(modules.system.getFees.getCall(0).args[0]).to.equal(10);
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

    it("db.one rejects", function(done) {

      clock.restore();

      var library = {
        db: {
          one: sinon.stub().rejects('')
        }
      };

      InTransfer.__set__("library", library);

      instance.verify(trs,null, callback);

      setTimeout(function(){ //running in a separate thread
          clock.runAll();
          expect(callback.calledOnce).to.be.true;
          expect(callback.getCall(0).args.length).to.equal(1);
          expect(callback.getCall(0).args[0]).to.instanceOf(Error);
          done();
      }, 0);

    });

    it("db.one resolves row.count", function(done) {

      clock.restore();

      var library = {
        db: {
          one: sinon.stub().resolves({count: 1})
        }
      };

      InTransfer.__set__("library", library);

      instance.verify(trs,null, callback);

      setTimeout(function(){
        clock.runAll();
        expect(callback.called).to.be.true;
        expect(callback.getCall(0).args.length).to.equal(0);
        done();
      }, 0);

    });

    it("db.one resolves and Application not found", function(done) {

      clock.restore();

      var library = {
        db: {
          one: sinon.stub().resolves({count: 0})
        }
      };

      InTransfer.__set__("library", library);

      instance.verify(trs,null, callback);

      setTimeout(function(){
        clock.runAll();
        expect(callback.called).to.be.true;
        expect(callback.getCall(0).args.length).to.equal(1);
        expect(callback.getCall(0).args[0]).to.equal("Application not found: 1919191");
        done();
      }, 0);

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
    var shared, modules;

    beforeEach(function() {
      shared = {
        getGenesis: function() {}
      };
      modules = {
        accounts: {
          mergeAccountAndGet: function() {}
        },
        rounds: {
          calc: sinon.stub().returns(1)
        }
      };
      clock = sinon.useFakeTimers("setImmediate");

      InTransfer.__set__("setImmediate", setImmediate);
      InTransfer.__set__("shared", shared);
      InTransfer.__set__("modules", modules);

    });

    afterEach(function() {
      clock.restore();
      InTransfer.__set__('setImmediate', setImmediate);
    });


    it("catches the error", function(done) {

      sinon.stub(shared, "getGenesis").callsFake(function(obj, cb) {
        return cb(true, null);
      });
      sinon.stub(modules.accounts, "mergeAccountAndGet");

      instance.apply(trs, {id: 'foo'}, {}, callback);
      expect(shared.getGenesis.calledOnce).to.equal(true);
      clock.tick();
      expect(callback.calledOnce).to.equal(true);
      expect(modules.accounts.mergeAccountAndGet.calledOnce).to.equal(false);

      done();
    });


    it("catches mergeAccountAndGet error", function(done) {

      var res = {
        authorId: ''
      };
      var block = {
        id: ''
      };

      sinon.stub(shared, "getGenesis").callsFake(function(obj, cb) {
        return cb(false, res);
      });

      sinon.stub(modules.accounts, "mergeAccountAndGet").callsFake(function(obj, cb) {
        return cb(true, null);
      });

      instance.apply(trs, block, {}, callback);
      expect(shared.getGenesis.calledOnce).to.equal(true);
      expect(callback.calledOnce).to.equal(false);
      expect(modules.accounts.mergeAccountAndGet.calledOnce).to.equal(true);
      expect(modules.accounts.mergeAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(modules.accounts.mergeAccountAndGet.getCall(0).args[0]).to.deep.equal({
        address: '',
        balance: '10000000',
        u_balance: '10000000',
        blockId: '',
        round: 1
      });
      clock.tick();
      expect(callback.calledOnce).to.equal(true);

      done();
    });

  });

  describe("undo", function () {

    var shared, modules;

    beforeEach(function() {
      shared = {
        getGenesis: function() {}
      };
      modules = {
        accounts: {
          mergeAccountAndGet: function() {}
        },
        rounds: {
          calc: sinon.stub().returns(1)
        }
      };
      clock = sinon.useFakeTimers("setImmediate");

      InTransfer.__set__("setImmediate", setImmediate);
      InTransfer.__set__("shared", shared);
      InTransfer.__set__("modules", modules);

    });

    afterEach(function() {
      clock.restore();
      InTransfer.__set__('setImmediate', setImmediate);
    });


    it("catches the error", function(done) {

      sinon.stub(shared, "getGenesis").callsFake(function(obj, cb) {
        return cb(true, null);
      });
      sinon.stub(modules.accounts, "mergeAccountAndGet");

      instance.undo(trs, {id: 'foo'}, {}, callback);
      expect(shared.getGenesis.calledOnce).to.equal(true);
      clock.tick();
      expect(callback.calledOnce).to.equal(true);
      expect(modules.accounts.mergeAccountAndGet.calledOnce).to.equal(false);

      done();
    });


    it("catches the mergeAccountAndGet error", function(done) {

      var res = {
        authorId: ''
      };
      var block = {
        id: ''
      };

      sinon.stub(shared, "getGenesis").callsFake(function(obj, cb) {
        return cb(false, res);
      });

      sinon.stub(modules.accounts, "mergeAccountAndGet").callsFake(function(obj, cb) {
        return cb(true, null);
      });

      instance.undo(trs, block, {}, callback);
      expect(shared.getGenesis.calledOnce).to.equal(true);
      expect(callback.calledOnce).to.equal(false);
      expect(modules.accounts.mergeAccountAndGet.calledOnce).to.equal(true);
      expect(modules.accounts.mergeAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(modules.accounts.mergeAccountAndGet.getCall(0).args[0]).to.deep.equal({
        address: '',
        balance: -10000000,
        u_balance: -10000000,
        blockId: '',
        round: 1
      });
      clock.tick();
      expect(callback.calledOnce).to.equal(true);

      done();
    });

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


  describe("objectNormalize", function () {
    it("catches the error", function(done) {


      var validateStub = sinon.stub().returns(false);
      var throwError = function() {
        instance.objectNormalize(trs)
      };

      instance = new InTransfer({}, {
        validate : validateStub
      });

      expect(throwError).to.throw();
      done()
    });

    it("success", function(done) {

      var validateStub = sinon.stub().returns(true);
      instance = new InTransfer({}, {
        validate : validateStub
      });

      var trsResult = instance.objectNormalize(trs);

      expect(trsResult).to.be.deep.equal({
        id: 'theId',
        amount: '10000000',
        asset: { inTransfer: { dappId: '1919191' }},
        signatures: [ '' ]
      });

      done()
    });
  });


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
