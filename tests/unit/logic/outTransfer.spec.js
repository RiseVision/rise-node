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
		rounds,
		block;

	beforeEach(function() {
		db = {
			one: sinon.stub().resolves(true)
		};
		schema = {};
		logger = {
			error: sinon.stub(),
			debug: sinon.stub()
		};

		accounts = {};
		rounds = {};
		dapps = [];
		system = {};

		trs = {
			amount: 100,
			recipientId: "carbonara",
			asset: {
				outTransfer: {
					dappId: "123",
					transactionId: "1234"
				}
			}
		};
		sender = {
			multisignatures: ["1", "2"]
		};
		block = {
			id: "carbonara",
			height: "tall enough"
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
				logger: logger
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
				recipientId: "carbonara",
				amount: 100,
				dappId: "dappId",
				transactionId: "transactionId"
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
			trs.asset.outTransfer.dappId = "....";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid outTransfer dappId");
		});

		it("returns 'Invalid outTransfer transactionId", function() {
			trs.asset.outTransfer.transactionId = "....";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(
				"Invalid outTransfer transactionId"
			);
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
			db.one.resolves({ count: 0 });
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
				expect(callback.firstCall.args[0]).to.equal("Application not found: 123");
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

			db.one.resolves({ count: 1 });
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
				expect(callback.firstCall.args[0]).to.equal(
					"Transaction is already processed: 1234"
				);

				OutTransfer.__set__("__private", private);
				done();
			}, 0);
		});

		it("resolves Transaction is already processed:", function(done) {
			db.one.callsFake(function(query) {
				if (query === sql.countByTransactionId)
					return Promise.resolve({ count: 1 });
				else if (query === sql.countByOutTransactionId)
					return Promise.resolve({ count: 1 });
			});
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
				expect(callback.firstCall.args[0]).to.equal(
					"Transaction is already confirmed: 1234"
				);

				done();
			}, 0);
		});

		it("second db.one resolves error", function(done) {
			db.one.callsFake(function(query) {
				if (query === sql.countByTransactionId)
					return Promise.resolve({ count: 1 });
				else if (query === sql.countByOutTransactionId)
					return Promise.reject("carbonara");
			});
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
				expect(callback.firstCall.args[0]).to.equal("carbonara");

				done();
			}, 0);
		});

		it("success", function(done) {
			db.one.callsFake(function(query) {
				if (query === sql.countByTransactionId)
					return Promise.resolve({ count: 1 });
				else if (query === sql.countByOutTransactionId)
					return Promise.resolve({ count: 0 });
			});
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
				expect(callback.firstCall.args.length).to.equal(2);
				expect(callback.firstCall.args[0]).to.equal(null);
				expect(callback.firstCall.args[1]).to.equal(trs);

				done();
			}, 0);
		});
	});

	describe("getBytes", function() {
		var from;

		beforeEach(function() {
			from = sinon.spy(Buffer, "from");
		});
		afterEach(function() {
			from.restore();
		});

		it("throws error wrong dappId", function() {
			trs.asset.outTransfer.dappId = {};
			var throwError = function() {
				instance.getBytes(trs);
			};

			expect(throwError).to.throw();
			expect(from.calledTwice).to.be.true;
		});
		it("throws error wrong utf8", function() {
			trs.asset.outTransfer.transactionId = {};

			var throwError = function() {
				instance.getBytes(trs);
			};

			expect(throwError).to.throw();
			expect(from.calledThrice).to.be.true;
		});
		it("success", function() {
			var retVal = instance.getBytes(trs);
			expect(retVal).to.be.instanceOf(Buffer);
			expect(from.calledThrice).to.be.true;
		});
	});

	describe("apply", function() {
		var setAccountAndGet,
			modules,
			setAccountAndGet,
			mergeAccountAndGet,
			mockedModules,
			calc;

		beforeEach(function() {
			mockedModules = {
				rounds: {
					calc: function() {}
				},
				accounts: {
					setAccountAndGet: function() {},
					mergeAccountAndGet: function() {}
				}
			};

			setAccountAndGet = sinon
				.stub(mockedModules.accounts, "setAccountAndGet")
				.callsFake(function(carbonara, cb) {
					return cb();
				});
			mergeAccountAndGet = sinon
				.stub(mockedModules.accounts, "mergeAccountAndGet")
				.callsFake(function(carbonara, cb) {
					return cb();
				});
			calc = sinon.stub(mockedModules.rounds, "calc").returns(5);
			modules = OutTransfer.__get__("modules");

			OutTransfer.__set__("modules", mockedModules);
		});
		afterEach(function() {
			setAccountAndGet.restore();
			mergeAccountAndGet.restore();
			calc.restore();
			OutTransfer.__set__("modules", modules);
		});

		it("calls cb with error", function() {
			setAccountAndGet.restore();
			setAccountAndGet = sinon
				.stub(mockedModules.accounts, "setAccountAndGet")
				.callsFake(function(carbonara, cb) {
					return cb(true);
				});

			OutTransfer.__set__("modules", mockedModules);

			instance.apply(trs, block, sender, callback);
			clock.tick();
			var __private = OutTransfer.__get__("__private");

			expect(__private.unconfirmedOutTansfers[trs.asset.outTransfer.transactionId])
				.to.be.false;

			expect(setAccountAndGet.calledOnce).to.be.true;
			expect(setAccountAndGet.firstCall.args.length).to.equal(2);
			expect(setAccountAndGet.firstCall.args[0]).to.deep.equal({
				address: trs.recipientId
			});
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(true);
		});

		it("calls mergeAccountAndGet with error", function() {
			mergeAccountAndGet.restore();
			mergeAccountAndGet = sinon
				.stub(mockedModules.accounts, "mergeAccountAndGet")
				.callsFake(function(carbonara, cb) {
					return cb(true);
				});

			OutTransfer.__set__("modules", mockedModules);

			instance.apply(trs, block, sender, callback);
			clock.tick();
			var __private = OutTransfer.__get__("__private");

			expect(__private.unconfirmedOutTansfers[trs.asset.outTransfer.transactionId])
				.to.be.false;

			expect(mergeAccountAndGet.calledOnce).to.be.true;
			expect(mergeAccountAndGet.firstCall.args.length).to.equal(2);
			expect(mergeAccountAndGet.firstCall.args[0]).to.deep.equal({
				address: "carbonara",
				balance: 100,
				blockId: "carbonara",
				round: 5,
				u_balance: 100
			});
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(true);
		});

		it("calls mergeAccountAndGet without", function() {
			OutTransfer.__set__("modules", mockedModules);

			instance.apply(trs, block, sender, callback);
			clock.tick();
			var __private = OutTransfer.__get__("__private");

			expect(__private.unconfirmedOutTansfers[trs.asset.outTransfer.transactionId])
				.to.be.false;

			expect(mergeAccountAndGet.calledOnce).to.be.true;
			expect(mergeAccountAndGet.firstCall.args.length).to.equal(2);
			expect(mergeAccountAndGet.firstCall.args[0]).to.deep.equal({
				address: "carbonara",
				balance: 100,
				blockId: "carbonara",
				round: 5,
				u_balance: 100
			});
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(undefined);
		});
	});

	describe("undo", function() {
		var setAccountAndGet,
			modules,
			setAccountAndGet,
			mergeAccountAndGet,
			mockedModules,
			calc;

		beforeEach(function() {
			mockedModules = {
				rounds: {
					calc: function() {}
				},
				accounts: {
					setAccountAndGet: function() {},
					mergeAccountAndGet: function() {}
				}
			};

			setAccountAndGet = sinon
				.stub(mockedModules.accounts, "setAccountAndGet")
				.callsFake(function(carbonara, cb) {
					return cb();
				});
			mergeAccountAndGet = sinon
				.stub(mockedModules.accounts, "mergeAccountAndGet")
				.callsFake(function(carbonara, cb) {
					return cb();
				});
			calc = sinon.stub(mockedModules.rounds, "calc").returns(5);
			modules = OutTransfer.__get__("modules");

			OutTransfer.__set__("modules", mockedModules);
		});
		afterEach(function() {
			setAccountAndGet.restore();
			mergeAccountAndGet.restore();
			calc.restore();
			OutTransfer.__set__("modules", modules);
		});

		it("calls cb with error", function() {
			setAccountAndGet.restore();
			setAccountAndGet = sinon
				.stub(mockedModules.accounts, "setAccountAndGet")
				.callsFake(function(carbonara, cb) {
					return cb(true);
				});

			OutTransfer.__set__("modules", mockedModules);

			instance.undo(trs, block, sender, callback);
			clock.tick();
			var __private = OutTransfer.__get__("__private");

			expect(__private.unconfirmedOutTansfers[trs.asset.outTransfer.transactionId])
				.to.be.true;

			expect(setAccountAndGet.calledOnce).to.be.true;
			expect(setAccountAndGet.firstCall.args.length).to.equal(2);
			expect(setAccountAndGet.firstCall.args[0]).to.deep.equal({
				address: trs.recipientId
			});
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(true);
		});

		it("calls mergeAccountAndGet with error", function() {
			mergeAccountAndGet.restore();
			mergeAccountAndGet = sinon
				.stub(mockedModules.accounts, "mergeAccountAndGet")
				.callsFake(function(carbonara, cb) {
					return cb(true);
				});

			OutTransfer.__set__("modules", mockedModules);

			instance.undo(trs, block, sender, callback);
			clock.tick();
			var __private = OutTransfer.__get__("__private");

			expect(__private.unconfirmedOutTansfers[trs.asset.outTransfer.transactionId])
				.to.be.true;

			expect(mergeAccountAndGet.calledOnce).to.be.true;
			expect(mergeAccountAndGet.firstCall.args.length).to.equal(2);
			expect(mergeAccountAndGet.firstCall.args[0]).to.deep.equal({
				address: "carbonara",
				balance: -100,
				blockId: "carbonara",
				round: 5,
				u_balance: -100
			});
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(true);
		});

		it("calls mergeAccountAndGet without", function() {
			OutTransfer.__set__("modules", mockedModules);

			instance.undo(trs, block, sender, callback);
			clock.tick();
			var __private = OutTransfer.__get__("__private");

			expect(__private.unconfirmedOutTansfers[trs.asset.outTransfer.transactionId])
				.to.be.true;

			expect(mergeAccountAndGet.calledOnce).to.be.true;
			expect(mergeAccountAndGet.firstCall.args.length).to.equal(2);
			expect(mergeAccountAndGet.firstCall.args[0]).to.deep.equal({
				address: "carbonara",
				balance: -100,
				blockId: "carbonara",
				round: 5,
				u_balance: -100
			});
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(undefined);
		});
	});

	describe("applyUnconfirmed", function() {
		it("calls cb", function() {
			instance.applyUnconfirmed(trs, sender, callback);
			clock.tick();
			var __private = OutTransfer.__get__("__private");

			expect(__private.unconfirmedOutTansfers[trs.asset.outTransfer.transactionId])
				.to.be.true;
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(0);
		});
	});

	describe("undoUnconfirmed", function() {
		it("calls cb", function() {
			instance.undoUnconfirmed(trs, sender, callback);
			clock.tick();
			var __private = OutTransfer.__get__("__private");

			expect(__private.unconfirmedOutTansfers[trs.asset.outTransfer.transactionId])
				.to.be.false;
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(0);
		});
	});

	describe("schema", function() {
		it("is correct", function() {
			var schema = instance.schema;
			var expectedSchema = {
				id: "OutTransfer",
				object: true,
				properties: {
					dappId: {
						type: "string",
						format: "id",
						minLength: 1,
						maxLength: 20
					},
					transactionId: {
						type: "string",
						format: "id",
						minLength: 1,
						maxLength: 20
					}
				},
				required: ["dappId", "transactionId"]
			};

			expect(schema).to.deep.equal(expectedSchema);
		});
	});

	describe("objectNormalize", function() {
		var library, validate;
		beforeEach(function() {
			library = OutTransfer.__get__("library");
			library.schema = { validate: function() {} };
		});
		afterEach(function() {
			if (validate && validate.restore) validate.restore();
		});

		it("throws error", function(done) {
			validate = sinon.stub(library.schema, "validate").returns(false);

			var throwError = function() {
				var context = {
					schema: {
						getLastErrors: sinon.stub().returns([new Error("error")])
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

			expect(validate.calledOnce).to.be.true;
			expect(library.schema.validate.getCall(0).args.length).to.equal(2);
			expect(library.schema.validate.getCall(0).args[0]).to.deep.equal(
				trs.asset.outTransfer
			);
			expect(library.schema.validate.getCall(0).args[1]).to.equal(
				OutTransfer.prototype.schema
			);

			done();
		});
	});

	describe("dbRead", function() {
		var raw;
		beforeEach(function() {
			raw = {
				ot_dappId: "carbonara",
				transactionId: "is available for hire"
			};
		});

		it("returns null", function(done) {
			raw.ot_dappId = false;
			var retVal = instance.dbRead(raw);

			expect(retVal).to.equal(null);

			done();
		});

		it("returns outTransfer", function(done) {
			var retVal = instance.dbRead(raw);

			expect(retVal).to.deep.equal({
				outTransfer: {
					dappId: raw.ot_dappId,
					transactionId: raw.ot_outTransactionId
				}
			});

			done();
		});
	});

	describe("dbTable", function() {
		it("is correct", function() {
			var dbTable = instance.dbTable;

			expect(dbTable).to.deep.equal("outtransfer");
		});
	});

	describe("dbFields", function() {
		it("is correct", function() {
			var dbFields = instance.dbFields;

			expect(dbFields).to.deep.deep.equal([
				"dappId",
				"outTransactionId",
				"transactionId"
			]);
		});
	});

	describe("dbSave", function() {
		it("returns correct", function() {
			var dbFields = instance.dbSave(trs);

			expect(dbFields).to.deep.deep.equal({
				table: instance.dbTable,
				fields: instance.dbFields,
				values: {
					dappId: trs.asset.outTransfer.dappId,
					outTransactionId: trs.asset.outTransfer.transactionId,
					transactionId: trs.id
				}
			});
		});
	});

	describe("afterSave", function() {
		it("calls dapps message", function() {
			var mockedModules = {
				dapps: {
					message: function() {}
				}
			};
			var message = sinon
				.stub(mockedModules.dapps, "message")
				.callsFake(function(dappId, obj, cb) {
					return cb(true);
				});

			var modules = OutTransfer.__get__("modules");
			OutTransfer.__set__("modules", mockedModules);

			instance.afterSave(trs, callback);
			clock.tick();

			expect(message.calledOnce).to.be.true;
			expect(message.firstCall.args.length).to.be.equal(3);
			expect(message.firstCall.args[0]).to.be.equal(trs.asset.outTransfer.dappId);
			expect(message.firstCall.args[1]).to.be.deep.equal({
				topic: "withdrawal",
				message: {
					transactionId: trs.id
				}
			});
			expect(typeof message.firstCall.args[2]).to.equal("function");

			expect(logger.debug.calledOnce).to.be.true;
			expect(logger.debug.firstCall.args.length).to.equal(1);
			expect(logger.debug.firstCall.args[0]).to.be.true;
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(0);

			OutTransfer.__set__("modules", modules);
		});
		it("calls dapps message", function() {
			var mockedModules = {
				dapps: {
					message: function() {}
				}
			};
			var message = sinon
				.stub(mockedModules.dapps, "message")
				.callsFake(function(dappId, obj, cb) {
					return cb(false);
				});

			var modules = OutTransfer.__get__("modules");
			OutTransfer.__set__("modules", mockedModules);

			instance.afterSave(trs, callback);
			clock.tick();

			expect(message.calledOnce).to.be.true;
			expect(message.firstCall.args.length).to.be.equal(3);
			expect(message.firstCall.args[0]).to.be.equal(trs.asset.outTransfer.dappId);
			expect(message.firstCall.args[1]).to.be.deep.equal({
				topic: "withdrawal",
				message: {
					transactionId: trs.id
				}
			});
			expect(typeof message.firstCall.args[2]).to.equal("function");

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(0);

			OutTransfer.__set__("modules", modules);
		});
	});

	describe("ready", function() {
		it("returns true when no multisig", function() {
			sender.multisignatures = "not an array";
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(true);
		});
		it("returns true when no multisig", function() {
			sender.multisignatures = [];
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(true);
		});
		it("returns false when no signatures", function() {
			sender.multisignatures = ["1", "2", "3"];
			trs.signatures = "signature";
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(false);
		});
		it("returns false when not enough signatures", function() {
			sender.multisignatures = ["1", "2", "3"];
			trs.signatures = ["1", "2", "3"];
			sender.multimin = 4;
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(false);
		});
		it("returns true when enough signatures", function() {
			sender.multisignatures = ["1", "2", "3"];
			trs.signatures = ["1", "2", "3"];
			sender.multimin = 2;
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(true);
		});
	});
});
