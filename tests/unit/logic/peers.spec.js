var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var Peers = rewire(path.join(rootDir, "logic/peers"));
var Peer = require('../../../logic/peer');

// foo = new Peers({}, function(){});
// foo.create();

describe("logic/peers", function() {
  var instance, callback, clock, schema, logger, peer;

  beforeEach(function() {
    schema = {};
    logger = {
      warn: sinon.stub()
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
      expect(callback.getCall(0).args.length).to.equal(2);
      expect(callback.getCall(0).args[0]).to.equal(null);
      expect(callback.getCall(0).args[1]).to.deep.equal(self);

      done();
    });
  });

  describe("create", function() {

    var create = Peers.__get__("Peers.prototype.create"); // todo: prototypes are not accesible?

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
    var exists = Peers.__get__("Peers.prototype.exists"); // todo: prototypes are not accesible?

    beforeEach(function(){
      __private = Peers.__get__("__private");
    });
    afterEach(function(){
      Peers.__set__("__private", __private); //reset
    });

    it("returns true", function(done) {

      var mockedPrivate = {
        peers: {
          test: true
        }
      };
      Peers.__set__("__private", mockedPrivate);

      peer.string = 'test';
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
    var get = Peers.__get__("Peers.prototype.get"); // todo: prototypes are not accesible?

    beforeEach(function(){
      __private = Peers.__get__("__private");
    });
    afterEach(function(){
      Peers.__set__("__private", __private); //reset
    });

    it("returns peer", function(done) {

      var mockedPrivate = {
        peers: {
          test: {}
        }
      };
      Peers.__set__("__private", mockedPrivate);
      var retVal = get('test');

      expect(retVal).to.deep.equal({});

      done();
    });
    it("returns false", function(done) {

      var self = Peers.__get__("self");
      var create = sinon.stub(self, "create").callsFake(function(){
        var mockedPrivate = {
          peers: {
            test: {}
          }
        };
        Peers.__set__("__private", mockedPrivate);
        return {
          string: 'test'
        };
      });

      var retVal = get(peer);
      expect(create.calledOnce).to.be.true;
      expect(create.getCall(0).args.length).to.equal(1);
      expect(create.getCall(0).args[0]).to.deep.equal(peer);
      expect(retVal).to.deep.equal({});

      done();
    });

  });

  describe("upsert", function() {

    var selfInstance, create;
    var upsert = Peers.__get__("Peers.prototype.upsert"); // todo: prototypes are not accesible?

    beforeEach(function(){
      selfInstance = Peers.__get__("self");
      create = sinon.stub(selfInstance, "create");
    });
    afterEach(function(){
      create.restore();
    });

    it("upsert rejected", function(done) {

      create.returns({});

      var retVal = upsert({}, false);

      expect(create.calledOnce).to.equal(true);
      expect(create.getCall(0).args.length).to.equal(1);
      expect(create.getCall(0).args[0]).to.deep.equal({});
      expect(logger.warn.calledOnce).to.equal(true);
      expect(retVal).to.equal(false);

      done();
    });

    it("peer exists, forced update", function(done) {

      var exists = sinon.stub(selfInstance, "exists").returns(true);
      create.callsFake(function(){
        return {string: '1'}
      });
      var retVal = upsert({}, true);

      expect(create.calledOnce).to.equal(true);
      expect(create.getCall(0).args.length).to.equal(1);
      expect(create.getCall(0).args[0]).to.deep.equal({});
      expect(retVal).to.equal(false);

      exists.restore();
      done();
    });

    it("peer exists, forced update", function(done) {

      var exists = sinon.stub(selfInstance, "exists").returns(true);
      create.callsFake(function(){
        return {string: '1'}
      });
      var retVal = upsert({}, true);

      expect(create.calledOnce).to.equal(true);
      expect(create.getCall(0).args.length).to.equal(1);
      expect(create.getCall(0).args[0]).to.deep.equal({});
      expect(retVal).to.equal(false);

      exists.restore();
      done();
    });


  });

});
