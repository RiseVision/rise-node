import * as ByteBuffer from 'bytebuffer';
import * as chai from 'chai';
import 'chai-arrays';
import * as crypto from 'crypto';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSpy } from 'sinon';
import { constants } from '../../../src/helpers/';
import { Ed } from '../../../src/helpers';
import { BlockLogic } from '../../../src/logic';
import { BlockRewardLogicStub, TransactionLogicStub, ZSchemaStub } from '../../stubs';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');

const { expect } = chai;
chai.use(assertArrays);

const ed = new Ed();
const RewireBlock = rewire('../../../src/logic/block.ts');
const passphrase = 'oath polypody manumit effector half sigmoid abound osmium jewfish weed sunproof ramose';
const dummyKeypair = ed.makeKeypair(
  crypto.createHash('sha256').update(passphrase, 'utf8').digest()
);

// tslint:disable no-unused-expression
describe('logic/block', () => {
  let dummyBlock;
  let dummyTransactions;
  let callback;
  let instance;
  let data;
  let blockRewardLogicStub: BlockRewardLogicStub;
  let zschemastub: ZSchemaStub;
  let transactionLogicStub: TransactionLogicStub;
  let createHashSpy: SinonSpy;

  const bb = new ByteBuffer(1 + 4 + 32 + 32 + 8 + 8 + 64 + 64, true);
  bb.writeInt(123);
  bb.flip();
  const buffer = bb.toBuffer();

  beforeEach(() => {
    const rewiredCrypto = RewireBlock.__get__('crypto');
    createHashSpy = sinon.spy(rewiredCrypto, 'createHash');
    dummyTransactions = [
      {
        type: 1,
        amount: 108910891000000,
        fee: 5,
        timestamp: 0,
        recipientId: '15256762582730568272R',
        senderId: '14709573872795067383R',
        senderPublicKey: '35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892',
        signature: 'f8fbf9b8433bf1bbea971dc8b14c6772d33c7dd285d84c5e6c984b10c4141e9fa56ace' +
                   '902b910e05e98b55898d982b3d5b9bf8bd897083a7d1ca1d5028703e03',
        id: '8139741256612355994',
      },
      {
        type: 3,
        amount: 108910891000000,
        fee: 3,
        timestamp: 0,
        recipientId: '6781920633453960895R',
        senderId: '14709573872795067383R',
        senderPublicKey: '35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892',
        signature: 'e26edb739d93bb415af72f1c288b06560c0111c4505f11076ca20e2f6e8903d3b00730' +
                   '9c0e04362bfeb8bf2021d0e67ce3c943bfe0c0193f6c9503eb6dfe750c',
        id: '16622990339377112127',
      },
      {
        type: 2,
        amount: 108910891000000,
        fee: 3,
        timestamp: 0,
        recipientId: '6781920633453960895R',
        senderId: '14709573872795067383R',
        senderPublicKey: '35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892',
        signature: 'e26edb739d93bb415af72f1c288b06560c0111c4505f11076ca20e2f6e8903d3b00730' +
        '9c0e04362bfeb8bf2021d0e67ce3c943bfe0c0193f6c9503eb6dfe750c',
        id: '16622990339377114578',
      },
    ];

    dummyBlock = {
      version: 0,
      totalAmount: 217821782000000,
      totalFee: 8,
      reward: 30000000,
      payloadHash: 'b3cf5bb113442c9ba61ed0a485159b767ca181dd447f5a3d93e9dd73564ae762',
      timestamp: 1506889306558,
      numberOfTransactions: 2,
      payloadLength: 8,
      previousBlock: '1',
      generatorPublicKey: 'c950f1e6c91485d2e6932fbd689bba636f73970557fe644cd901a438f74883c5',
      transactions: dummyTransactions,
      blockSignature: '8c5f2b088eaf0634e1f6e12f94a1f3e871f21194489c76ad2aae5c1b71acd848bc7b' +
                      '158fa3b827e97f3f685c772bfe1a72d59975cbd2ccaa0467026d13bae50a',
    };

    callback = sinon.spy();
    zschemastub = new ZSchemaStub();
    blockRewardLogicStub = new BlockRewardLogicStub();
    instance = new BlockLogic();
    transactionLogicStub = new TransactionLogicStub();

    // Inject dependencies!
    (instance as any).zschema = zschemastub;
    (instance as any).blockReward = blockRewardLogicStub;
    (instance as any).ed = ed;
    (instance as any).transaction = transactionLogicStub;

    // Default stub configuration
    blockRewardLogicStub.stubConfig.calcReward.return = 100000;
    transactionLogicStub.stubs.getBytes.returns(buffer);
    transactionLogicStub.stubs.objectNormalize.returns(null);

    data = {
      keypair: dummyKeypair,
      timestamp: Date.now(),
      transactions: dummyTransactions,
      previousBlock: { id: '1', height: 10 },
    };
  });

  afterEach(() => {
    callback.resetHistory();
    createHashSpy.restore();
  });

  describe('create', () => {
    it('should return a new block', () => {
      const oldValue = constants.maxPayloadLength;
      constants.maxPayloadLength = 10;
      instance.transaction.getBytes.onCall(2).returns('1234567890abc');
      const newBlock = instance.create(data);
      expect(newBlock).to.be.an.instanceof(Object);
      expect(newBlock.totalFee).to.equal(8);
      expect(newBlock.numberOfTransactions).to.equal(2);
      expect(newBlock.transactions).to.have.lengthOf(2);
      constants.maxPayloadLength = oldValue;
    });

    it('should call blockReward.calcReward', () => {
      instance.create(data);
      expect(blockRewardLogicStub.stubs.calcReward.calledOnce).to.be.true;
    });

    it('should call transaction.getBytes per each tx', () => {
      instance.create(data);
      expect(transactionLogicStub.stubs.getBytes.callCount).to.equal(3);
    });

    it('should call crypto.createHash', () => {
      instance.create(data);
      expect(createHashSpy.called).to.be.true;
    });

    it('should call this.sign and this.objectNormalize', () => {
      const signSpy = sinon.spy(instance, 'sign');
      const objectNormalizeSpy = sinon.spy(instance, 'objectNormalize');
      instance.create(data);
      expect(signSpy.called).to.be.true;
      expect(objectNormalizeSpy.called).to.be.true;
      signSpy.restore();
      objectNormalizeSpy.restore();
    });
  });

  describe('sign', () => {
    it('should return a block signature with 128 of length', () => {
      const blockSignature = instance.sign(dummyBlock, dummyKeypair);
      expect(blockSignature).to.have.lengthOf(128);
    });

    it('should call ed.sign', () => {
      const signSpy = sinon.spy(ed, 'sign');
      instance.sign(dummyBlock, dummyKeypair);
      expect(signSpy.calledOnce).to.be.true;
      signSpy.restore();
    });
  });

  describe('[static] getBytes', () => {
    it('should return a Buffer', () => {
      expect(BlockLogic.getBytes(dummyBlock)).to.be.an.instanceof(Buffer);
    });

    it('should return a Buffer of a given length', () => {
      expect(BlockLogic.getBytes(dummyBlock).length).to.lte(4 + 4 + 8 + 4 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 32 + 64);
    });
  });

  describe('[static] getHash', () => {
    it('should return a hash of Uint8Array type', () => {
      const hash = BlockLogic.getHash(dummyBlock);
      expect(hash).to.be.an.instanceof(Uint8Array);
      expect(hash).to.be.ofSize(32);
      const dummyHash = Uint8Array.from(
        [ 33, 231, 109, 34, 81, 45, 206, 26, 221, 6, 171, 168, 208, 242, 96, 79,
                 166, 77, 243, 219, 78, 12, 172, 171, 166, 123, 127, 92, 0, 242, 227, 135 ]
      );
      expect(hash).to.be.equalTo(dummyHash as any);
    });

    it('should call crypto.createHash', () => {
      BlockLogic.getHash(dummyBlock);
      expect(createHashSpy.calledOnce).to.be.true;
    });
  });

  describe('[static] verifySignature', () => {
    it('should call ed.verify and return the same result', () => {
      const verifySpy = sinon.spy(ed, 'verify');
      const signed = instance.create(data);
      const verified = instance.verifySignature(signed);
      expect(verifySpy.calledOnce).to.be.true;
      expect(verifySpy.firstCall.returnValue).to.be.equal(verified);
      verifySpy.restore();
    });

    it('should call BlockLogic.getHash', () => {
      const signed = instance.create(data);
      const getHashSpy = sinon.spy(BlockLogic, 'getHash');
      instance.verifySignature(signed);
      expect(getHashSpy.calledOnce).to.be.true;
      expect(getHashSpy.firstCall.args[0]).to.be.deep.eq(signed);
      getHashSpy.restore();
    });
  });

  describe('dbSave', () => {
    it('should return a specific object', () => {
      const result = instance.dbSave(dummyBlock);
      expect(result).to.be.an.instanceof(Object);
      expect(result.table).to.equal('blocks');
      expect(result.fields).to.be.equalTo([
        'id',
        'version',
        'timestamp',
        'height',
        'previousBlock',
        'numberOfTransactions',
        'totalAmount',
        'totalFee',
        'reward',
        'payloadLength',
        'payloadHash',
        'generatorPublicKey',
        'blockSignature',
      ]);
      expect(result.values).to.have.all.keys([
        'id',
        'version',
        'timestamp',
        'height',
        'previousBlock',
        'numberOfTransactions',
        'totalAmount',
        'totalFee',
        'reward',
        'payloadLength',
        'payloadHash',
        'generatorPublicKey',
        'blockSignature',
      ]);
    });
  });

  describe('dbSave() with wrong parameters', () => {
    it('should throw an exception if invalid object is passed', () => {
      const wrongBlock = {};
      expect(() => {
        instance.dbSave(wrongBlock);
      }).to.throw();
    });
  });

  describe('objectNormalize', () => {
    it('should return a normalized block', () => {
      dummyBlock.foo = null;
      dummyBlock.bar = undefined;
      const block = instance.objectNormalize(dummyBlock);
      expect(block).to.be.an.instanceof(Object);
      expect(block.foo).to.be.undefined;
      expect(block.bar).to.be.undefined;
      expect(block.greeting).to.be.undefined;
    });

    it('should call zschema.validate', () => {
      instance.objectNormalize(dummyBlock);
      expect(zschemastub.stubs.validate.called).to.be.true;
    });
  });

  describe('objectNormalize() with a bad block schema', () => {
    it('should throw an exception if schema validation fails', () => {
      zschemastub.enqueueResponse('getLastErrors', []);
      zschemastub.enqueueResponse('validate', false);
      dummyBlock.greeting = 'Hello World!';
      expect(() => {
        instance.objectNormalize(dummyBlock);
      }).to.throw(/Failed to validate block schema/);
    });
    it('should throw an exception if schema validation fails with errors', () => {
      zschemastub.enqueueResponse('validate', false);
      zschemastub.enqueueResponse('getLastErrors', [{message: '1'}, {message: '2'}]);
      dummyBlock.greeting = 'Hello World!';
      expect(() => {
        instance.objectNormalize(dummyBlock);
      }).to.throw('Failed to validate block schema: 1, 2');
    })
  });

  describe('[static] getId', () => {
    it('should returns an id string', () => {
      expect(BlockLogic.getId(dummyBlock)).to.equal('1931531116681750305');
    });

    it('should call crypto.createHash', () => {
      BlockLogic.getId(dummyBlock);
      expect(createHashSpy.called).to.be.true;
    });

    it('should call BlockLogic.getBytes with block', () => {
      const getBytesSpy = sinon.spy(BlockLogic, 'getBytes');
      BlockLogic.getId(dummyBlock);
      expect(getBytesSpy.called).to.be.true;
      expect(getBytesSpy.firstCall.args[0]).to.be.deep.equal(dummyBlock);
      getBytesSpy.restore();
    });
  });

  describe('dbRead', () => {
    const raw = {
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
      b_generatorPublicKey: 'c950f1e6c91485d2e6932fbd689bba636f73970557fe644cd901a438f74883c5',
      b_blockSignature: 16,
      b_confirmations: 1,
    };

    it('should return a specific format', () => {
      const block = instance.dbRead(raw);
      expect(block).to.be.instanceof(Object);
      expect(block).to.have.all.keys([
        'id',
        'version',
        'timestamp',
        'height',
        'previousBlock',
        'numberOfTransactions',
        'totalAmount',
        'totalFee',
        'reward',
        'payloadLength',
        'payloadHash',
        'generatorPublicKey',
        'generatorId',
        'blockSignature',
        'confirmations',
        'totalForged',
      ]);
      expect(block.totalForged).to.equal('150');
    });

    it('should not call this.getAddressByPublicKey with b_generatorPublicKey until generatorId is read', () => {
      const getAddressByPublicKeySpy = sinon.spy(BlockLogic as any, 'getAddressByPublicKey');
      const result = instance.dbRead(raw);
      expect(getAddressByPublicKeySpy.called).to.be.false;
      result.generatorId;
      expect(getAddressByPublicKeySpy.called).to.be.true;
      expect(getAddressByPublicKeySpy.firstCall.args[0]).to.be.eq(raw.b_generatorPublicKey);
      getAddressByPublicKeySpy.restore();
    });

    it('should call parseInt on 9 fields', () => {
      const parseIntSpy = sinon.spy(global, 'parseInt');
      instance.dbRead(raw);
      expect(parseIntSpy.callCount).to.be.eq(9);
      parseIntSpy.restore();
    });
    it('should return null is raw.d_id is undefined', () => {
      delete raw.b_id;
      expect(instance.dbRead(raw)).to.be.null;
    });
  });
});
