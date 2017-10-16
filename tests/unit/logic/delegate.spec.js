var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var Delegate = rewire(path.join(rootDir, "logic/delegate"));
var constants = require(path.join(rootDir, "helpers/constants"));
var schema = {};
var accounts = {};
var system = {};
var trs;

describe("logic/delegate", function() {
  var instance, callback, clock;

  beforeEach(function() {
    instance = new Delegate(schema);
    callback = sinon.stub();
    clock = sinon.useFakeTimers("setImmediate");
    Delegate.__set__("setImmediate", setImmediate);
    trs = {
      asset: {
        delegate: {
          username: 'carbonara'
        }
      }
    };
  });
  afterEach(function(){
    clock.reset();
  });

  describe("constructor", function() {
    it("should be a function", function(done) {
      expect(Delegate).to.be.a("function");

      done();
    });
    it("should be an instance of Delegate", function(done) {
      var library = Delegate.__get__("library");

      expect(instance).to.be.an.instanceOf(Delegate);
      expect(library).to.be.deep.equal({
        schema: schema
      });

      done();
    });
  });

  describe("bind", function() {
    it("binds correct modules", function(done) {
      var modules;

      instance.bind(accounts, system);
      modules = Delegate.__get__("modules");

      expect(modules).to.be.deep.equal({
        accounts: accounts,
        system: system
      });

      done();
    });
  });

  describe("create", function() {

    var data;

    beforeEach(function(){
      data = {
        username: 'carbonara',
        sender: {
          publicKey: '123'
        }
      };
    });

    it("returns trs without delegate.username", function(done) {

      data.username = undefined;

      var returnTrs = instance.create(data, trs);

      expect(returnTrs).to.be.deep.equal({
        recipientId: null,
        amount: 0,
        asset: {
          delegate: {
            username: undefined,
            publicKey: '123'
          }
        }
      });

      done();
    });

    it("correctly trims and lowercase the delegate.username", function(done) {

      data.username = '    carboNARA   ';

      var returnTrs = instance.create(data, trs);

      expect(returnTrs).to.be.deep.equal({
        recipientId: null,
        amount: 0,
        asset: {
          delegate: {
            username: 'carbonara',
            publicKey: '123'
          }
        }
      });

      done();
    });

    it("returns trs with delegate.username", function(done) {

      var returnTrs = instance.create(data, trs);

      expect(returnTrs).to.be.deep.equal({
        recipientId: null,
        amount: 0,
        asset: {
          delegate: {
            username: 'carbonara',
            publicKey: '123'
          }
        }
      });

      done();
    });
  });

  describe("calculateFee", function() {
    it("calls getFees", function(done) {

      instance.bind(accounts, system);
      var modules = Delegate.__get__('modules');
      modules.system = {getFees: function() {}};
      var getFees = sinon.stub(modules.system, "getFees").returns({
        fees: {
          delegate: 1
        }
      });

      instance.calculateFee(null, null, 1);

      expect(getFees.calledOnce).to.be.true;
      expect(getFees.args.length).to.equal(1);
      expect(getFees.getCall(0).args[0]).to.equal(1);

      getFees.restore();

      done();
    });
  });

  describe("verify", function() {

    var sender;

    beforeEach(function() {
      sender = {
        isDelegate: false
      };
      trs = {
        amount: 0,
        asset: {
          delegate: {
            username: 'carbonara'
          }
        }
      }
    });

    it("Error invalid recipient", function(done) {

      instance.verify({
        recipientId: '1'
      }, null, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Invalid recipient');

      done();
    });

    it("Error invalid recipient", function(done) {

      instance.verify({
        amount: 1
      }, null, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Invalid transaction amount');

      done();
    });

    it("Error invalid recipient", function(done) {

      instance.verify({
        amount: 1
      }, null, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Invalid transaction amount');

      done();
    });

    it("Error Account is already a delegate", function(done) {

      sender.isDelegate = true;
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Account is already a delegate');

      done();
    });

    it("Error Invalid transaction asset", function(done) {

      delete trs.asset;
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Invalid transaction asset');


      clock.reset();
      callback.reset();
      trs.asset = {};
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Invalid transaction asset');

      done();
    });

    it("Error Username is undefined", function(done) {

      trs.asset.delegate.username = undefined;
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Username is undefined');

      done();
    });

    it("Error Username must be lowercase", function(done) {

      trs.asset.delegate.username = 'CARBONARA';
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Username must be lowercase');

      done();
    });

    it("Error Empty username", function(done) {

      trs.asset.delegate.username = ' ';
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Empty username');

      done();
    });

    it("Error Empty username", function(done) {

      trs.asset.delegate.username = 'carbonaracarbonaracarbonaracarbonaracarbonaracarbonaracarbonara';
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Username is too long. Maximum is 20 characters');

      done();
    });

    it("Error Username can not be a potential address", function(done) {

      trs.asset.delegate.username = '1234444r';
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Username can not be a potential address');

      done();
    });

    it("Error Username can only contain alphanumeric characters with the exception of !@$&_.", function(done) {

      trs.asset.delegate.username = 'carßonara';
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Username can only contain alphanumeric characters with the exception of !@$&_.');

      done();
    });

    it("Error from getAccount cb", function(done) {

      var modules = {
        accounts: {
          getAccount: function(){}
        }
      };
      sinon.stub(modules.accounts, "getAccount").callsFake(function(account, cb) {
        cb('error');
      });

      Delegate.__set__("modules", modules);
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('error');

      Delegate.__get__("modules").accounts.getAccount.restore();
      done();
    });

    it("Error Username already exists", function(done) {

      var modules = {
        accounts: {
          getAccount: function(){}
        }
      };
      sinon.stub(modules.accounts, "getAccount").callsFake(function(account, cb) {
        cb(null, true);
      });

      Delegate.__set__("modules", modules);
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('Username already exists');

      Delegate.__get__("modules").accounts.getAccount.restore();
      done();
    });

    it("success", function(done) {

      var modules = {
        accounts: {
          getAccount: function(){}
        }
      };
      sinon.stub(modules.accounts, "getAccount").callsFake(function(account, cb) {
        cb(null, null);
      });

      Delegate.__set__("modules", modules);
      instance.verify(trs, sender, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(2);
      expect(callback.getCall(0).args[0]).to.equal(null);
      expect(callback.getCall(0).args[1]).to.deep.equal(trs);

      Delegate.__get__("modules").accounts.getAccount.restore();
      done();
    });
  });

  describe("process", function() {
    it("calls cb", function(done) {

      instance.process(trs, null, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(2);
      expect(callback.getCall(0).args[0]).to.equal(null);
      expect(callback.getCall(0).args[1]).to.deep.equal(trs);

      done();
    });
  });

  describe("getBytes", function() {
    it("returns null with no username", function(done) {

      trs.asset.delegate.username = false;
      var retVall = instance.getBytes(trs);

      expect(retVall).to.equal(null);

      done();
    });

    it("catches the error", function(done) {

      var Buffer = Delegate.__get__('Buffer');
      Buffer.from = function() {};
      var from = sinon.stub(Buffer, "from").callsFake(function() {
        throw new Error('Error');
      });

      Delegate.__set__("Buffer", Buffer);

      var throwError = function() {
        instance.getBytes(trs);
      };

      expect(throwError).to.throw('Error');
      Delegate.__get__("Buffer").from.restore();

      done();
    });

    it("catches the error", function(done) {

      var Buffer = Delegate.__get__('Buffer');
      Buffer.from = function() {};
      var from = sinon.stub(Buffer, "from").returns(1);

      Delegate.__set__("Buffer", Buffer);

      var retval = instance.getBytes(trs);

      expect(retval).to.equal(1);
      Delegate.__get__("Buffer").from.restore();

      done();
    });
  });

  describe("apply", function() {

    var sender = {
      address: '12929291r'
    };

    it("calls setAccountAndGet without username", function(done) {

      var modules = Delegate.__get__('modules');
      modules.accounts = { setAccountAndGet: function() {} };
      var setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
      var expectedData = {
        address: "12929291r",
        isDelegate: 1,
        u_isDelegate: 0,
        vote: 0
      };

      trs.asset.delegate.username = false;
      instance.apply(trs, null, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);

      setAccountAndGet.restore();
      trs.asset.delegate.username = 'carbonara';
      done();
    });

    it("calls setAccountAndGet with username", function(done) {

      var modules = Delegate.__get__('modules');
      modules.accounts = { setAccountAndGet: function() {} };
      var setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
      var expectedData = {
        address: "12929291r",
        isDelegate: 1,
        u_isDelegate: 0,
        u_username: null,
        username: "carbonara",
        vote: 0
      };

      instance.apply(trs, null, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);

      setAccountAndGet.restore();
      done();
    });

  });

  describe("undo", function() {

    var sender = {
      address: '12929291r'
    };
    var modules, setAccountAndGet;

    beforeEach(function() {
      sender.nameexist = false;
      modules = Delegate.__get__('modules');
      modules.accounts = { setAccountAndGet: function() {} };
      setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
    });
    afterEach(function() {
      setAccountAndGet.restore();
      trs.asset.delegate.username = "carbonara";
    });

    it("calls setAccountAndGet without nameexist", function(done) {

      var expectedData = {
        address: "12929291r",
        isDelegate: 0,
        u_isDelegate: 1,
        u_username: trs.asset.delegate.username,
        username: null,
        vote: 0
      };

      instance.undo(trs, null, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);

      setAccountAndGet.restore();
      done();
    });

    it("calls setAccountAndGet with nameexist and no username", function(done) {

      var expectedData = {
        address: "12929291r",
        isDelegate: 0,
        u_isDelegate: 1,
        vote: 0
      };

      trs.asset.delegate.username = false;
      sender.nameexist = true;
      instance.undo(trs, null, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);

      done();
    });

    it("calls setAccountAndGet with username and not nameexist", function(done) {

      var expectedData = {
        address: "12929291r",
        isDelegate: 0,
        u_isDelegate: 1,
        u_username: trs.asset.delegate.username,
        username: null,
        vote: 0
      };

      instance.undo(trs, null, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);

      done();
    });

  });

  describe("applyUnconfirmed", function() {

    var sender = {
      address: '12929291r'
    };
    var modules, setAccountAndGet;

    beforeEach(function() {
      sender.nameexist = false;
      modules = Delegate.__get__('modules');
      if(!modules) modules = {};
      modules.accounts = { setAccountAndGet: function() {} };
      setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
      Delegate.__set__("modules", modules);
    });
    afterEach(function() {
      setAccountAndGet.restore();
      trs.asset.delegate.username = "carbonara";
    });

    it("calls setAccountAndGet without username", function(done) {

      var expectedData = {
        address: "12929291r",
        isDelegate: 0,
        u_isDelegate: 1
      };

      trs.asset.delegate.username = false;
      instance.applyUnconfirmed(trs, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);

      setAccountAndGet.restore();
      done();
    });

    it("calls setAccountAndGet with username", function(done) {

      var expectedData = {
        address: "12929291r",
        isDelegate: 0,
        u_isDelegate: 1,
        username: null,
        u_username: trs.asset.delegate.username
      };

      instance.applyUnconfirmed(trs, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);

      done();
    });

  });

  describe("undoUnconfirmed", function() {

    var sender = {
      address: '12929291r'
    };
    var modules, setAccountAndGet;

    beforeEach(function() {
      modules = Delegate.__get__('modules');
      if(!modules) modules = {};
      modules.accounts = { setAccountAndGet: function() {} };
      setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
      Delegate.__set__("modules", modules);
    });
    afterEach(function() {
      setAccountAndGet.restore();
      trs.asset.delegate.username = "carbonara";
    });

    it("calls setAccountAndGet without username", function(done) {

      var expectedData = {
        address: "12929291r",
        isDelegate: 0,
        u_isDelegate: 0
      };

      trs.asset.delegate.username = false;
      instance.undoUnconfirmed(trs, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);

      setAccountAndGet.restore();
      done();
    });

    it("calls setAccountAndGet with username", function(done) {

      var expectedData = {
        address: "12929291r",
        isDelegate: 0,
        u_isDelegate: 0,
        username: null,
        u_username: null
      };

      instance.undoUnconfirmed(trs, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);

      done();
    });

  });

  describe("schema", function() {

    it("is correct", function(done) {

      expect(instance.schema).to.deep.equal({
        id: 'Delegate',
        type: 'object',
        properties: {
          publicKey: {
            type: 'string',
            format: 'publicKey'
          }
        },
        required: ['publicKey']
      });

      done();
    });

  });

  describe("objectNormalize", function() {

    var library, validate;
    beforeEach(function(){
      library = Delegate.__get__('library');
      library.schema = { validate: function() {} };
    });
    afterEach(function() {
      if(validate && validate.restore()) validate.restore();
      trs.asset.delegate.username = "carbonara";
    });

    it("throws error", function(done) {

      validate = sinon.stub(library.schema, "validate").returns(false);

      var throwError = function() {
        var context = {
          schema: {
            getLastErrors: sinon.stub().returns([new Error('error')])
          }
        };
        instance.objectNormalize.call(context, trs);
      };

      expect(throwError).to.throw();

      done();
    });

    it("success", function(done) {

      validate = sinon.stub(library.schema, "validate").returns(true);

      expect(instance.objectNormalize(trs)).to.deep.equal(trs);
      expect(library.schema.validate.calledOnce).to.be.true;
      expect(library.schema.validate.getCall(0).args.length).to.equal(2);
      expect(library.schema.validate.getCall(0).args[0]).to.deep.equal({ username: 'carbonara' });
      expect(library.schema.validate.getCall(0).args[1]).to.equal(instance.schema);

      done();
    });

  });

  describe("dbRead", function() {

    it("returns null with no username", function(done) {

      var raw = {
        t_senderPublicKey: '0123',
        t_senderId: '0123'
      };

      var retVal = instance.dbRead(raw);

      expect(retVal).to.equal(null);

      done();
    });

    it("success", function(done) {

      var raw = {
        d_username: 'carbonara',
        t_senderPublicKey: '0123',
        t_senderId: '0123'
      };
      var expectedResult = {
        delegate: {
          address: "0123",
          publicKey: "0123",
          username: "carbonara"
        }
      };

      var retVal = instance.dbRead(raw);

      expect(retVal).to.deep.equal(expectedResult);

      done();
    });

  });

  describe("dbTable", function() {

    it("correct table", function(done) {

      expect(instance.dbTable).to.equal('delegates');

      done();
    });

  });

  describe("dbFields", function() {

    it("correct fields", function(done) {

      var expectedFields = [
        'username',
        'transactionId'
      ];

      expect(instance.dbFields).to.deep.equal(expectedFields);

      done();
    });

  });

  describe("dbSave", function() {

    it("returns correct value", function(done) {

      var context = {
        dbTable: 'delegates',
        dbFields: [
          'username',
          'transactionId'
        ]
      };
      var expectedObj = {
        table: context.dbTable,
        fields: context.dbFields,
        values: {
          username: trs.asset.delegate.username,
          transactionId: trs.id
        }
      };

      var retVal = instance.dbSave.call(context, trs);

      expect(retVal).to.deep.equal(expectedObj);

      done();
    });

  });

  describe("ready", function() {

    it("returns null", function(done) {

      var retVal = instance.ready(trs, {});

      expect(retVal).to.deep.equal(true);

      done();
    });

    it("returns false with no signatures", function(done) {

      var sender = {
        multisignatures: [1]
      };
      var retVal = instance.ready(trs, sender);

      expect(retVal).to.equal(false);

      done();
    });

    it("returns ready when signatures < multimin", function(done) {

      var sender = {
        multisignatures: [1],
        multimin: 2
      };
      trs.signatures = [1,2,3];
      var retVal = instance.ready(trs, sender);

      expect(retVal).to.equal(true);

      done();
    });

    it("returns not ready when signatures > multimin", function(done) {

      var sender = {
        multisignatures: [1],
        multimin: 10
      };
      trs.signatures = [1,2,3];
      var retVal = instance.ready(trs, sender);

      expect(retVal).to.equal(false);

      done();
    });

  });
});
