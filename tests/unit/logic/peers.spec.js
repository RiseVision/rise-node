var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var Peers = rewire(path.join(rootDir, "logic/peers"));
var Peer = require("../../../logic/peer");

describe("logic/peers", function() {
	var instance, callback, clock, schema, logger, peer;

	beforeEach(function() {
		schema = {};
		logger = {
			warn: sinon.stub(),
			debug: sinon.stub(),
			trace: sinon.stub(),
			info: sinon.stub()
		};
		callback = sinon.stub();
		clock = sinon.useFakeTimers("setImmediate");
		Peers.__set__("setImmediate", setImmediate);
		instance = new Peers(logger, callback);
		peer = new Peer();
	});
	afterEach(function() {
		clock.reset();
		logger.warn.reset();
	});

	describe("constructor", function() {
		it("should be a function", function(done) {
			expect(Peers).to.be.a("function");

			done();
		});
		it("calls cb and sets", function(done) {
			var library = Peers.__get__("library");
			var self = Peers.__get__("self");
			var __private = Peers.__get__("__private");
			var innerSelf = Object.assign({}, self);

			clock.tick();

			expect(library).to.be.deep.equal({
				logger: logger
			});
			expect(innerSelf).to.be.deep.equal({});
			expect(__private).to.be.deep.equal({
				peers: {}
			});
			expect(callback.calledOnce).to.be.true;
			expect(callback.firstCall.args.length).to.equal(2);
			expect(callback.firstCall.args[0]).to.equal(null);
			expect(callback.firstCall.args[1]).to.deep.equal(self);

			done();
		});
	});

	describe("create", function() {
		var create = Peers.__get__("Peers.prototype.create");

		it("returns a new Peer", function(done) {
			var retVal = create({});

			expect(retVal).to.be.an.instanceOf(Peer);

			done();
		});
		it("returns the peer", function(done) {
			var retVal = create();

			expect(retVal).to.deep.equal(peer);

			done();
		});
	});

	describe("exists", function() {
		var __private;
		var exists = Peers.__get__("Peers.prototype.exists");

		beforeEach(function() {
			__private = Peers.__get__("__private");
		});
		afterEach(function() {
			Peers.__set__("__private", __private);
		});

		it("returns true", function(done) {
			var mockedPrivate = {
				peers: {
					test: true
				}
			};
			Peers.__set__("__private", mockedPrivate);

			peer.string = "test";
			var retVal = exists(peer);

			expect(retVal).to.equal(true);

			done();
		});
		it("returns false", function(done) {
			var retVal = exists(peer);

			expect(retVal).to.equal(false);

			done();
		});
	});

	describe("get", function() {
		var __private;
		var get = Peers.__get__("Peers.prototype.get");

		beforeEach(function() {
			__private = Peers.__get__("__private");
		});
		afterEach(function() {
			Peers.__set__("__private", __private);
		});

		it("returns peer", function(done) {
			var mockedPrivate = {
				peers: {
					test: {}
				}
			};
			Peers.__set__("__private", mockedPrivate);
			var retVal = get("test");

			expect(retVal).to.deep.equal({});

			done();
		});
		it("returns false", function(done) {
			var self = Peers.__get__("self");
			var create = sinon.stub(self, "create").callsFake(function() {
				var mockedPrivate = {
					peers: {
						test: {}
					}
				};
				Peers.__set__("__private", mockedPrivate);
				return {
					string: "test"
				};
			});

			var retVal = get(peer);
			expect(create.calledOnce).to.be.true;
			expect(create.firstCall.args.length).to.equal(1);
			expect(create.firstCall.args[0]).to.deep.equal(peer);
			expect(retVal).to.deep.equal({});

			done();
		});
	});

	describe("upsert", function() {
		var selfInstance, create, modules, __private;
		var upsert = Peers.__get__("Peers.prototype.upsert");

		beforeEach(function() {
			selfInstance = Peers.__get__("self");
			__private = Peers.__get__("__private");
			modules = Peers.__get__("modules");

			create = sinon.stub(selfInstance, "create");
		});
		afterEach(function() {
			create.restore();
			Peers.__set__("__private", __private);
			Peers.__set__("modules", modules);
		});

		it("upsert rejected", function(done) {
			create.returns({});

			var retVal = upsert({}, false);

			expect(create.calledOnce).to.equal(true);
			expect(create.firstCall.args.length).to.equal(1);
			expect(create.firstCall.args[0]).to.deep.equal({});
			expect(logger.warn.calledOnce).to.equal(true);
			expect(retVal).to.equal(false);

			done();
		});

		it("peer exists, forced update", function(done) {
			var exists = sinon.stub(selfInstance, "exists").returns(true);
			create.callsFake(function() {
				return { string: "1" };
			});
			var retVal = upsert({}, true);

			expect(create.calledOnce).to.equal(true);
			expect(create.firstCall.args.length).to.equal(1);
			expect(create.firstCall.args[0]).to.deep.equal({});
			expect(retVal).to.equal(false);

			exists.restore();
			done();
		});

		it("peer exists, updates", function(done) {
			var exists = sinon.stub(selfInstance, "exists").returns(true);
			var mockedPrivate = {
				peers: {
					test: {
						update: sinon.stub()
					}
				}
			};
			var __private = Peers.__get__("__private");

			Peers.__set__("__private", mockedPrivate);

			create.callsFake(function() {
				return { string: "test" };
			});
			var retVal = upsert({});

			expect(create.calledOnce).to.equal(true);
			expect(create.firstCall.args.length).to.equal(1);
			expect(create.firstCall.args[0]).to.deep.equal({});
			expect(logger.debug.calledOnce).to.equal(true);
			expect(logger.debug.firstCall.args.length).to.equal(2);
			expect(logger.debug.firstCall.args[0]).to.equal("Updated peer test");
			expect(retVal).to.equal(true);

			exists.restore();
			done();
		});

		it("peer doesn't exists, rejects peer on insert", function(done) {
			var exists = sinon.stub(selfInstance, "exists").returns(false);
			var mockedPrivate = {
				peers: {
					test: {
						update: sinon.stub()
					}
				}
			};
			var peersMocked = {
				peers: {
					acceptable: sinon.stub()
				}
			};

			Peers.__set__("__private", mockedPrivate);
			Peers.__set__("modules", peersMocked);

			create.callsFake(function() {
				return { string: "test" };
			});
			var retVal = upsert({});

			expect(create.calledOnce).to.equal(true);
			expect(create.firstCall.args.length).to.equal(1);
			expect(create.firstCall.args[0]).to.deep.equal({});
			expect(logger.debug.calledOnce).to.equal(true);
			expect(logger.debug.firstCall.args.length).to.equal(2);
			expect(logger.debug.firstCall.args[0]).to.equal(
				"Rejecting unacceptable peer"
			);
			expect(retVal).to.equal(true);

			exists.restore();
			done();
		});

		it("peer doesn't exists, inserts user", function(done) {
			var exists = sinon.stub(selfInstance, "exists").returns(false);
			var __private = Peers.__get__("__private");
			var modules = Peers.__get__("modules");
			var mockedPrivate = {
				peers: {
					test: {
						update: sinon.stub()
					}
				}
			};
			var peersMocked = {
				peers: {
					acceptable: sinon.stub().returns([1, 2, 3])
				}
			};

			Peers.__set__("__private", mockedPrivate);
			Peers.__set__("modules", peersMocked);

			create.callsFake(function() {
				return { string: "test" };
			});
			var retVal = upsert({});

			expect(create.calledOnce).to.equal(true);
			expect(create.firstCall.args.length).to.equal(1);
			expect(create.firstCall.args[0]).to.deep.equal({});
			expect(logger.debug.calledOnce).to.equal(true);
			expect(logger.debug.firstCall.args.length).to.equal(2);
			expect(logger.debug.firstCall.args[0]).to.equal("Inserted new peer");
			expect(retVal).to.equal(true);

			exists.restore();
			done();
		});
	});

	describe("remove", function() {
		var __private, create, selfInstance, exists;
		var remove = Peers.__get__("Peers.prototype.remove");

		beforeEach(function() {
			__private = Peers.__get__("__private");
			selfInstance = Peers.__get__("self");
			create = sinon.stub(selfInstance, "create");
			exists = sinon.stub(selfInstance, "exists");
		});
		afterEach(function() {
			Peers.__set__("__private", __private);
			create.restore();
			exists.restore();
		});

		it("peer not found", function(done) {
			var mockedPrivate = {
				peers: {
					test: {}
				}
			};
			Peers.__set__("__private", mockedPrivate);
			create.callsFake(function() {
				return { string: "1" };
			});
			exists.returns(false);
			var retVal = remove({});

			expect(create.calledOnce).to.equal(true);
			expect(create.firstCall.args.length).to.equal(1);
			expect(create.firstCall.args[0]).to.deep.equal({});
			expect(exists.calledOnce).to.equal(true);
			expect(exists.firstCall.args.length).to.equal(1);
			expect(exists.firstCall.args[0]).to.deep.equal({ string: "1" });
			expect(retVal).to.equal(false);

			done();
		});
		it("peer found", function(done) {
			var mockedPrivate = {
				peers: {
					test: {}
				}
			};
			Peers.__set__("__private", mockedPrivate);
			create.callsFake(function() {
				return { string: "1" };
			});
			exists.returns(true);
			var retVal = remove({});

			expect(create.calledOnce).to.equal(true);
			expect(create.firstCall.args.length).to.equal(1);
			expect(create.firstCall.args[0]).to.deep.equal({});
			expect(exists.calledOnce).to.equal(true);
			expect(exists.firstCall.args.length).to.equal(1);
			expect(exists.firstCall.args[0]).to.deep.equal({ string: "1" });
			expect(retVal).to.equal(true);

			done();
		});
	});

	describe("list", function() {
		var __private;
		var list = Peers.__get__("Peers.prototype.list");

		beforeEach(function() {
			__private = Peers.__get__("__private");
		});
		afterEach(function() {
			Peers.__set__("__private", __private);
		});

		it("normalize false", function(done) {
			var mockedPrivate = {
				peers: {
					test: {
						object: function() {
							return true;
						}
					}
				}
			};
			Peers.__set__("__private", mockedPrivate);

			var retVal = list(true);

			expect(retVal).to.deep.equal([true]);

			done();
		});
		it("normalize true", function(done) {
			var mockedPrivate = {
				peers: {
					test: {
						something: true,
						awesome: true
					}
				}
			};
			Peers.__set__("__private", mockedPrivate);

			var retVal = list(false);

			expect(retVal).to.deep.equal([
				{
					something: true,
					awesome: true
				}
			]);

			done();
		});
	});

	describe("bindModules", function() {
		var bindModules = Peers.__get__("Peers.prototype.bindModules");

		it("binds modules", function(done) {
			var modules;
			var modulesToBind = {
				peers: [1, 2]
			};
			var expectedModules = {
				peers: modulesToBind.peers
			};

			bindModules(modulesToBind);
			modules = Peers.__get__("modules");

			expect(modules).to.deep.equal(expectedModules);

			done();
		});
	});
});
