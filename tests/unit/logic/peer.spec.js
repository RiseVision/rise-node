import { PeerState } from "../../../logic/peer";

var chai   = require("chai");
var expect = chai.expect;
var sinon  = require("sinon");
var rewire = require("rewire");
var path   = require("path");

var rootDir = path.join(__dirname, "../../..");

// var Peer = rewire(path.join(rootDir, "logic/peer"));
var Peer = rewire(path.join(rootDir, "logic/peer.ts")).Peer;

describe("logic/peer", function() {

	describe("constructor", function() {
		it("should be a function", function() {
			expect(Peer).to.be.a("function");

    });
    it("should be an instance of Peer", function() {

			const instance = new Peer({});
			expect(instance).to.be.an.instanceOf(Peer);

		});
	});

	describe("properties", function() {
		it("is correct", function() {
			expect(new Peer({}).properties).to.deep.equal([
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

		});
	});

	describe("immutable", function() {
		it("is correct", function() {
			expect(new Peer({}).immutable).to.deep.equal(["ip", "port", "string"]);

		});
	});

	describe("headers", function() {
		it("is correct", function() {
			expect(new Peer({}).headers).to.deep.equal([
				"os",
				"version",
				"dappid",
				"broadhash",
				"height",
				"nonce"
			]);

		});
	});

	describe("nullable", function() {
		it("is correct", function() {
			expect(new Peer({}).nullable).to.deep.equal([
				"os",
				"version",
				"dappid",
				"broadhash",
				"height",
				"clock",
				"updated"
			]);

		});
	});

	describe("STATE", function() {
		it('Should be banned 0 ', () => {
			expect(PeerState.BANNED).to.be.eq(0);
		});
    it('Should be DISCONNECTED 1 ', () => {
      expect(PeerState.DISCONNECTED).to.be.eq(1);
    });
    it('Should be CONNECTED 2 ', () => {
			expect(PeerState.CONNECTED).to.be.eq(2);
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

		it("returns peer with ip:port string", function() {

			peer.ip = "127.0.0.1";
			peer.port = "1010";

			const instance = new Peer(peer);

			expect(instance.string).to.deep.equal("127.0.0.1:1010");
		});

		it("returns peer with ip:port string from a long ip", function() {

      peer.ip = "2130706433";
      peer.port = "1010";

      const instance = new Peer(peer);

      expect(instance.string).to.deep.equal("127.0.0.1:1010");
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
		});

		it("returns peer without dappId and height", function() {
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
			const instance = new Peer(clonedPeer);
			const protoParseInt= sinon.spy(instance, 'parseInt');

			var retVal = instance.normalize(clonedPeer);

			retVal = Object.assign({}, retVal); // taking the peer from the instance

			expect(protoParseInt.calledTwice).to.be.true;
			expect(protoParseInt.firstCall.args.length).to.equal(2);
			expect(protoParseInt.firstCall.args[0]).to.equal(instance.port);
			expect(protoParseInt.firstCall.args[1]).to.equal(0);
			expect(protoParseInt.getCall(1).args.length).to.equal(2);
			expect(protoParseInt.getCall(1).args[0]).to.equal(instance.state);
			expect(protoParseInt.getCall(1).args[1]).to.equal(PeerState.DISCONNECTED);
			expect(retVal).to.deep.equal(expectedPeer);
		});
		it("returns peer without height", function() {
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
			const instance = new Peer({});
      const protoParseInt= sinon.spy(instance, 'parseInt');

      var retVal = instance.normalize(clonedPeer);

			retVal = Object.assign({}, retVal); // taking the peer from the instance

			expect(protoParseInt.calledTwice).to.be.true;
			expect(protoParseInt.firstCall.args.length).to.equal(2);
			expect(protoParseInt.firstCall.args[0]).to.equal(peer.port);
			expect(protoParseInt.firstCall.args[1]).to.equal(0);
			expect(protoParseInt.getCall(1).args.length).to.equal(2);
			expect(protoParseInt.getCall(1).args[0]).to.equal(peer.state);
			expect(protoParseInt.getCall(1).args[1]).to.equal(PeerState.DISCONNECTED);
			expect(retVal).to.deep.equal(expectedPeer);
		});

		it("returns unmuted dappIds array in peer obj without height", function() {
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
      const instance = new Peer({});
      const protoParseInt= sinon.spy(instance, 'parseInt');
			var retVal = instance.normalize(clonedPeer);

			retVal = Object.assign({}, retVal); // taking the peer from the instance

			expect(protoParseInt.calledTwice).to.be.true;
			expect(protoParseInt.firstCall.args.length).to.equal(2);
			expect(protoParseInt.firstCall.args[0]).to.equal(peer.port);
			expect(protoParseInt.firstCall.args[1]).to.equal(0);
			expect(protoParseInt.getCall(1).args.length).to.equal(2);
			expect(protoParseInt.getCall(1).args[0]).to.equal(peer.state);
			expect(protoParseInt.getCall(1).args[1]).to.equal(PeerState.DISCONNECTED);
			expect(retVal).to.deep.equal(expectedPeer);
		});

		it("returns unmuted dappIds array in peer obj with height", function() {
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
      const instance = new Peer({});
      const protoParseInt= sinon.spy(instance, 'parseInt');
			var retVal = instance.normalize(clonedPeer);

			retVal = Object.assign({}, retVal); // taking the peer from the instance

			expect(protoParseInt.calledThrice).to.be.true;
			expect(protoParseInt.firstCall.args.length).to.equal(2);
			expect(protoParseInt.firstCall.args[0]).to.equal(peer.height);
			expect(protoParseInt.firstCall.args[1]).to.equal(1);
			expect(protoParseInt.getCall(1).args.length).to.equal(2);
			expect(protoParseInt.getCall(1).args[0]).to.equal(peer.port);
			expect(protoParseInt.getCall(1).args[1]).to.equal(0);
			expect(protoParseInt.getCall(2).args.length).to.equal(2);
			expect(protoParseInt.getCall(2).args[0]).to.equal(peer.state);
			expect(protoParseInt.getCall(2).args[1]).to.equal(PeerState.DISCONNECTED);
			expect(retVal).to.deep.equal(expectedPeer);
		});
	});

	describe("parseInt", function() {
		it("returns fallback", function() {
			var retVal = new Peer({}).parseInt(null, 100);

			expect(retVal).to.equal(100);

		});

		it("parses integer from string", function() {
			var retVal = new Peer({}).parseInt("200", 100);

			expect(retVal).to.equal(200);

		});

		it("parses integer from float", function() {
			var retVal = new Peer({}).parseInt(2.2, 100);

			expect(retVal).to.equal(2);

		});

		it("returns integer", function() {
			var retVal = new Peer({}).parseInt(300, 100);

			expect(retVal).to.equal(300);

		});
	});

	describe("applyHeaders", function() {
		var normalize, update, instance;

		beforeEach(function() {
      instance = new Peer({});
			normalize = sinon.stub(instance, "normalize").callsFake(function(obj) {
				return obj;
			});
			update = sinon.stub(instance, "update");
		});
		it("returns empty {}", function() {
			var retVal = instance.applyHeaders(undefined);

			expect(retVal).to.deep.equal({});
			expect(normalize.calledOnce).to.be.true;
			expect(update.calledOnce).to.be.true;

		});
		it("returns headers", function() {
			var header = { something: "header" };
			var retVal = instance.applyHeaders(header);

			expect(retVal).to.deep.equal(header);
			expect(normalize.calledOnce).to.be.true;
			expect(update.calledOnce).to.be.true;

		});
	});

	describe("update", function() {
		it("returns only supported properties", function() {
      const instance = new Peer({});
			var normalize = sinon.stub(instance, "normalize").callsFake(function(obj) {
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
				nonce: "",
				port: 0,
			};

			var clonedPeer = Object.assign({}, peer);
			var retVal = instance.update(clonedPeer);
			delete retVal.normalize;
			retVal = Object.assign({}, retVal); // taking the peer from the instance
			delete peer.excluded;

			expect(normalize.calledOnce).to.be.true;
			expect(retVal).to.deep.equal(peer);

		});
	});

	describe("object", function() {
		it("returns only supported properties", function() {
      const instance = new Peer({});
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

		});
	});
});
