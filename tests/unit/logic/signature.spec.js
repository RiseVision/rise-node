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
		clock.restore();
	});

	describe("constructor", function() {
		it("should be a function", function() {
			expect(Signature).to.be.a("function");

		});
		it("should be an instance of Signature", function() {
			expect(instance).to.be.an.instanceOf(Signature);

			var library = Signature.__get__("library");
			expect(library).to.be.deep.equal({
				schema: schema,
				logger: logger
			});

		});
	});

	describe("bind", function() {
		it("binds the modules", function() {
			instance.bind({}, {});
			var modules = Signature.__get__("modules");

			expect(modules).to.be.deep.equal({
				accounts: {},
				system: {}
			});

		});
	});

	describe("create", function() {
		it("returns correct trs", function() {
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

		});
	});

	describe("calculateFee", function() {
		it("getFees is called", function() {

      var modules = {
      	system: {
      		getFees: function(){}
				}
			};
      var getFees = sinon.stub(modules.system, "getFees").returns({
				fees: {
          secondsignature: 1
				}
			});
      Signature.__set__("modules", modules);

			var retVal = instance.calculateFee(null, null, 10);

			expect(retVal).to.be.equal(1);
			expect(getFees.calledOnce).to.be.true;
			expect(getFees.firstCall.args.length).to.equal(1);
			expect(getFees.firstCall.args[0]).to.equal(10);

      Signature.__get__("modules").system.getFees.restore();
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

		it("error cb 'Invalid transaction asset'", function() {
			delete trs.asset.signature;
			instance.verify(trs, null, callback);
			clock.tick();
			delete trs.asset;
			instance.verify(trs, null, callback);
			clock.tick();

			expect(callback.calledTwice).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid transaction asset");
			expect(callback.getCall(1).args.length).to.equal(1);
			expect(callback.getCall(1).args[0]).to.equal("Invalid transaction asset");

		});

		it("error cb 'Invalid transaction amount'", function() {
			trs.amount = 10;
			instance.verify(trs, null, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid transaction amount");

		});

		it("error cb first 'Invalid public key'", function() {
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
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid public key");
			expect(callback.getCall(1).args.length).to.equal(1);
			expect(callback.getCall(1).args[0]).to.equal("Invalid public key");

			expect(from.calledOnce).to.be.true;
			expect(from.firstCall.args.length).to.equal(2);
			expect(from.firstCall.args[0]).to.equal(pubKey);
			expect(from.firstCall.args[1]).to.equal("hex");

			Signature.__get__("Buffer").from.restore();
		});

		it("error cb second 'Invalid public key'", function() {

			var library = {
				logger: {
					error: function() {}
				}
			};

			Signature.__set__("library", library);
			var oldPublicKey = trs.asset.signature.publicKey;
      trs.asset.signature.publicKey = 'xx';
			instance.verify(trs, null, callback);
      trs.asset.signature.publicKey = oldPublicKey;
      clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid public key");

			// Signature.__get__("library").logger.error.restore();
		});
	});

	describe("process", function() {
		it("calls cb", function() {
			instance.process(trs, {}, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.deep.true;

			expect(callback.firstCall.args.length).to.equal(2);
			expect(callback.firstCall.args[0]).to.be.equal(null);
			expect(callback.firstCall.args[1]).to.be.deep.equal(trs);

		});
	});

	describe("getBytes", function() {
		it("throws error", function() {
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
			expect(from.firstCall.args.length).to.equal(2);
			expect(from.firstCall.args[0]).to.equal(pubKey);
			expect(from.firstCall.args[1]).to.equal("hex");

			Signature.__get__("Buffer").from.restore();
		});
		it("returns buffer", function() {
			var retVal = instance.getBytes(trs);
			expect(retVal).to.be.instanceOf(Buffer);
		});
	});

	describe("apply", function() {
		var sender = {
			address: "12929291r"
		};

		it("calls setAccountAndGet", function() {
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
			expect(setAccountAndGet.firstCall.args.length).to.equal(2);
			expect(setAccountAndGet.firstCall.args[0]).to.deep.equal(expectedData);
			expect(setAccountAndGet.firstCall.args[1]).to.deep.equal(callback);

			setAccountAndGet.restore();
			trs.asset.delegate.username = "carbonara";
		});
	});

	describe("undo", function() {
		var sender = {
			address: "12929291r"
		};

		it("calls setAccountAndGet", function() {
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
			expect(setAccountAndGet.firstCall.args.length).to.equal(2);
			expect(setAccountAndGet.firstCall.args[0]).to.deep.equal(expectedData);
			expect(setAccountAndGet.firstCall.args[1]).to.deep.equal(callback);

			setAccountAndGet.restore();
			trs.asset.delegate.username = "carbonara";
		});
	});

	describe("applyUnconfirmed", function() {
		var sender = {
			address: "12929291r"
		};

		it("calls cb", function() {
			sender.u_secondSignature = true;
			instance.applyUnconfirmed(trs, sender, callback);
			clock.tick();
			delete sender.u_secondSignature;
			sender.secondSignature = true;
			instance.applyUnconfirmed(trs, sender, callback);
			clock.tick();

			expect(callback.calledTwice).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.deep.equal(
				"Second signature already enabled"
			);
			expect(callback.getCall(1).args.length).to.equal(1);
			expect(callback.getCall(1).args[0]).to.deep.equal(
				"Second signature already enabled"
			);

			delete sender.secondSignature;
		});

		it("calls setAccountAndGet", function() {
			var modules = Signature.__get__("modules");
			modules.accounts = { setAccountAndGet: function() {} };
			var setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
			var expectedData = {
				address: sender.address,
				u_secondSignature: 1
			};

			instance.applyUnconfirmed(trs, sender, callback);

			expect(setAccountAndGet.calledOnce).to.be.true;
			expect(setAccountAndGet.firstCall.args.length).to.equal(2);
			expect(setAccountAndGet.firstCall.args[0]).to.deep.equal(expectedData);
			expect(setAccountAndGet.firstCall.args[1]).to.deep.equal(callback);

			setAccountAndGet.restore();
		});
	});

	describe("undoUnconfirmed", function() {
		var sender = {
			address: "12929291r"
		};

		it("calls setAccountAndGet", function() {
			var modules = Signature.__get__("modules");
			modules.accounts = { setAccountAndGet: function() {} };
			var setAccountAndGet = sinon.stub(modules.accounts, "setAccountAndGet");
			var expectedData = {
				address: sender.address,
				u_secondSignature: 0
			};

			instance.undoUnconfirmed(trs, sender, callback);

			expect(setAccountAndGet.calledOnce).to.be.true;
			expect(setAccountAndGet.firstCall.args.length).to.equal(2);
			expect(setAccountAndGet.firstCall.args[0]).to.deep.equal(expectedData);
			expect(setAccountAndGet.firstCall.args[1]).to.deep.equal(callback);

			setAccountAndGet.restore();
		});
	});

	describe("schema", function() {
		it("is correct", function() {
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

		});
	});

	describe("objectNormalize", function() {
		var library, validate;
		beforeEach(function() {
			library = Signature.__get__("library");
			library.schema = { validate: function() {} };
		});

		it("throws error", function() {
			validate = sinon.stub(library.schema, "validate").returns(false);

			var throwError = function() {
				instance.objectNormalize(trs);
			};

			expect(throwError).to.throw();

		});

		it("success", function() {
			validate = sinon.stub(library.schema, "validate").returns(true);

			var retVal = instance.objectNormalize(trs);

			expect(library.schema.validate.calledOnce).to.be.true;
			expect(library.schema.validate.firstCall.args.length).to.equal(2);
			expect(library.schema.validate.firstCall.args[0]).to.deep.equal(
				trs.asset.signature
			);
			expect(library.schema.validate.firstCall.args[1]).to.equal(instance.schema);
			expect(retVal).to.deep.equal(trs);

		});
	});

	describe("dbRead", function() {
		it("returns null with no s_publicKey", function() {
			var raw = {};

			var retVal = instance.dbRead(raw);

			expect(retVal).to.equal(null);

		});

		it("success", function() {
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

		});
	});

	describe("dbTable", function() {
		it("is correct", function() {
			var expectedDbTable = "signatures";
			expect(instance.dbTable).to.be.equal(expectedDbTable);

		});
	});

	describe("dbFields", function() {
		it("is correct", function() {
			var expectedDbFields = ["transactionId", "publicKey"];
			expect(instance.dbFields).to.be.deep.equal(expectedDbFields);

		});
	});

	describe("dbSave", function() {
		it("throws error", function() {
			trs.asset.signature.publicKey = undefined;
			var throwError = function() {
				instance.dbSave.call(context, trs);
			};

			expect(throwError).to.throw();

		});
		it("returns correct value", function() {
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

		});
	});

	describe("ready", function() {
		it("returns false with no signatures", function() {
			var sender = {
				multisignatures: [1]
			};
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(false);

		});

		it("returns ready when signatures < multimin", function() {
			var sender = {
				multisignatures: [1],
				multimin: 2
			};
			trs.signatures = [1, 2, 3];
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(true);

		});

		it("returns not ready when signatures > multimin", function() {
			var sender = {
				multisignatures: [1],
				multimin: 10
			};
			trs.signatures = [1, 2, 3];
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(false);

		});
	});
});
