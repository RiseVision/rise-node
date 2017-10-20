var chai = require("chai");
var assertArrays = require("chai-arrays");
chai.use(assertArrays);
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var Block = rewire("../../../logic/block");
var ByteBuffer = require("bytebuffer");
var ed = require("../../../helpers/ed");
var zSchema = require("../../../helpers/z_schema");
var schema = new zSchema();
var transaction = require("../../../logic/transaction");
var crypto = require("crypto");
var passphrase =
  "oath polypody manumit effector half sigmoid abound osmium jewfish weed sunproof ramose";
var dummyKeypar = ed.makeKeypair(
  crypto.createHash("sha256").update(passphrase, "utf8").digest()
);

describe("logic/block", function() {
  var dummyBlock, dummyTransactions, callback, transaction, block, data;
  var bb = new ByteBuffer(1 + 4 + 32 + 32 + 8 + 8 + 64 + 64, true);
  bb.writeInt(123);
  bb.flip();
  var buffer = bb.toBuffer();

  beforeEach(function() {
    dummyTransactions = [
      {
        type: 0,
        amount: 108910891000000,
        fee: 5,
        timestamp: 0,
        recipientId: "15256762582730568272R",
        senderId: "14709573872795067383R",
        senderPublicKey:
          "35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892",
        signature:
          "f8fbf9b8433bf1bbea971dc8b14c6772d33c7dd285d84c5e6c984b10c4141e9fa56ace902b910e05e98b55898d982b3d5b9bf8bd897083a7d1ca1d5028703e03",
        id: "8139741256612355994"
      },
      {
        type: 0,
        amount: 108910891000000,
        fee: 3,
        timestamp: 0,
        recipientId: "6781920633453960895R",
        senderId: "14709573872795067383R",
        senderPublicKey:
          "35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892",
        signature:
          "e26edb739d93bb415af72f1c288b06560c0111c4505f11076ca20e2f6e8903d3b007309c0e04362bfeb8bf2021d0e67ce3c943bfe0c0193f6c9503eb6dfe750c",
        id: "16622990339377112127"
      }
    ];

    dummyBlock = {
      version: 0,
      totalAmount: 217821782000000,
      totalFee: 8,
      reward: 30000000,
      payloadHash:
        "b3cf5bb113442c9ba61ed0a485159b767ca181dd447f5a3d93e9dd73564ae762",
      timestamp: 1506889306558,
      numberOfTransactions: 2,
      payloadLength: 8,
      previousBlock: "1",
      generatorPublicKey:
        "c950f1e6c91485d2e6932fbd689bba636f73970557fe644cd901a438f74883c5",
      transactions: dummyTransactions,
      blockSignature:
        "8c5f2b088eaf0634e1f6e12f94a1f3e871f21194489c76ad2aae5c1b71acd848bc7b158fa3b827e97f3f685c772bfe1a72d59975cbd2ccaa0467026d13bae50a"
    };

    callback = sinon.spy();
    transaction = {
      getBytes: sinon.stub().returns(buffer),
      objectNormalize: sinon.stub().returnsArg(0)
    };
    clock = sinon.useFakeTimers();
    Block.__set__("setImmediate", setImmediate);
    block = new Block(ed, schema, transaction, callback);
    data = {
      transactions: dummyTransactions,
      timestamp: Date.now(),
      previousBlock: { id: "1", height: 10 },
      keypair: dummyKeypar
    };
  });
  afterEach(function() {
    clock.restore();
    callback.reset();
  });

  describe("when is imported", function() {
    it("should be a function", function() {
      expect(Block).to.be.a("function");
    });
  });

  it("block is an object", function() {
    expect(block).to.be.an.instanceof(Object);
  });

  it("callback is called", function() {
    var expectedScope = {
      ed: ed,
      schema: schema,
      transaction: transaction
    };

    clock.tick();

    expect(callback.calledOnce).to.be.true;
    expect(callback.calledWith(null, block));
    expect(callback.getCall(0).args[0]).to.equal(null);
    expect(callback.getCall(0).args[1].scope).to.deep.equal(expectedScope);
  });

  describe("create", function() {
    it("returns a new block", function() {
      clock.tick();

      var instance = callback.args[0][1];
      var new_block = instance.create(data);

      expect(callback.called).to.be.true;
      expect(new_block).to.be.an.instanceof(Object);
      expect(new_block.totalFee).to.equal(8);
      expect(new_block.numberOfTransactions).to.equal(2);
      expect(new_block.transactions).to.have.lengthOf(2);
    });
  });

  describe("sign", function() {
    it("returns a block signature with 128 of lenght", function() {
      clock.tick();
      expect(callback.called).to.be.true;
      var instance = callback.args[0][1];
      var blockSignature = instance.sign(dummyBlock, dummyKeypar);
      expect(blockSignature).to.have.lengthOf(128);
    });
  });

  describe("getBytes", function() {
    it("returns a Buffer", function() {
      clock.tick();
      var instance = callback.args[0][1];
      var bytes = instance.getBytes(dummyBlock);
      expect(bytes).to.be.an.instanceof(Buffer);
    });
  });

  describe("verifySignature", function() {
    it("returns a verified hash", function() {
      clock.tick();
      var instance = callback.args[0][1];
      var verification = instance.verifySignature(dummyBlock);
      expect(verification).to.be.true;
    });
  });

  describe("dbSave", function() {
    it("returns an object", function() {
      clock.tick();
      var instance = callback.args[0][1];
      var data = instance.dbSave(dummyBlock);
      expect(data).to.be.an.instanceof(Object);
      expect(data.table).to.equal("blocks");
      expect(data.fields).to.be.equalTo([
        "id",
        "version",
        "timestamp",
        "height",
        "previousBlock",
        "numberOfTransactions",
        "totalAmount",
        "totalFee",
        "reward",
        "payloadLength",
        "payloadHash",
        "generatorPublicKey",
        "blockSignature"
      ]);
      expect(data.values).to.have.all.keys([
        "id",
        "version",
        "timestamp",
        "height",
        "previousBlock",
        "numberOfTransactions",
        "totalAmount",
        "totalFee",
        "reward",
        "payloadLength",
        "payloadHash",
        "generatorPublicKey",
        "blockSignature"
      ]);
    });
  });

  describe("dbSave() with wrong parameters", function() {
    it("returns an exception", function() {
      clock.tick();
      var instance = callback.args[0][1];
      wrongBlock = {};
      var error = function() {
        instance.dbSave(wrongBlock);
      };
      expect(error).to.throw();
    });
  });

  describe("objectNormalize", function() {
    it("returns a normalized block", function() {
      clock.tick();
      var instance = callback.args[0][1];
      dummyBlock.foo = null;
      dummyBlock.bar;
      var block = instance.objectNormalize(dummyBlock);
      expect(block).to.be.an.instanceof(Object);
      expect(block.foo).to.be.undefined;
      expect(block.bar).to.be.undefined;
      expect(block.greeting).to.be.undefined;
    });
  });

  describe("objectNormalize() with a bad block schema", function() {
    it("throws an exception", function() {
      clock.tick();
      var instance = callback.args[0][1];
      dummyBlock.greeting = "Hello World!";
      var throwError = function() {
        instance.objectNormalize(dummyBlock);
      };
      expect(throwError).to.throw("Failed to validate block schema");
    });
  });

  describe("getId", function() {
    it("returns an id string", function() {
      clock.tick();
      var instance = callback.args[0][1];
      var id = instance.getId(dummyBlock);
      expect(id).to.equal("1931531116681750305");
    });
  });

  describe("getHash", function() {
    it("returns a hash of Uint8Array type", function() {
      clock.tick();
      var instance = callback.args[0][1];
      var hash = instance.getHash(dummyBlock);
      expect(hash).to.be.an.instanceof(Uint8Array);
      expect(hash).to.be.ofSize(32);
      var dummyHash = Uint8Array.from([
        33,
        231,
        109,
        34,
        81,
        45,
        206,
        26,
        221,
        6,
        171,
        168,
        208,
        242,
        96,
        79,
        166,
        77,
        243,
        219,
        78,
        12,
        172,
        171,
        166,
        123,
        127,
        92,
        0,
        242,
        227,
        135
      ]);
      expect(hash).to.be.equalTo(dummyHash);
    });
  });

  // TODO: This test is temporarely commented, because calculateFee() seems to be dead code. Waiting for a decision to be taken
  // describe('calculateFee()', function () {
  //   it('returns an integer', function () {
  //     var instance = callback.args[0][1]
  //     var fees = instance.calculateFee({})
  //     expect(fees).to.satisfy(Number.isInteger)
  //     expect(fees).to.equal(10000000)
  //   })
  // })

  describe("dbRead", function() {
    it("returns an object", function() {
      clock.tick();
      var instance = callback.args[0][1];
      var raw = {
        b_id: 10,
        b_version: 11,
        b_timestamp: Date.now(),
        b_height: 12,
        b_previousBlock: 9,
        b_numberOfTransactions: 1,
        b_totalAmount: 0,
        b_totalFee: 100,
        b_reward: 50,
        b_payloadLength: 13,
        b_payloadHash: 14,
        b_generatorPublicKey:
          "c950f1e6c91485d2e6932fbd689bba636f73970557fe644cd901a438f74883c5",
        b_blockSignature: 16,
        b_confirmations: 1
      };
      var block = instance.dbRead(raw);
      expect(block).to.be.instanceof(Object);
      expect(block).to.have.all.keys([
        "id",
        "version",
        "timestamp",
        "height",
        "previousBlock",
        "numberOfTransactions",
        "totalAmount",
        "totalFee",
        "reward",
        "payloadLength",
        "payloadHash",
        "generatorPublicKey",
        "generatorId",
        "blockSignature",
        "confirmations",
        "totalForged"
      ]);
      expect(block.totalForged).to.equal("150");
    });
  });
});
