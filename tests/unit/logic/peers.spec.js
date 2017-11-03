var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var Peers = require('../../../logic/peers').Peers;
var Peer = require("../../../logic/peer.ts").Peer;

describe("logic/peers", function() {
	var instance, schema, logger, peer;
	var modulesPeers;

	beforeEach(function() {
		schema = {};
		logger = {
			warn: sinon.stub(),
			debug: sinon.stub(),
			trace: sinon.stub(),
			info: sinon.stub()
		};

		instance = new Peers(logger);
		peer = new Peer({});
    modulesPeers = {
      acceptable: sinon.stub().returns(true),
  	};
		instance.bindModules({peers:modulesPeers});

	});
	afterEach(function() {
		logger.warn.reset();
	});

	describe("constructor", function() {
		it("should be a function", function() {
			expect(Peers).to.be.a("function");
		});
	});

	describe("create", function() {
		it("returns a new Peer", function() {
			var retVal = instance.create({});

			expect(retVal).to.be.an.instanceOf(Peer);

		});
		it("returns the peer", function() {
			var retVal = instance.create();
			expect(retVal).to.deep.equal(peer);
		});
	});

	describe("exists", function() {

		it("returns true", function() {
			peer.string = 'test';
			instance['peers']['test'] = 'true';
			var retVal = instance.exists(peer);

			expect(retVal).to.equal(true);

		});
		it("returns false", function() {
			var retVal = instance.exists(peer);

			expect(retVal).to.equal(false);
		});
	});

	describe("get", function() {
		it("returns peer", function() {
			instance.peers = {
        test: {}
      };
			var retVal = instance.get("test");

			expect(retVal).to.deep.equal({});
		});
		it("returns false", function() {
			expect(instance.get('test')).to.be.undefined;
		});
	});

	describe("upsert", function() {
		var create;

		beforeEach(function() {
			create = sinon.spy(instance, "create");

		});
		it('upsert should call create to normalize peer', () => {
      var retVal = instance.upsert({}, true);
      expect(create.called).is.true;
		});
		it("peer exists, insertOnly=true", function() {
			sinon.stub(instance, "exists").returns(true);
			var retVal = instance.upsert({}, true);

			expect(create.calledOnce).to.equal(true);
			expect(create.firstCall.args[0]).to.deep.equal({});
			expect(retVal).to.equal(false);
		});

		it("peer exists, insertOnly=false calls update on peer and returns false", function() {
      sinon.stub(instance, "exists").returns(true);
      create.restore();
      sinon.stub(instance, 'create').returns({string: 'coiao'});

      instance.peers['coiao'] = new Peer({});
      sinon.spy(instance.peers['coiao'], 'update');
      var retVal = instance.upsert({string: 'coiao'}, false);

      expect(instance.peers['coiao'].update.calledOnce).is.true;
      expect(retVal).to.equal(true);
		});

		it("peer doesn't exists, rejects peer on insert", function(done) {
			var exists = sinon.stub(instance, "exists").returns(false);
      modulesPeers.acceptable = sinon.stub();
			var retVal = instance.upsert({});

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

		it("peer doesn't exists, inserts it if peers acceptable", function() {
			sinon.stub(instance, "exists").returns(false);
      modulesPeers.acceptable = sinon.stub().returns([{}]);
      var retVal = instance.upsert({});

			expect(create.calledOnce).to.equal(true);
			expect(create.firstCall.args.length).to.equal(1);
			expect(create.firstCall.args[0]).to.deep.equal({});
			expect(logger.debug.calledOnce).to.equal(true);
			expect(logger.debug.firstCall.args.length).to.equal(2);
			expect(logger.debug.firstCall.args[0]).to.equal("Inserted new peer");
			expect(retVal).to.equal(true);

		});
	});

	describe("remove", function() {

		it('does nothing and return false if not exists', () => {
			sinon.stub(instance, 'exists').returns(false);
			instance.remove({});

			expect(logger.debug.calledOnce).is.true;
			expect(logger.debug.firstCall.args[0]).to.be.eq('Failed to remove peer');
			expect(instance.remove({})).to.be.eq(false);
		});

		it('removes it from the peers list if exists', () => {
			sinon.stub(instance, 'exists').returns(true);
			instance.peers['ciao'] = 'hey';
			sinon.stub(instance, 'create').returns({string: 'ciao'});
      var toRet = instance.remove({string: 'ciao'});

      expect(instance.peers['ciao']).to.be.undefined;
      expect(toRet).to.be.eq(true);
		});

	});
  //
	describe("list", function() {

		it("normalize=false shold return objects intacts", function() {
			instance.peers['a'] = 'b';
			instance.peers['b'] = 'c';

			// no transformations!
			expect(instance.list(false)).to.be.deep.eq(['b','c']);
		});
		it("normalize true should call object on each peer", function() {
      instance.peers['a'] = {object: sinon.stub().returns('b')};
      instance.peers['b'] = {object: sinon.stub().returns('c')};

      // no transformations!
      expect(instance.list(true)).to.be.deep.eq(['b','c']);
			expect(instance.peers['a'].object.calledOnce).is.true;
			expect(instance.peers['b'].object.calledOnce).is.true;

		});
	});

	describe('bindModules', () => {
		it ('should override private modules and assign peers value', () => {
			instance.bindModules({peers: 'ciao'});
			expect(instance.modules.peers).to.be.eq('ciao');
		})
	});
});
