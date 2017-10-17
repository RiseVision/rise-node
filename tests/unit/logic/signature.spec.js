var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var Signature = rewire(path.join(rootDir, "logic/signature"));

describe("logic/signature", function() {
  var instance, callback, clock, trs, schema, logger;

  beforeEach(function() {
    schema = {};
    logger = {};
    instance = new Signature(schema, logger);
    callback = sinon.stub();
    clock = sinon.useFakeTimers("setImmediate");
    Signature.__set__("setImmediate", setImmediate);
    trs = {
      asset: {
        delegate: {
          username: "carbonara"
        },
        signature: {
          publicKey:
            "bf4809a1a08c9dffbba741f0c7b9f49145602341d5fa306fb3cd592d3e1058b3"
        }
      }
    };
  });
  afterEach(function() {
    clock.reset();
  });

  describe("constructor", function() {
    it("should be a function", function(done) {
      expect(Signature).to.be.a("function");

      done();
    });
    it("should be an instance of Signature", function(done) {
      expect(instance).to.be.an.instanceOf(Signature);

      var library = Signature.__get__("library");
      expect(library).to.be.deep.equal({
        schema: schema,
        logger: logger
      });

      done();
    });
  });

  describe("bind", function() {
    it("binds the modules", function(done) {
      instance.bind({}, {});
      var modules = Signature.__get__("modules");

      expect(modules).to.be.deep.equal({
        accounts: {},
        system: {}
      });

      done();
    });
  });

  describe("create", function() {
    it("returns correct trs", function(done) {
      var data = {
        secondKeypair: {
          publicKey: "123456"
        }
      };

      var retVal = instance.create(data, { asset: {} });

      expect(retVal).to.be.deep.equal({
        recipientId: null,
        amount: 0,
        asset: {
          signature: {
            publicKey: "123456"
          }
        }
      });

      done();
    });
  });

  describe("verify", function() {
    var callback, clock, trs;

    beforeEach(function() {
      callback = sinon.stub();
      clock = sinon.useFakeTimers("setImmediate");
      Signature.__set__("setImmediate", setImmediate);
      trs = {
        asset: {
          signature: {
            publicKey: "123456"
          }
        },
        amount: 0
      };
    });
    afterEach(function() {
      clock.reset();
    });

    it("error cb 'Invalid transaction asset'", function(done) {
      delete trs.asset.signature;
      instance.verify(trs, null, callback);
      clock.tick();
      delete trs.asset;
      instance.verify(trs, null, callback);
      clock.tick();

      expect(callback.calledTwice).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal("Invalid transaction asset");
      expect(callback.getCall(1).args.length).to.equal(1);
      expect(callback.getCall(1).args[0]).to.equal("Invalid transaction asset");

      done();
    });

    it("error cb 'Invalid transaction amount'", function(done) {
      trs.amount = 10;
      instance.verify(trs, null, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal(
        "Invalid transaction amount"
      );

      done();
    });

    it("error cb first 'Invalid public key'", function(done) {
      var pubKey = trs.asset.signature.publicKey;
      var Buffer = Signature.__get__("Buffer");
      var from = sinon.stub(Buffer, "from").returns([]);
      Signature.__set__("Buffer", Buffer);

      instance.verify(trs, null, callback);
      clock.tick();
      delete trs.asset.signature.publicKey;
      instance.verify(trs, null, callback);
      clock.tick();

      expect(callback.calledTwice).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal("Invalid public key");
      expect(callback.getCall(1).args.length).to.equal(1);
      expect(callback.getCall(1).args[0]).to.equal("Invalid public key");

      expect(from.calledOnce).to.be.true;
      expect(from.getCall(0).args.length).to.equal(2);
      expect(from.getCall(0).args[0]).to.equal(pubKey);
      expect(from.getCall(0).args[1]).to.equal("hex");

      Signature.__get__("Buffer").from.restore();
      done();
    });

    it("error cb second 'Invalid public key'", function(done) {
      var Buffer = Signature.__get__("Buffer");
      var from = sinon.stub(Buffer, "from").callsFake(function() {
        throw new Error();
      });
      var library = {
        logger: {
          error: function() {}
        }
      };
      var logger = sinon.stub(library.logger, "error");

      Signature.__set__("Buffer", Buffer);
      Signature.__set__("library", library);

      instance.verify(trs, null, callback);
      clock.tick();

      expect(logger.calledOnce).to.be.true;
      expect(logger.getCall(0).args.length).to.equal(1);

      expect(callback.calledOnce).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal("Invalid public key");

      Signature.__get__("Buffer").from.restore();
      Signature.__get__("library").logger.error.restore();
      done();
    });
  });

  describe("process", function() {
    it("calls cb", function(done) {
      instance.process(trs, {}, callback);
      clock.tick();

      expect(callback.calledOnce).to.be.deep.true;

      expect(callback.getCall(0).args.length).to.equal(2);
      expect(callback.getCall(0).args[0]).to.be.equal(null);
      expect(callback.getCall(0).args[1]).to.be.deep.equal(trs);

      done();
    });
  });

  describe("getBytes", function() {
    it("throws error", function(done) {
      var pubKey = trs.asset.signature.publicKey;
      var Buffer = Signature.__get__("Buffer");
      var from = sinon.stub(Buffer, "from").callsFake(function() {
        throw new Error();
      });
      Signature.__set__("Buffer", Buffer);

      var throwError = function() {
        instance.getBytes(trs);
      };

      expect(throwError).to.throw();
      expect(from.calledOnce).to.be.true;
      expect(from.getCall(0).args.length).to.equal(2);
      expect(from.getCall(0).args[0]).to.equal(pubKey);
      expect(from.getCall(0).args[1]).to.equal("hex");

      done();
      Signature.__get__("Buffer").from.restore();
    });
    it("returns buffer", function(done) {
      var retVal = instance.getBytes(trs);
      expect(retVal).to.be.instanceOf(Buffer);
      done();
    });
  });

  describe("apply", function() {
    var sender = {
      address: "12929291r"
    };

    it("calls setAccountAndGet", function(done) {
      var modules = Signature.__get__("modules");
      modules.accounts = { setAccountAndGet: function() {} };
      var setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
      var expectedData = {
        address: "12929291r",
        secondSignature: 1,
        u_secondSignature: 0,
        secondPublicKey: trs.asset.signature.publicKey
      };

      instance.apply(trs, null, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);
      expect(setAccountAndGet.getCall(0).args[1]).to.deep.equal(callback);

      setAccountAndGet.restore();
      trs.asset.delegate.username = "carbonara";
      done();
    });
  });

  describe("undo", function() {
    var sender = {
      address: "12929291r"
    };

    it("calls setAccountAndGet", function(done) {
      var modules = Signature.__get__("modules");
      modules.accounts = { setAccountAndGet: function() {} };
      var setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
      var expectedData = {
        address: "12929291r",
        secondSignature: 0,
        u_secondSignature: 1,
        secondPublicKey: null
      };

      instance.undo(trs, null, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);
      expect(setAccountAndGet.getCall(0).args[1]).to.deep.equal(callback);

      setAccountAndGet.restore();
      trs.asset.delegate.username = "carbonara";
      done();
    });
  });

  describe("applyUnconfirmed", function() {
    var sender = {
      address: "12929291r"
    };

    it("calls cb", function(done) {
      sender.u_secondSignature = true;
      instance.applyUnconfirmed(trs, sender, callback);
      clock.tick();
      delete sender.u_secondSignature;
      sender.secondSignature = true;
      instance.applyUnconfirmed(trs, sender, callback);
      clock.tick();

      expect(callback.calledTwice).to.be.true;
      expect(callback.getCall(0).args.length).to.equal(1);
      expect(callback.getCall(0).args[0]).to.deep.equal(
        "Second signature already enabled"
      );
      expect(callback.getCall(1).args.length).to.equal(1);
      expect(callback.getCall(1).args[0]).to.deep.equal(
        "Second signature already enabled"
      );

      delete sender.secondSignature;
      done();
    });

    it("calls setAccountAndGet", function(done) {
      var modules = Signature.__get__("modules");
      modules.accounts = { setAccountAndGet: function() {} };
      var setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
      var expectedData = {
        address: sender.address,
        u_secondSignature: 1
      };

      instance.applyUnconfirmed(trs, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);
      expect(setAccountAndGet.getCall(0).args[1]).to.deep.equal(callback);

      setAccountAndGet.restore();
      done();
    });
  });

  describe("undoUnconfirmed", function() {
    var sender = {
      address: "12929291r"
    };

    it("calls setAccountAndGet", function(done) {
      var modules = Signature.__get__("modules");
      modules.accounts = { setAccountAndGet: function() {} };
      var setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
      var expectedData = {
        address: sender.address,
        u_secondSignature: 0
      };

      instance.undoUnconfirmed(trs, sender, callback);

      expect(setAccountAndGet.calledOnce).to.be.true;
      expect(setAccountAndGet.getCall(0).args.length).to.equal(2);
      expect(setAccountAndGet.getCall(0).args[0]).to.deep.equal(expectedData);
      expect(setAccountAndGet.getCall(0).args[1]).to.deep.equal(callback);

      setAccountAndGet.restore();
      done();
    });
  });

  describe("schema", function() {
    it("is correct", function(done) {
      var expectedSchema = {
        id: "Signature",
        object: true,
        properties: {
          publicKey: {
            type: "string",
            format: "publicKey"
          }
        },
        required: ["publicKey"]
      };
      expect(instance.schema).to.be.deep.equal(expectedSchema);

      done();
    });
  });

  describe("objectNormalize", function() {
    var library, validate;
    beforeEach(function() {
      library = Signature.__get__("library");
      library.schema = { validate: function() {} };
    });

    it("throws error", function(done) {
      validate = sinon.stub(library.schema, "validate").returns(false);

      var throwError = function() {
        instance.objectNormalize(trs);
      };

      expect(throwError).to.throw();

      done();
    });

    it("success", function(done) {
      validate = sinon.stub(library.schema, "validate").returns(true);

      var retVal = instance.objectNormalize(trs);

      expect(library.schema.validate.calledOnce).to.be.true;
      expect(library.schema.validate.getCall(0).args.length).to.equal(2);
      expect(library.schema.validate.getCall(0).args[0]).to.deep.equal(
        trs.asset.signature
      );
      expect(library.schema.validate.getCall(0).args[1]).to.equal(
        instance.schema
      );
      expect(retVal).to.deep.equal(trs);

      done();
    });
  });

  describe("dbRead", function() {
    it("returns null with no s_publicKey", function(done) {
      var raw = {};

      var retVal = instance.dbRead(raw);

      expect(retVal).to.equal(null);

      done();
    });

    it("success", function(done) {
      var raw = {
        t_id: "0123",
        s_publicKey: "98765"
      };
      var expectedResult = {
        signature: {
          transactionId: raw.t_id,
          publicKey: raw.s_publicKey
        }
      };

      var retVal = instance.dbRead(raw);

      expect(retVal).to.deep.equal(expectedResult);

      done();
    });
  });

  describe("dbTable", function() {
    it("is correct", function(done) {
      var expectedDbTable = "signatures";
      expect(instance.dbTable).to.be.equal(expectedDbTable);

      done();
    });
  });

  describe("dbFields", function() {
    it("is correct", function(done) {
      var expectedDbFields = ["transactionId", "publicKey"];
      expect(instance.dbFields).to.be.deep.equal(expectedDbFields);

      done();
    });
  });

  describe("dbSave", function() {
    it("throws error", function(done) {
      trs.asset.signature.publicKey = undefined;
      var throwError = function() {
        instance.dbSave.call(context, trs);
      };

      expect(throwError).to.throw();

      done();
    });
    it("returns correct value", function(done) {
      var context = {
        dbTable: "signatures",
        dbFields: ["transactionId", "publicKey"]
      };
      var buffer = Buffer.from(trs.asset.signature.publicKey, "hex");
      var expectedObj = {
        table: context.dbTable,
        fields: context.dbFields,
        values: {
          transactionId: trs.id,
          publicKey: buffer
        }
      };

      var retVal = instance.dbSave.call(context, trs);

      expect(retVal).to.deep.equal(expectedObj);

      done();
    });
  });

  describe("ready", function() {
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
      trs.signatures = [1, 2, 3];
      var retVal = instance.ready(trs, sender);

      expect(retVal).to.equal(true);

      done();
    });

    it("returns not ready when signatures > multimin", function(done) {
      var sender = {
        multisignatures: [1],
        multimin: 10
      };
      trs.signatures = [1, 2, 3];
      var retVal = instance.ready(trs, sender);

      expect(retVal).to.equal(false);

      done();
    });
  });
});
