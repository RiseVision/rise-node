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
var Dapp = rewire(path.join(rootDir, "logic/dapp"));

describe("modules/dapp", function() {
	var instance,
		callback,
		schema,
		network,
		logger,
		db,
		clock,
		trs,
		sender,
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
		logger = {
			error: sinon.stub()
		};
		db = {
			query: sinon.stub().resolves(true)
		};
		trs = {
			amount: 0,
			asset: {
				dapp: {
					name: "CarbonaraDapp",
					description: "Carbonara",
					category: 4,
					tags: "cool, dapp",
					link: "https://alessio.rocks/app.zip",
					icon: "https://alessio.rocks/img/carbonara_bro.jpeg",
					type: 0
				}
			}
		};

		sender = {
			multisignatures: ["1", "2"]
		};
		system = {};
		clock = sinon.useFakeTimers("setImmediate");
		Dapp.__set__("setImmediate", setImmediate);
		callback = sinon.stub();
		instance = new Dapp(db, logger, schema, network);
	});
	afterEach(function() {
		clock.restore();
	});

	describe("constructor", function() {
		it("should be a function", function() {
			expect(Dapp).to.be.a("function");
		});

		it("success", function() {
			var expectedLibrary = {
				db: db,
				logger: logger,
				schema: schema,
				network: network
			};
			var library = Dapp.__get__("library");

			expect(library).to.deep.equal(expectedLibrary);
		});
	});

	describe("bind", function() {
		it("binds modules", function() {
			var expectedModules;
			expectedModules = {
				system: system
			};

			instance.bind(system);
			var modules = Dapp.__get__("modules");

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
				category: 0,
				name: 100,
				description: 1000,
				tags: 1000,
				dapp_type: 0,
				link: "https://alessio.rocks/",
				icon: "https://alessio.rocks/img/carbonara_bro.jpeg"
			};
			expectedTrs = {
				recipientId: null,
				amount: 0,
				asset: {
					dapp: {
						category: data.category,
						name: data.name,
						description: data.description,
						tags: data.tags,
						type: data.dapp_type,
						link: data.link,
						icon: data.icon
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
			modules = Dapp.__get__("modules");
			modules.system = { getFees: function() {} };
			getFees = sinon.stub(modules.system, "getFees").returns({
				fees: {
					dapp: 1
				}
			});

			var retVal = instance.calculateFee(trs, null, height);

			expect(retVal).to.deep.equal(1);
			expect(getFees.calledOnce).to.be.true;
			expect(getFees.firstCall.args.length).to.equal(1);
			expect(getFees.firstCall.args[0]).to.equal(height);

			getFees.restore();
		});
	});

	describe("verify", function() {
		var ready, library, Buffer, from, isUri;

		beforeEach(function() {
			var fullArray = [
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8,
				9,
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8,
				9,
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8,
				9,
				1,
				2,
				3,
				4,
				5
			]; // length 32
			sender = {
				multisignatures: false
			};
			ready = sinon.stub(instance, "ready").returns(true);
			Buffer = Dapp.__get__("Buffer");
			from = sinon.stub(Buffer, "from").returns(fullArray);
			Dapp.__set__("Buffer", Buffer);
			isUri = sinon.spy(valid_url, "isUri");
		});
		afterEach(function() {
			ready.restore();
			clock.restore();
			from.restore();
			isUri.restore();
		});

		it("returns 'Invalid recipient'", function() {
			var tempTrs = {};
			Object.assign(tempTrs, trs);
			tempTrs.recipientId = "carbonara";
			instance.verify(tempTrs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid recipient");
		});

		it("returns 'Invalid transaction amount'", function() {
			var tempTrs = {};
			Object.assign(tempTrs, trs);
			tempTrs.amount = 1;
			instance.verify(tempTrs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid transaction amount");
		});

		it("returns 'Invalid transaction asset'", function() {
			var tempTrs = {};
			Object.assign(tempTrs, trs);

			delete tempTrs.asset.dapp;
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

		it("returns 'Invalid application category'", function() {
			var tempTrs = {};
			Object.assign(tempTrs, trs);

			tempTrs.asset.dapp.category = null;
			instance.verify(tempTrs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid application category");
		});

		it("returns 'Application category not found'", function() {
			trs.asset.dapp.category = 99;
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(
				"Application category not found"
			);
		});

		it("returns 'Invalid application icon link'", function() {
			trs.asset.dapp.icon = "alessio.rocks";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid application icon link");
			expect(isUri.calledOnce).to.be.true;
			expect(isUri.firstCall.args.length).to.equal(1);
			expect(isUri.firstCall.args[0]).to.equal(trs.asset.dapp.icon);
		});

		it("returns 'Invalid application icon file type'", function() {
			trs.asset.dapp.icon = "https://alessio.rocks/img";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(
				"Invalid application icon file type"
			);
			expect(isUri.calledOnce).to.be.true;
			expect(isUri.firstCall.args.length).to.equal(1);
			expect(isUri.firstCall.args[0]).to.equal(trs.asset.dapp.icon);
		});

		it("returns 'Invalid application type'", function() {
			trs.asset.dapp.type = 10;
			instance.verify(trs, sender, callback);
			clock.tick();

			trs.asset.dapp.type = -1;
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledTwice).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid application type");
			expect(callback.secondCall.args.length).to.equal(1);
			expect(callback.secondCall.args[0]).to.equal("Invalid application type");
		});

		it("returns 'Invalid application link'", function() {
			trs.asset.dapp.link = "carbonara";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid application link");
			expect(isUri.calledTwice).to.be.true;
			expect(isUri.secondCall.args.length).to.equal(1);
			expect(isUri.secondCall.args[0]).to.equal(trs.asset.dapp.link);
		});

		it("returns 'Invalid application file type'", function() {
			trs.asset.dapp.link = "https://alessio.rocks/img/carbonara_bro.jpeg";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal("Invalid application file type");
		});

		it("returns 'Application name must not be blank'", function() {
			trs.asset.dapp.name = undefined;
			instance.verify(trs, sender, callback);
			clock.tick();
			trs.asset.dapp.name = "";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledTwice).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(
				"Application name must not be blank"
			);
			expect(callback.secondCall.args.length).to.equal(1);
			expect(callback.secondCall.args[0]).to.equal(
				"Application name must not be blank"
			);
		});

		it("returns 'Application name is too long. Maximum is 32 characters'", function() {
			trs.asset.dapp.name =
				"CarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonara";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(
				"Application name is too long. Maximum is 32 characters"
			);
		});

		it("returns 'Application description is too long. Maximum is 160 characters'", function() {
			trs.asset.dapp.description =
				"CarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonara";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(
				"Application description is too long. Maximum is 160 characters"
			);
		});

		it("returns 'Application tags is too long. Maximum is 160 characters'", function() {
			trs.asset.dapp.tags =
				"CarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonaraCarbonara";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(
				"Application tags is too long. Maximum is 160 characters"
			);
		});

		it("returns 'Encountered duplicate tag: Carbonara in application'", function() {
			trs.asset.dapp.tags = "Carbonara, Carbonara";
			instance.verify(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(1);
			expect(callback.firstCall.args[0]).to.equal(
				"Encountered duplicate tag: Carbonara in application"
			);
		});

		it("catches the rejection from db.query", function(done) {
			db.query.rejects();
			instance.verify(trs, sender, callback);
			expect(db.query.calledOnce).to.be.true;
			expect(db.query.firstCall.args.length).to.equal(2);
			expect(db.query.firstCall.args[0]).to.equal(sql.getExisting);
			expect(db.query.firstCall.args[1]).to.deep.equal({
				name: trs.asset.dapp.name,
				link: trs.asset.dapp.link,
				transactionId: trs.id
			});

			setTimeout(function() {
				clock.tick();
				expect(logger.error.calledOnce).to.be.true;
				expect(callback.calledOnce).to.be.true;
				expect(callback.firstCall.args.length).to.equal(1);
				expect(callback.firstCall.args[0]).to.equal("DApp#verify error");
				done();
			}, 0);
		});

		it("Dapp exists with the same name", function(done) {
			db.query.resolves([
				{
					name: "CarbonaraDapp"
				}
			]);
			instance.verify(trs, sender, callback);

			setTimeout(function() {
				clock.tick();
				expect(callback.calledOnce).to.be.true;
				expect(callback.firstCall.args.length).to.equal(1);
				expect(callback.firstCall.args[0]).to.equal(
					"Application name already exists: CarbonaraDapp"
				);
				done();
			}, 0);
		});

		it("Dapp exists with the same link", function(done) {
			db.query.resolves([
				{
					link: "https://alessio.rocks/app.zip"
				}
			]);
			instance.verify(trs, sender, callback);

			setTimeout(function() {
				clock.tick();
				expect(callback.calledOnce).to.be.true;
				expect(callback.firstCall.args.length).to.equal(1);
				expect(callback.firstCall.args[0]).to.equal(
					"Application link already exists: https://alessio.rocks/app.zip"
				);
				done();
			}, 0);
		});

		it("Dapp exists", function(done) {
			db.query.resolves([
				{
					itExists: true
				}
			]);
			instance.verify(trs, sender, callback);

			setTimeout(function() {
				clock.tick();
				expect(callback.calledOnce).to.be.true;
				expect(callback.firstCall.args.length).to.equal(1);
				expect(callback.firstCall.args[0]).to.equal("Application already exists");
				done();
			}, 0);
		});

		it("Success no dapp, db.query resolved, call cb", function(done) {
			db.query.resolves([]);
			instance.verify(trs, sender, callback);

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

	describe("process", function() {
		it("calls cb", function() {
			instance.process(trs, {}, callback);
			clock.tick();

			expect(callback.calledOnce).to.equal(true);
			expect(callback.firstCall.args.length).to.equal(2);
			expect(callback.firstCall.args[0]).to.equal(null);
			expect(callback.firstCall.args[1]).to.deep.equal(trs);
		});
	});

	describe("getBytes", function() {
		var from;
		// var outputBuffer = Buffer.from([]);

		beforeEach(function() {
			BufferModule = Dapp.__get__("Buffer");
			from = sinon.spy(BufferModule, "from");
		});
		afterEach(function() {
			Dapp.__get__("Buffer").from.restore();
		});

		it("throws error", function() {
			from.restore();
			from = sinon.stub(BufferModule, "from");
			from.callsFake(function() {
				throw new Error();
			});

			var throwError = function() {
				instance.getBytes(trs);
			};

			expect(throwError).to.throw();
		});

		it("returns buffer", function() {
			var retVal = instance.getBytes(trs);
			expect(from.callCount).to.equal(6);
			expect(from.getCall(0).args.length).to.equal(1);
			expect(from.getCall(0).args[0]).to.deep.equal([]);
			expect(from.getCall(1).args.length).to.equal(2);
			expect(from.getCall(1).args[0]).to.equal(trs.asset.dapp.name);
			expect(from.getCall(1).args[1]).to.equal("utf8");
			expect(from.getCall(2).args.length).to.equal(2);
			expect(from.getCall(2).args[0]).to.equal(trs.asset.dapp.description);
			expect(from.getCall(2).args[1]).to.equal("utf8");
			expect(from.getCall(3).args.length).to.equal(2);
			expect(from.getCall(3).args[0]).to.equal(trs.asset.dapp.tags);
			expect(from.getCall(3).args[1]).to.equal("utf8");
			expect(from.getCall(4).args.length).to.equal(2);
			expect(from.getCall(4).args[0]).to.equal(trs.asset.dapp.link);
			expect(from.getCall(4).args[1]).to.equal("utf8");
			expect(from.getCall(5).args.length).to.equal(2);
			expect(from.getCall(5).args[0]).to.equal(trs.asset.dapp.icon);
			expect(from.getCall(5).args[1]).to.equal("utf8");
			expect(retVal).to.be.instanceOf(Buffer);
		});
	});

	describe("apply", function() {
		it("calls cb", function() {
			instance.apply(null, null, null, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(0);
		});
	});

	describe("undo", function() {
		it("calls cb", function() {
			instance.undo(null, null, null, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(0);
		});
	});

	describe("applyUnconfirmed", function() {
		var __private;

		beforeEach(function() {
			__private = Dapp.__get__("__private");
		});
		afterEach(function() {
			Dapp.__set__("__private", __private);
		});

		it("returns error Application name already exists", function() {
			var mockedPrivate = {
				unconfirmedNames: {
					CarbonaraDapp: true
				}
			};

			Dapp.__set__("__private", mockedPrivate);

			instance.applyUnconfirmed(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.be.equal(1);
			expect(callback.firstCall.args[0]).to.be.equal(
				"Application name already exists"
			);
		});

		it("Application link already exists", function() {
			var mockedPrivate = {
				unconfirmedNames: {},
				unconfirmedLinks: {
					"https://alessio.rocks/app.zip": true
				}
			};

			Dapp.__set__("__private", mockedPrivate);

			instance.applyUnconfirmed(trs, sender, callback);
			clock.tick();

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.be.equal(1);
			expect(callback.firstCall.args[0]).to.be.equal(
				"Application link already exists"
			);
		});

		it("success", function() {
			var mockedPrivate = {
				unconfirmedNames: {
					CarbonaraDapp: true
				},
				unconfirmedLinks: {
					"https://alessio.rocks/app.zip": true
				}
			};
			var expectedPrivate = {
				unconfirmedNames: {},
				unconfirmedLinks: {}
			};

			Dapp.__set__("__private", mockedPrivate);

			instance.undoUnconfirmed(trs, sender, callback);
			clock.tick();
			var innerPrivate = Dapp.__get__("__private");

			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.deep.equal(0);
			expect(innerPrivate).to.deep.equal(expectedPrivate);
		});
	});

	describe("undoUnconfirmed", function() {
		var modules, expectedMerge;

		it("calls diff.reverse and account.merge", function() {
			var private = Dapp.__get__("__private");
			var mockedPrivate = {
				unconfirmedNames: {},
				unconfirmedLinks: {}
			};
		});
	});

	describe("schema", function() {
		it("it's correct", function() {
			expect(instance.schema).to.deep.equal({
				id: "DApp",
				type: "object",
				properties: {
					category: {
						type: "integer",
						minimum: 0,
						maximum: 8
					},
					name: {
						type: "string",
						minLength: 1,
						maxLength: 32
					},
					description: {
						type: "string",
						minLength: 0,
						maxLength: 160
					},
					tags: {
						type: "string",
						minLength: 0,
						maxLength: 160
					},
					type: {
						type: "integer",
						minimum: 0
					},
					link: {
						type: "string",
						minLength: 0,
						maxLength: 2000
					},
					icon: {
						type: "string",
						minLength: 0,
						maxLength: 2000
					}
				},
				required: ["type", "name", "category"]
			});
		});
	});

	describe("objectNormalize", function() {
		var library, validate;
		beforeEach(function() {
			library = Dapp.__get__("library");
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
			expect(library.schema.validate.getCall(0).args[0]).to.deep.equal(
				trs.asset.dapp
			);
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
				dapp_name: "carbonara",
				dapp_description: 10,
				dapp_tags: 10,
				dapp_type: 10,
				dapp_link: 10,
				dapp_category: 10,
				dapp_icon: 10
			};
			var expectedResult = {
				dapp: {
					name: raw.dapp_name,
					description: raw.dapp_description,
					tags: raw.dapp_tags,
					type: raw.dapp_type,
					link: raw.dapp_link,
					category: raw.dapp_category,
					icon: raw.dapp_icon
				}
			};

			var retVal = instance.dbRead(raw);

			expect(retVal).to.deep.equal(expectedResult);

			done();
		});
	});

	describe("dbTable", function() {
		it("it's correct", function() {
			expect(instance.dbTable).to.deep.equal("dapps");
		});
	});

	describe("dbFields", function() {
		it("it's correct", function() {
			expect(instance.dbFields).to.deep.equal([
				"type",
				"name",
				"description",
				"tags",
				"link",
				"category",
				"icon",
				"transactionId"
			]);
		});
	});

	describe("dbSave", function() {
		it("returns correct query", function() {
			expect(instance.dbSave(trs)).to.deep.equal({
				table: instance.dbTable,
				fields: instance.dbFields,
				values: {
					type: trs.asset.dapp.type,
					name: trs.asset.dapp.name,
					description: trs.asset.dapp.description || null,
					tags: trs.asset.dapp.tags || null,
					link: trs.asset.dapp.link || null,
					icon: trs.asset.dapp.icon || null,
					category: trs.asset.dapp.category,
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
			expect(network.io.sockets.emit.firstCall.args[0]).to.equal("dapps/change");
			expect(network.io.sockets.emit.firstCall.args[1]).to.deep.equal({});
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
				multisignatures: [1, 2, 3]
			};
			trs.signatures = [1, 2, 3];
			var retVal = instance.ready(trs, sender);

			expect(retVal).to.equal(false);
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
