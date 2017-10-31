var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var constants = require(path.join(rootDir, "helpers/constants"));
var exceptions = require(path.join(rootDir, "helpers/exceptions"));
var Multisignature = rewire(path.join(rootDir, "logic/multisignature"));

describe("modules/multisignature", function() {
	var instance,
		callback,
		schema,
		network,
		transaction,
		logger,
		clock,
		trs,
		block,
		sender,
		rounds,
		accounts,
		system;

	beforeEach(function() {
		schema = {};
		network = {
			io: {
				sockets: {
					emit: sinon.stub()
				}
			}
		};
		transaction = {};
		logger = {
			debug: sinon.stub(),
			error: sinon.stub()
		};
		trs = {
			signatures: ["+929292929"],
			asset: {
				signature: ["+929292929"],
				multisignature: {
					keysgroup: ["+929292929"],
					min: 1,
					lifetime: 2
				}
			}
		};
		block = {
			id: "big block",
			height: "tall enough"
		};
		sender = {
			address: "1"
		};
		rounds = {};
		accounts = {};
		system = {};
		clock = sinon.useFakeTimers("setImmediate");
		Multisignature.__set__("setImmediate", setImmediate);
		callback = sinon.stub();
		instance = new Multisignature(schema, network, transaction, logger);
	});
	afterEach(function() {
		clock.restore();
	});

	describe("constructor", function() {
		it("should be a function", function() {
			expect(Multisignature).to.be.a("function");
		});

		it("success", function() {
			var expectedLibrary = {
				schema: schema,
				network: network,
				logger: logger,
				logic: {
					transaction: transaction
				}
			};
			var library = Multisignature.__get__("library");

			expect(library).to.deep.equal(expectedLibrary);
		});
	});

	describe("bind", function() {
		it("binds modules", function() {
			var expectedModules;
			rounds = {};
			accounts = {};
			system = {};
			expectedModules = {
				rounds: rounds,
				accounts: accounts,
				system: system
			};

			instance.bind(rounds, accounts, system);
			var modules = Multisignature.__get__("modules");

			expect(modules).to.deep.equal(expectedModules);
		});
	});

	describe("create", function() {
		it("returns correct trs", function() {
			var data, trs, expectedTrs;
			trs = {
				asset: {}
			};
			data = {
				min: 10,
				keysgroup: 100,
				lifetime: 1000
			};
			expectedTrs = {
				recipientId: null,
				amount: 0,
				asset: {
					multisignature: {
						min: data.min,
						keysgroup: data.keysgroup,
						lifetime: data.lifetime
					}
				}
			};

			var retVal = instance.create(data, trs);

			expect(retVal).to.deep.equal(expectedTrs);
		});
	});

	describe("calculateFee", function() {
		it("returns correct trs", function() {
			var trs, modules, getFees, height;

			height = 10;
			trs = {
				asset: {
					multisignature: {
						keysgroup: [1, 2, 3]
					}
				}
			};
			modules = Multisignature.__get__("modules");
			modules.system = { getFees: function() {} };
			getFees = sinon.stub(modules.system, "getFees").returns({
				fees: {
					multisignature: 1
				}
			});

			var retVal = instance.calculateFee(trs, null, height);

			expect(retVal).to.deep.equal(4);
			expect(getFees.calledOnce).to.be.true;
			expect(getFees.firstCall.args.length).to.equal(1);
			expect(getFees.firstCall.args[0]).to.equal(height);

			getFees.restore();
		});
	});

	describe("verify", function() {
		var ready, library, verifySignature, Buff, from;

		beforeEach(function() {
			sender = {
				multisignatures: false
			};
			ready = sinon.stub(instance, "ready").returns(true);
			library = Multisignature.__get__("library");
			library.logic.transaction = {
				verifySignature: function() {}
			};
			verifySignature = sinon
				.stub(library.logic.transaction, "verifySignature")
				.returns(true);
		});
		afterEach(function() {
			ready.restore();
			clock.restore();
			verifySignature.restore();
		});

		it("returns 'Invalid transaction asset'", function() {
			var tempTrs = {};
			Object.assign(tempTrs, trs);
			delete tempTrs.asset.multisignature;
			instance.verify(tempTrs, sender, callback);
			clock.tick();

			delete tempTrs.asset;
			instance.verify(tempTrs, sender, callback);
			clock.tick();

			expect(callback.calledTwice).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid transaction asset");
			expect(callback.secondCall.args.length).to.equal(1);
			expect(callback.secondCall.args[0]).to.equal("Invalid transaction asset");
		});

		it("returns 'Invalid multisignature keysgroup'", function() {
			var tempTrs = {};
			Object.assign(tempTrs, trs);
			delete tempTrs.asset.multisignature.keysgroup;
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(
				"Invalid multisignature keysgroup. Must be an array"
			);
		});

		it("returns 'Invalid multisignature keysgroup'", function() {
			trs.asset.multisignature.keysgroup = [];
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(
				"Invalid multisignature keysgroup. Must not be empty"
			);
		});

		it("returns 'Invalid transaction asset'", function() {
			trs.asset.multisignature.min = constants.multisigConstraints.min.minimum - 1;
			instance.verify(trs, sender, callback);
			clock.tick();

			trs.asset.multisignature.min = constants.multisigConstraints.min.maximum + 1;
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledTwice).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.contain(
				"Invalid multisignature min. Must be between"
			);
			expect(callback.secondCall.args.length).to.equal(1);
			expect(callback.secondCall.args[0]).to.contain(
				"Invalid multisignature min. Must be between"
			);
		});

		it("returns Invalid 'multisignature min.'", function() {
			trs.asset.multisignature.min = trs.asset.multisignature.keysgroup.length + 1;
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.contain(
				"Invalid multisignature min. Must be less than or equal to keysgroup size"
			);
		});

		it("Invalid multisignature lifetime'", function() {
			trs.asset.multisignature.min =
				constants.multisigConstraints.lifetime.minimum - 1;
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.contain(
				"Invalid multisignature min. Must be between 1 and 15"
			);
		});

		it("error Account already has multisignatures enabled'", function() {
			sender.multisignatures = [1];
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.contain(
				"Account already has multisignatures enabled"
			);
		});

		it("error no signatures Failed to verify signature in multisignature keysgroup'", function() {
			trs.signatures = false;
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(ready.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.contain(
				"Failed to verify signature in multisignature keysgroup"
			);
		});

		it("catches error Failed to verify signature in multisignature keysgroup'", function() {
			verifySignature.throws();
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(ready.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.contain(
				"Failed to verify signature in multisignature keysgroup"
			);
		});

		it("not valid Failed to verify signature in multisignature keysgroup", function() {
			verifySignature.returns(false);
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(ready.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.contain(
				"Failed to verify signature in multisignature keysgroup"
			);
		});

		it("Invalid multisignature keysgroup. Can not contain sender", function() {
			sender.publicKey = "929292929";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(ready.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.contain(
				"Invalid multisignature keysgroup. Can not contain sender"
			);
		});

		it("Invalid multisignature keysgroup. Can not contain sender", function() {
			sender.publicKey = "929292929";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(ready.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.contain(
				"Invalid multisignature keysgroup. Can not contain sender"
			);
		});

		it("Invalid math operator in multisignature keysgroup", function(done) {
			trs.asset.multisignature.keysgroup[0] = "-";
			instance.verify(trs, sender, callback);
			clock.runAll();

			setTimeout(function() {
				expect(callback.calledOnce).to.be.true;
				expect(ready.calledOnce).to.be.true;
				expect(callback.firstCall.args.length).to.equal(1);
				expect(callback.firstCall.args[0]).to.contain(
					"Invalid math operator in multisignature keysgroup"
				);
				done();
			}, 0);
		});

		it("Invalid public key in multisignature keysgroup", function(done) {
			instance.verify(trs, sender, callback);
			clock.runAll();

			setTimeout(function() {
				expect(callback.calledOnce).to.be.true;
				expect(ready.calledOnce).to.be.true;
				expect(callback.firstCall.args.length).to.equal(1);
				expect(callback.firstCall.args[0]).to.contain(
					"Invalid public key in multisignature keysgroup"
				);
				expect(library.logger.error.calledOnce).to.be.true;
				done();
			}, 0);
		});

		it("success", function(done) {
			trs.asset.multisignature.keysgroup[0] = "+7067a911f3a4e13facbae9006b52a0c3ac9824bdd9f37168303152ae49dcb1c0";
			instance.verify(trs, sender, callback);
			clock.runAll();

			setTimeout(function() {
				expect(callback.calledOnce).to.be.true;
				expect(ready.calledOnce).to.be.true;
				expect(callback.firstCall.args.length).to.equal(2);
				expect(callback.firstCall.args[0]).to.equal(null);
				expect(callback.firstCall.args[1]).to.deep.equal(trs);
				done();
			}, 0);
		});
	});

	describe("process", function() {
		it("calls cb", function() {
			instance.process({}, null, callback);
			clock.tick();

			expect(callback.calledOnce).to.equal(true);
			expect(callback.firstCall.args.length).to.equal(2);
			expect(callback.firstCall.args[0]).to.equal(null);
			expect(callback.firstCall.args[1]).to.deep.equal({});
		});
	});

	describe("getBytes", function() {
		it("returns buffer", function() {
			var retVal = instance.getBytes(trs);
			expect(retVal).to.be.instanceOf(Buffer);
		});
	});

	describe("apply", function() {
		var modules, expectedMerge, expectedGet;

		beforeEach(function() {
			rounds = {
				calc: sinon.stub().returns(1)
			};
			accounts = {
				generateAddressByPublicKey: sinon.stub().returns("carbonara"),
				setAccountAndGet: sinon.stub().callsFake(function(obj, cb) {
					return cb();
				})
			};
			system = {};

			instance.bind(rounds, accounts, system);
			modules = Multisignature.__get__("modules");

			expectedMerge = {
				multisignatures: trs.asset.multisignature.keysgroup,
				multimin: trs.asset.multisignature.min,
				multilifetime: trs.asset.multisignature.lifetime,
				blockId: block.id,
				round: 1
			};
			expectedGet = {
				address: "carbonara",
				publicKey: "929292929"
			};
		});

		it("returns error", function() {
			instance.scope = {
				account: {
					merge: sinon.stub().callsFake(function(address, obj, cb) {
						return cb("Something wrong");
					})
				}
			};

			instance.apply(trs, block, sender, callback);
			clock.tick();

			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.firstCall.args[0]).to.equal(
				sender.address
			);
			expect(instance.scope.account.merge.firstCall.args.length).to.be.equal(3);
			expect(instance.scope.account.merge.firstCall.args[1]).to.be.deep.equal(
				expectedMerge
			);
			expect(instance.scope.account.merge.firstCall.args[2]).to.be.function;
			expect(rounds.calc.calledOnce).to.be.true;
			expect(rounds.calc.firstCall.args.length).to.be.equal(1);
			expect(rounds.calc.firstCall.args[0]).to.be.equal(block.height);
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.be.equal(1);
			expect(callback.firstCall.args[0]).to.be.equal("Something wrong");
			expect(accounts.generateAddressByPublicKey.notCalled).to.be.true;
			expect(accounts.setAccountAndGet.notCalled).to.be.true;
		});

		it("calls generateAddressByPublicKey and setAccountAndGet", function() {
			instance.scope = {
				account: {
					merge: sinon.stub().callsFake(function(address, obj, cb) {
						return cb();
					})
				}
			};

			instance.apply(trs, block, sender, callback);
			clock.runAll();

			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.firstCall.args.length).to.be.equal(3);
			expect(instance.scope.account.merge.firstCall.args[0]).to.equal(
				sender.address
			);
			expect(instance.scope.account.merge.firstCall.args[1]).to.be.deep.equal(
				expectedMerge
			);
			expect(instance.scope.account.merge.firstCall.args[2]).to.be.function;
			expect(rounds.calc.calledOnce).to.be.true;
			expect(rounds.calc.firstCall.args.length).to.be.equal(1);
			expect(rounds.calc.firstCall.args[0]).to.be.equal(block.height);
			expect(accounts.generateAddressByPublicKey.calledOnce).to.be.true;
			expect(accounts.generateAddressByPublicKey.firstCall.args.length).to.equal(
				1
			);
			expect(accounts.generateAddressByPublicKey.firstCall.args[0]).to.equal(
				"929292929"
			);
			expect(accounts.setAccountAndGet.calledOnce).to.be.true;
			expect(accounts.setAccountAndGet.firstCall.args.length).to.equal(2);
			expect(accounts.setAccountAndGet.firstCall.args[0]).to.deep.equal(
				expectedGet
			);
			expect(accounts.setAccountAndGet.firstCall.args[1]).to.be.function;
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.be.equal(1);
			expect(callback.firstCall.args[0]).to.be.equal(null);
		});
	});

	describe("undo", function() {
		var modules, expectedMerge;

		beforeEach(function() {
			rounds = {
				calc: sinon.stub().returns(1)
			};
			accounts = {
				generateAddressByPublicKey: sinon.stub().returns("carbonara")
			};
			system = {};

			instance.bind(rounds, accounts, system);
			modules = Multisignature.__get__("modules");

			expectedMerge = {
				multisignatures: trs.asset.multisignature.keysgroup,
				multimin: trs.asset.multisignature.min,
				multilifetime: trs.asset.multisignature.lifetime,
				blockId: block.id,
				round: 1
			};
		});

		it("calls diff.reverse and account.merge", function() {
			instance.scope = {
				account: {
					merge: sinon.stub().callsFake(function(address, obj, cb) {
						return cb("carbonara is the new foo");
					})
				}
			};
			var Diff = Multisignature.__get__("Diff");
			var reverse = sinon.stub(Diff, "reverse").returns("carbonara rocks");

			instance.undo(trs, block, sender, callback);
			clock.tick();

			expect(reverse.calledOnce).to.be.true;
			expect(reverse.firstCall.args.length).to.be.equal(1);
			expect(reverse.firstCall.args[0]).to.be.equal(
				trs.asset.multisignature.keysgroup
			);
			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.firstCall.args[0]).to.equal(
				sender.address
			);
			expect(instance.scope.account.merge.firstCall.args[1]).to.be.function;
			expect(rounds.calc.calledOnce).to.be.true;
			expect(rounds.calc.firstCall.args.length).to.be.equal(1);
			expect(rounds.calc.firstCall.args[0]).to.be.equal(block.height);
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.be.equal(1);
			expect(callback.firstCall.args[0]).to.be.equal("carbonara is the new foo");

			reverse.restore();
		});
	});

	describe("undo", function() {
		var modules, expectedMerge;

		beforeEach(function() {
			rounds = {
				calc: sinon.stub().returns(1)
			};
			accounts = {
				generateAddressByPublicKey: sinon.stub().returns("carbonara")
			};
			system = {};

			instance.bind(rounds, accounts, system);
			modules = Multisignature.__get__("modules");

			expectedMerge = {
				multisignatures: trs.asset.multisignature.keysgroup,
				multimin: trs.asset.multisignature.min,
				multilifetime: trs.asset.multisignature.lifetime,
				blockId: block.id,
				round: 1
			};
		});

		it("calls diff.reverse and account.merge", function() {
			instance.scope = {
				account: {
					merge: sinon.stub().callsFake(function(address, obj, cb) {
						return cb("carbonara is the new foo");
					})
				}
			};
			var Diff = Multisignature.__get__("Diff");
			var reverse = sinon.stub(Diff, "reverse").returns("carbonara rocks");

			instance.undo(trs, block, sender, callback);
			clock.tick();

			expect(reverse.calledOnce).to.be.true;
			expect(reverse.firstCall.args.length).to.be.equal(1);
			expect(reverse.firstCall.args[0]).to.be.equal(
				trs.asset.multisignature.keysgroup
			);
			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.firstCall.args[0]).to.equal(
				sender.address
			);
			expect(instance.scope.account.merge.firstCall.args[1]).to.be.function;
			expect(rounds.calc.calledOnce).to.be.true;
			expect(rounds.calc.firstCall.args.length).to.be.equal(1);
			expect(rounds.calc.firstCall.args[0]).to.be.equal(block.height);
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.be.equal(1);
			expect(callback.firstCall.args[0]).to.be.equal("carbonara is the new foo");

			reverse.restore();
		});
	});

	describe("applyUnconfirmed", function() {
		var modules, expectedMerge;

		beforeEach(function() {
			instance.bind(rounds, accounts, system);
			modules = Multisignature.__get__("modules");

			expectedMerge = {
				u_multisignatures: trs.asset.multisignature.keysgroup,
				u_multimin: trs.asset.multisignature.min,
				u_multilifetime: trs.asset.multisignature.lifetime
			};
			instance.scope = {
				account: {
					merge: sinon.stub().callsFake(function(address, obj, cb) {
						return cb("carbonara is the new foo");
					})
				}
			};
		});

		it("returns error string", function() {
			instance.applyUnconfirmed(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.be.equal(1);
			expect(callback.firstCall.args[0]).to.be.equal(
				"Signature on this account is pending confirmation"
			);
			expect(instance.scope.account.merge.notCalled).to.be.true;
		});

		it("calls diff.reverse and account.merge", function() {
			var __private = Multisignature.__get__("__private");
			Multisignature.__set__("__private.unconfirmedSignatures", {});

			instance.applyUnconfirmed(trs, sender, callback);
			clock.tick();

			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.firstCall.args[0]).to.equal(
				sender.address
			);
			expect(instance.scope.account.merge.firstCall.args[1]).to.deep.equal(
				expectedMerge
			);
			expect(instance.scope.account.merge.firstCall.args[2]).to.be.function;
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.be.equal(0);

			Multisignature.__set__("__private", __private);
		});
	});

	describe("undoUnconfirmed", function() {
		var modules, expectedMerge;

		beforeEach(function() {
			instance.bind(rounds, accounts, system);
			modules = Multisignature.__get__("modules");

			expectedMerge = {
				u_multilifetime: -2,
				u_multimin: -1,
				u_multisignatures: "carbonara rocks"
			};
			instance.scope = {
				account: {
					merge: sinon.stub().callsFake(function(address, obj, cb) {
						return cb("carbonara is the new foo");
					})
				}
			};
		});

		it("calls diff.reverse and account.merge", function() {
			var Diff = Multisignature.__get__("Diff");
			var reverse = sinon.stub(Diff, "reverse").returns("carbonara rocks");

			var __private = Multisignature.__get__("__private");
			Multisignature.__set__("__private.unconfirmedSignatures", {});

			instance.undoUnconfirmed(trs, sender, callback);
			clock.tick();

			expect(reverse.calledOnce).to.be.true;
			expect(reverse.firstCall.args.length).to.be.equal(1);
			expect(reverse.firstCall.args[0]).to.be.equal(
				trs.asset.multisignature.keysgroup
			);
			expect(instance.scope.account.merge.calledOnce).to.be.true;
			expect(instance.scope.account.merge.firstCall.args[0]).to.equal(
				sender.address
			);
			expect(instance.scope.account.merge.firstCall.args[1]).to.deep.equal(
				expectedMerge
			);
			expect(instance.scope.account.merge.firstCall.args[2]).to.be.function;
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.be.equal(1);

			Multisignature.__set__("__private", __private);
			reverse.restore();
		});
	});

	describe("schema", function() {
		it("it's correct", function() {
			expect(instance.schema).to.deep.equal({
				id: "Multisignature",
				type: "object",
				properties: {
					min: {
						type: "integer",
						minimum: constants.multisigConstraints.min.minimum,
						maximum: constants.multisigConstraints.min.maximum
					},
					keysgroup: {
						type: "array",
						minItems: constants.multisigConstraints.keysgroup.minItems,
						maxItems: constants.multisigConstraints.keysgroup.maxItems
					},
					lifetime: {
						type: "integer",
						minimum: constants.multisigConstraints.lifetime.minimum,
						maximum: constants.multisigConstraints.lifetime.maximum
					}
				},
				required: ["min", "keysgroup", "lifetime"]
			});
		});
	});

	describe("objectNormalize", function() {
		var library, validate;
		beforeEach(function() {
			library = Multisignature.__get__("library");
			library.schema = { validate: function() {} };
		});
		afterEach(function() {
			if (validate && validate.restore()) validate.restore();
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
			expect(library.schema.validate.calledOnce).to.be.true;
			expect(library.schema.validate.getCall(0).args.length).to.equal(2);
			expect(library.schema.validate.getCall(0).args[0]).to.deep.equal({
				keysgroup: ["+929292929"],
				lifetime: 2,
				min: 1
			});
			expect(library.schema.validate.getCall(0).args[1]).to.equal(instance.schema);

			done();
		});
	});

	describe("dbRead", function() {
		it("returns null when no keysgroup", function(done) {
			var raw = {};

			var retVal = instance.dbRead(raw);

			expect(retVal).to.equal(null);

			done();
		});

		it("success keysgroup array split", function(done) {
			var raw = {
				m_keysgroup: "carbonara",
				m_min: 10,
				m_lifetime: 10
			};
			var expectedResult = {
				multisignature: {
					keysgroup: ["carbonara"],
					min: raw.m_min,
					lifetime: raw.m_lifetime
				}
			};

			var retVal = instance.dbRead(raw);

			expect(retVal).to.deep.equal(expectedResult);

			done();
		});

		it("success keysgroup array empty", function(done) {
			var raw = {
				m_keysgroup: 123,
				m_min: 10,
				m_lifetime: 10
			};
			var expectedResult = {
				multisignature: {
					keysgroup: [],
					min: raw.m_min,
					lifetime: raw.m_lifetime
				}
			};

			var retVal = instance.dbRead(raw);

			expect(retVal).to.deep.equal(expectedResult);

			done();
		});
	});

	describe("dbTable", function() {
		it("it's correct", function() {
			expect(instance.dbTable).to.deep.equal("multisignatures");
		});
	});

	describe("dbFields", function() {
		it("it's correct", function() {
			expect(instance.dbFields).to.deep.equal([
				"min",
				"lifetime",
				"keysgroup",
				"transactionId"
			]);
		});
	});

	describe("dbSave", function() {
		it("returns correct query", function() {
			expect(instance.dbSave(trs)).to.deep.equal({
				table: "multisignatures",
				fields: ["min", "lifetime", "keysgroup", "transactionId"],
				values: {
					min: trs.asset.multisignature.min,
					lifetime: trs.asset.multisignature.lifetime,
					keysgroup: trs.asset.multisignature.keysgroup.join(","),
					transactionId: trs.id
				}
			});
		});
	});

	describe("afterSave", function() {
		it("sockets.emit called and called cb", function() {
			instance.afterSave(trs, callback);
			clock.tick();

			expect(network.io.sockets.emit.calledOnce).to.be.true;
			expect(network.io.sockets.emit.firstCall.args.length).to.equal(2);
			expect(network.io.sockets.emit.firstCall.args[0]).to.equal(
				"multisignatures/change"
			);
			expect(network.io.sockets.emit.firstCall.args[1]).to.deep.equal(trs);
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(0);
		});
	});

	describe("ready", function() {
		it("returns false with no signatures", function() {
			trs.signatures = "not an array";
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(false);
		});

		it("returns false sender.multisignature not valid array", function() {
			var sender = {
				multisignatures: 123
			};
			trs.signatures = [1, 2, 3];
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(false);
		});

		it("returns true sender.multisignature not valid array", function() {
			var sender = {
				multisignatures: []
			};
			trs.signatures = [];
			trs.asset.multisignature.keysgroup = [];
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(true);
		});

		it("returns false when signatures >= multimin", function() {
			var sender = {
				multisignatures: [1],
				multimin: 10
			};
			trs.signatures = [1, 2, 3];
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(false);
		});

		it("returns true when signatures >= multimin", function() {
			var sender = {
				multisignatures: [1],
				multimin: 1
			};
			trs.signatures = [1, 2, 3];
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(true);
		});
	});
});
