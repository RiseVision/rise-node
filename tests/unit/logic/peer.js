var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../..");

var Peer = rewire(path.join(rootDir, "logic/peer"));

function construct(context, args) {
  function mocked() {
    return Peer.apply(context, [args]);
  }
  mocked.prototype = Peer.prototype;
  return new mocked();
}

describe("logic/peer", function() {
  var instance, callback, clock, peer;

  beforeEach(function() {
    var context = { accept: sinon.stub() };
    peer = {
      mocked: "true"
    };
    instance = construct(context, peer);
    // instance = new Peer();
    callback = sinon.stub();
    clock = sinon.useFakeTimers("setImmediate");
    Peer.__set__("setImmediate", setImmediate);
  });
  afterEach(function() {
    clock.reset();
  });

  describe("constructor", function() {
    it("should be a function", function(done) {
      expect(Peer).to.be.a("function");

      done();
    });
    it("should be an instance of Peer", function(done) {
      var context = { accept: sinon.stub() };
      var peerObj = {
        mocked: "true"
      };

      construct(context, peer);
      construct(context, null);

      expect(instance).to.be.an.instanceOf(Peer);
      expect(context.accept.calledTwice).to.be.true;
      expect(context.accept.getCall(0).args.length).to.equal(1);
      expect(context.accept.getCall(0).args[0]).to.deep.equal(peerObj);
      expect(context.accept.getCall(1).args.length).to.equal(1);
      expect(context.accept.getCall(1).args[0]).to.deep.equal({});

      done();
    });
  });

  describe("properties", function() {
    it("is correct", function(done) {
      expect(instance.properties).to.deep.equal([
        "ip",
        "port",
        "state",
        "os",
        "version",
        "dappid",
        "broadhash",
        "height",
        "clock",
        "updated",
        "nonce"
      ]);

      done();
    });
  });

  describe("immutable", function() {
    it("is correct", function(done) {
      expect(instance.immutable).to.deep.equal(["ip", "port", "string"]);

      done();
    });
  });

  describe("headers", function() {
    it("is correct", function(done) {
      expect(instance.headers).to.deep.equal([
        "os",
        "version",
        "dappid",
        "broadhash",
        "height",
        "nonce"
      ]);

      done();
    });
  });

  describe("nullable", function() {
    it("is correct", function(done) {
      expect(instance.nullable).to.deep.equal([
        "os",
        "version",
        "dappid",
        "broadhash",
        "height",
        "clock",
        "updated"
      ]);

      done();
    });
  });

  describe("STATE", function() {
    it("is correct", function(done) {
      expect(Peer.STATE).to.deep.equal({
        BANNED: 0,
        DISCONNECTED: 1,
        CONNECTED: 2
      });

      done();
    });
  });

  describe("accept", function() {
    var peer;

    beforeEach(function() {
      peer = {
        ip: "",
        port: "",
        state: "",
        os: "",
        version: "",
        dappid: "",
        broadhash: "",
        height: "",
        clock: "",
        updated: "",
        nonce: ""
      };
    });

    it("returns peer with ip:port string", function(done) {
      var normalize = sinon.stub(instance, "normalize").returns(peer);
      peer.ip = "127.0.0.1";
      peer.port = "1010";

      var retVal = instance.accept(peer);

      delete retVal.normalize;
      retVal = Object.assign({}, retVal); // taking the peer from the instance

      peer.string = "127.0.0.1:1010";

      expect(normalize.calledOnce).to.be.true;
      expect(retVal).to.deep.equal(peer);
      done();
    });

    it("returns peer with ip:port string from a long ip", function(done) {
      var normalize = sinon.stub(instance, "normalize").returns(peer);
      peer.ip = "2130706433";
      peer.port = "1010";

      var retVal = instance.accept(peer);

      delete retVal.normalize;
      retVal = Object.assign({}, retVal); // taking the peer from the instance

      peer.ip = "127.0.0.1";
      peer.string = "127.0.0.1:1010";

      expect(normalize.calledOnce).to.be.true;
      expect(retVal).to.deep.equal(peer);
      done();
    });

    it("returns unmuted peer", function(done) {
      var normalize = sinon.stub(instance, "normalize").returns(peer);

      var retVal = instance.accept(peer);

      delete retVal.normalize;
      retVal = Object.assign({}, retVal); // taking the peer from the instance

      expect(normalize.calledOnce).to.be.true;
      expect(retVal).to.deep.equal(peer);
      done();
    });
  });

  describe("normalize", function() {
    var peer, protoParseInt;

    beforeEach(function() {
      peer = {
        ip: "127.0.0.1",
        port: "1010",
        state: "2",
        os: "",
        version: "",
        dappid: "",
        broadhash: "",
        height: "",
        clock: "",
        updated: "",
        nonce: ""
      };
      protoParseInt = sinon.spy(instance, "parseInt");
    });
    afterEach(function() {
      protoParseInt.reset();
    });

    it("returns peer without dappId and height", function(done) {
      var expectedPeer = {
        ip: "127.0.0.1",
        port: 1010,
        state: 2,
        os: "",
        version: "",
        dappid: "",
        broadhash: "",
        height: "",
        clock: "",
        updated: "",
        nonce: ""
      };
      var clonedPeer = Object.assign({}, peer);
      var retVal = instance.normalize(clonedPeer);

      retVal = Object.assign({}, retVal); // taking the peer from the instance

      expect(protoParseInt.calledTwice).to.be.true;
      expect(protoParseInt.getCall(0).args.length).to.equal(2);
      expect(protoParseInt.getCall(0).args[0]).to.equal(peer.port);
      expect(protoParseInt.getCall(0).args[1]).to.equal(0);
      expect(protoParseInt.getCall(1).args.length).to.equal(2);
      expect(protoParseInt.getCall(1).args[0]).to.equal(peer.state);
      expect(protoParseInt.getCall(1).args[1]).to.equal(
        Peer.STATE.DISCONNECTED
      );
      expect(retVal).to.deep.equal(expectedPeer);
      done();
    });
    it("returns peer without height", function(done) {
      var expectedPeer = {
        ip: "127.0.0.1",
        port: 1010,
        state: 2,
        os: "",
        version: "",
        broadhash: "",
        height: "",
        clock: "",
        updated: "",
        nonce: "",
        dappid: ["dappId"]
      };
      peer.dappid = "dappId";
      var clonedPeer = Object.assign({}, peer);
      var retVal = instance.normalize(clonedPeer);

      retVal = Object.assign({}, retVal); // taking the peer from the instance

      expect(protoParseInt.calledTwice).to.be.true;
      expect(protoParseInt.getCall(0).args.length).to.equal(2);
      expect(protoParseInt.getCall(0).args[0]).to.equal(peer.port);
      expect(protoParseInt.getCall(0).args[1]).to.equal(0);
      expect(protoParseInt.getCall(1).args.length).to.equal(2);
      expect(protoParseInt.getCall(1).args[0]).to.equal(peer.state);
      expect(protoParseInt.getCall(1).args[1]).to.equal(
        Peer.STATE.DISCONNECTED
      );
      expect(retVal).to.deep.equal(expectedPeer);
      done();
    });

    it("returns unmuted dappIds array in peer obj without height", function(
      done
    ) {
      var expectedPeer = {
        ip: "127.0.0.1",
        port: 1010,
        state: 2,
        os: "",
        version: "",
        broadhash: "",
        height: "",
        clock: "",
        updated: "",
        nonce: "",
        dappid: ["dappId", "dappId2"]
      };
      peer.dappid = ["dappId", "dappId2"];
      var clonedPeer = Object.assign({}, peer);
      var retVal = instance.normalize(clonedPeer);

      retVal = Object.assign({}, retVal); // taking the peer from the instance

      expect(protoParseInt.calledTwice).to.be.true;
      expect(protoParseInt.getCall(0).args.length).to.equal(2);
      expect(protoParseInt.getCall(0).args[0]).to.equal(peer.port);
      expect(protoParseInt.getCall(0).args[1]).to.equal(0);
      expect(protoParseInt.getCall(1).args.length).to.equal(2);
      expect(protoParseInt.getCall(1).args[0]).to.equal(peer.state);
      expect(protoParseInt.getCall(1).args[1]).to.equal(
        Peer.STATE.DISCONNECTED
      );
      expect(retVal).to.deep.equal(expectedPeer);
      done();
    });

    it("returns unmuted dappIds array in peer obj with height", function(done) {
      var expectedPeer = {
        ip: "127.0.0.1",
        port: 1010,
        state: 2,
        os: "",
        version: "",
        broadhash: "",
        height: 50,
        clock: "",
        updated: "",
        nonce: "",
        dappid: ["dappId", "dappId2"]
      };
      peer.dappid = ["dappId", "dappId2"];
      peer.height = "50";
      var clonedPeer = Object.assign({}, peer);
      var retVal = instance.normalize(clonedPeer);

      retVal = Object.assign({}, retVal); // taking the peer from the instance

      expect(protoParseInt.calledThrice).to.be.true;
      expect(protoParseInt.getCall(0).args.length).to.equal(2);
      expect(protoParseInt.getCall(0).args[0]).to.equal(peer.height);
      expect(protoParseInt.getCall(0).args[1]).to.equal(1);
      expect(protoParseInt.getCall(1).args.length).to.equal(2);
      expect(protoParseInt.getCall(1).args[0]).to.equal(peer.port);
      expect(protoParseInt.getCall(1).args[1]).to.equal(0);
      expect(protoParseInt.getCall(2).args.length).to.equal(2);
      expect(protoParseInt.getCall(2).args[0]).to.equal(peer.state);
      expect(protoParseInt.getCall(2).args[1]).to.equal(
        Peer.STATE.DISCONNECTED
      );
      expect(retVal).to.deep.equal(expectedPeer);
      done();
    });
  });

  describe("normalize", function() {
    it("returns fallback", function(done) {
      var retVal = instance.parseInt(null, 100);

      expect(retVal).to.equal(100);

      done();
    });

    it("parses integer from string", function(done) {
      var retVal = instance.parseInt("200", 100);

      expect(retVal).to.equal(200);

      done();
    });

    it("parses integer from float", function(done) {
      var retVal = instance.parseInt(2.2, 100);

      expect(retVal).to.equal(2);

      done();
    });

    it("returns integer", function(done) {
      var retVal = instance.parseInt(300, 100);

      expect(retVal).to.equal(300);

      done();
    });
  });

  describe("applyHeaders", function() {
    var normalize, update;

    beforeEach(function() {
      normalize = sinon.stub(instance, "normalize").callsFake(function(obj) {
        return obj;
      });
      update = sinon.stub(instance, "update");
    });
    it("returns empty {}", function(done) {
      var retVal = instance.applyHeaders(undefined);

      expect(retVal).to.deep.equal({});
      expect(normalize.calledOnce).to.be.true;
      expect(update.calledOnce).to.be.true;

      done();
    });
    it("returns headers", function(done) {
      var header = { something: "header" };
      var retVal = instance.applyHeaders(header);

      expect(retVal).to.deep.equal(header);
      expect(normalize.calledOnce).to.be.true;
      expect(update.calledOnce).to.be.true;

      done();
    });
  });

  describe("update", function() {
    it("returns only supported properties", function(done) {
      var normalize = sinon
        .stub(instance, "normalize")
        .callsFake(function(obj) {
          return obj;
        });
      var peer = {
        state: "",
        os: "",
        version: "",
        dappid: "",
        broadhash: "",
        height: "",
        clock: "",
        updated: "",
        nonce: ""
      };

      var clonedPeer = Object.assign({}, peer);
      var retVal = instance.update(clonedPeer);
      delete retVal.normalize;
      retVal = Object.assign({}, retVal); // taking the peer from the instance
      delete peer.excluded;

      expect(normalize.calledOnce).to.be.true;
      expect(retVal).to.deep.equal(peer);

      done();
    });
  });

  describe("object", function() {
    it("returns only supported properties", function(done) {
      var peer = {
        ip: "127.0.0.1",
        port: "1010",
        state: "2",
        os: "some",
        version: "some",
        dappid: "some",
        broadhash: "some",
        height: "some",
        clock: "some",
        updated: "some",
        nonce: "some",
        excluded: true, // <- this field shouldn't show in the result∏
        nullable: [
          "os",
          "version",
          "dappid",
          "broadhash",
          "height",
          "clock",
          "updated"
        ],
        properties: [
          "ip",
          "port",
          "state",
          "os",
          "version",
          "dappid",
          "broadhash",
          "height",
          "clock",
          "updated",
          "nonce"
        ]
      };
      var expectedPeer = {
        ip: "127.0.0.1",
        port: "1010",
        state: "2",
        os: "some",
        version: "some",
        dappid: "some",
        broadhash: "some",
        height: "some",
        clock: "some",
        updated: "some",
        nonce: "some"
      };

      var retVal = instance.object.call(peer);

      expect(retVal).to.deep.equal(expectedPeer);

      done();
    });
  });
});
