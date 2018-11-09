import * as ByteBuffer from 'bytebuffer';
import * as chai from 'chai';
import 'chai-arrays';
import * as crypto from 'crypto';
import * as supersha from 'supersha';
import {Container} from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import { Ed } from '../../../src/helpers';
import { constants } from '../../../src/helpers/';
import {Symbols} from '../../../src/ioc/symbols';
import { BlockLogic } from '../../../src/logic';
import { BlockRewardLogicStub, TransactionLogicStub, ZSchemaStub } from '../../stubs';
import { createContainer } from '../../utils/containerCreator';
import { BlocksModel } from '../../../src/models';
import { IBlockLogic } from '../../../src/ioc/interfaces/index';
import { DBCreateOp } from '../../../src/types/genericTypes';
import { z_schema } from '../../../src/helpers/z_schema';
import { createFakeBlock, getFakePrevBlock } from '../../utils/blockCrafter';
import { createRandomTransactions, toBufferedTransaction } from '../../utils/txCrafter';
import AccountLogicStub from '../../stubs/logic/AccountLogicStub';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');

const { expect } = chai;
chai.use(assertArrays);

const ed = new Ed();

const passphrase = 'oath polypody manumit effector half sigmoid abound osmium jewfish weed sunproof ramose';
const dummyKeypair = ed.makeKeypair(
  crypto.createHash('sha256').update(passphrase, 'utf8').digest()
);

// tslint:disable no-unused-expression
describe('logic/block', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let dummyBlock;
  let dummyTransactions;
  let callback;
  let instance: IBlockLogic;
  let accLogic: AccountLogicStub;
  let data;
  let blockRewardLogicStub: BlockRewardLogicStub;
  let zschemastub: ZSchemaStub;
  let transactionLogicStub: TransactionLogicStub;
  let createHashSpy: SinonSpy;
  let blocksModel: typeof BlocksModel;

  const bb = new ByteBuffer(1 + 4 + 32 + 32 + 8 + 8 + 64 + 64, true);
  bb.writeInt(123);
  bb.flip();
  const buffer = bb.toBuffer();

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    container = createContainer();
    createHashSpy = sandbox.spy(supersha, 'sha256');
    dummyTransactions = [
      {
        amount: 108910891000000,
        fee: 5,
        id: '8139741256612355994',
        recipientId: '15256762582730568272R',
        senderId: '14709573872795067383R',
        senderPublicKey: Buffer.from('35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892', 'hex'),
        signature: Buffer.from('f8fbf9b8433bf1bbea971dc8b14c6772d33c7dd285d84c5e6c984b10c4141e9fa56ace' +
        '902b910e05e98b55898d982b3d5b9bf8bd897083a7d1ca1d5028703e03', 'hex'),
        timestamp: 0,
        type: 1,
      },
      {
        amount: 108910891000000,
        fee: 3,
        id: '16622990339377112127',
        recipientId: '6781920633453960895R',
        senderId: '14709573872795067383R',
        senderPublicKey: Buffer.from('35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892', 'hex'),
        signature: Buffer.from('e26edb739d93bb415af72f1c288b06560c0111c4505f11076ca20e2f6e8903d3b00730' +
        '9c0e04362bfeb8bf2021d0e67ce3c943bfe0c0193f6c9503eb6dfe750c', 'hex'),
        timestamp: 0,
        type: 3,
      },
      {
        amount: 108910891000000,
        fee: 3,
        id: '16622990339377114578',
        recipientId: '6781920633453960895R',
        senderId: '14709573872795067383R',
        senderPublicKey: Buffer.from('35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892', 'hex'),
        signature: Buffer.from('e26edb739d93bb415af72f1c288b06560c0111c4505f11076ca20e2f6e8903d3b00730' +
        '9c0e04362bfeb8bf2021d0e67ce3c943bfe0c0193f6c9503eb6dfe750c', 'hex'),
        timestamp: 0,
        type: 2,
      },
    ];

    dummyBlock = {
      blockSignature: Buffer.from('8c5f2b088eaf0634e1f6e12f94a1f3e871f21194489c76ad2aae5c1b71acd848bc7b' +
      '158fa3b827e97f3f685c772bfe1a72d59975cbd2ccaa0467026d13bae50a', 'hex'),
      generatorPublicKey: Buffer.from('c950f1e6c91485d2e6932fbd689bba636f73970557fe644cd901a438f74883c5', 'hex'),
      numberOfTransactions: 2,
      payloadHash: Buffer.from('b3cf5bb113442c9ba61ed0a485159b767ca181dd447f5a3d93e9dd73564ae762', 'hex'),
      payloadLength: 8,
      previousBlock: '1',
      reward: 30000000,
      timestamp: 1506889306558,
      totalAmount: 217821782000000,
      totalFee: 8,
      transactions: dummyTransactions,
      version: 0,
    };

    callback = sandbox.spy();
    zschemastub = container.get(Symbols.generic.zschema);
    blockRewardLogicStub = container.get(Symbols.logic.blockReward);
    container.rebind(Symbols.helpers.ed).toConstantValue(ed);
    container.rebind(Symbols.logic.block).to(BlockLogic).inSingletonScope();
    instance = container.get(Symbols.logic.block);
    accLogic = container.get(Symbols.logic.account);
    transactionLogicStub = container.get(Symbols.logic.transaction);

    // Default stub configuration
    blockRewardLogicStub.stubConfig.calcReward.return = 100000;
    transactionLogicStub.stubs.getBytes.returns(buffer);
    transactionLogicStub.stubs.objectNormalize.returns(null);

    data = {
      keypair: dummyKeypair,
      previousBlock: getFakePrevBlock(),
      timestamp: Date.now(),
      transactions: dummyTransactions,
    };

    blocksModel = container.get(Symbols.models.blocks);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('create', () => {
    it('should return a new block', () => {
      const oldValue = constants.maxPayloadLength;
      constants.maxPayloadLength = 10;
      (instance as any).transaction.getBytes.onCall(2).returns('1234567890abc');
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

    it('should call supersha.sha256', () => {
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
      expect(blockSignature).to.have.lengthOf(64);
    });

    it('should call ed.sign', () => {
      const signSpy = sinon.spy(ed, 'sign');
      instance.sign(dummyBlock, dummyKeypair);
      expect(signSpy.calledOnce).to.be.true;
      signSpy.restore();
    });
  });

  describe('getBytes', () => {
    it('should return a Buffer', () => {
      expect(instance.getBytes(dummyBlock)).to.be.an.instanceof(Buffer);
    });

    it('should return a Buffer of a given length', () => {
      expect(instance.getBytes(dummyBlock).length).to.lte(4 + 4 + 8 + 4 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 32 + 64);
    });
  });

  describe('getHash', () => {
    it('should return a hash of Uint8Array type', () => {
      const hash = instance.getHash(dummyBlock);
      expect(hash).to.be.an.instanceof(Uint8Array);
      expect(hash).to.be.ofSize(32);
      const dummyHash = Uint8Array.from(
        [ 33, 231, 109, 34, 81, 45, 206, 26, 221, 6, 171, 168, 208, 242, 96, 79,
                 166, 77, 243, 219, 78, 12, 172, 171, 166, 123, 127, 92, 0, 242, 227, 135 ]
      );
      expect(hash).to.be.equalTo(dummyHash as any);
    });

    it('should call supersha.sha256', () => {
      instance.getHash(dummyBlock);
      expect(createHashSpy.calledOnce).to.be.true;
    });
  });

  describe('verifySignature', () => {
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
      const getHashSpy = sinon.spy(instance, 'getHash');
      instance.verifySignature(signed);
      expect(getHashSpy.calledOnce).to.be.true;
      expect(getHashSpy.firstCall.args[0]).to.be.deep.eq(signed);
      getHashSpy.restore();
    });
  });

  describe('dbSave', () => {
    it('should return a specific object', () => {
      const result: DBCreateOp<BlocksModel> = instance.dbSave(dummyBlock) as any;
      expect(result.model).to.be.deep.eq(blocksModel);
      expect(result.type).to.be.deep.eq('create');
      const toSave = {... dummyBlock};
      delete toSave.transactions;
      expect(result.values).to.be.deep.eq(toSave);

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
  describe('objectNormalize with real data', () => {
    beforeEach(() => {
      container = createContainer();
      container.rebind(Symbols.generic.zschema).toConstantValue(new z_schema({}));
      container.rebind(Symbols.logic.block).to(BlockLogic);
      instance = container.get(Symbols.logic.block);
      transactionLogicStub = container.get(Symbols.logic.transaction);
      transactionLogicStub.stubs.objectNormalize.returns(null);
    });
    it('should pass with fake but correct block', () => {
      const b = createFakeBlock();
      instance.objectNormalize(b);
    });
    it('should return buffers on proper fields', () => {
      const b = createFakeBlock();
      b.generatorPublicKey = b.generatorPublicKey.toString('hex') as any;
      const res = instance.objectNormalize(b);
      expect(res.generatorPublicKey).instanceOf(Buffer);
    });
    it('should reject if height < 1', () => {
      const b = createFakeBlock();
      b.height = 0;
      expect(() => instance.objectNormalize(b)).to.throw('Failed to validate block schema: Value 0 is less than minimum 1');
    });
    it('should reject if id is exceeding length', () => {
      const b = createFakeBlock();
      b.id =  Array(21).fill('1').join('');
      expect(() => instance.objectNormalize(b))
        .to.throw('Failed to validate block schema: String is too long');
    });
    it('should reject if id is defined but zero length', () => {
      const b = createFakeBlock();
      b.id =  '';
      expect(() => instance.objectNormalize(b))
        .to.throw('Failed to validate block schema: String is too short');
    });
    it('should reject if id is defined invalid', () => {
      const b = createFakeBlock();
      b.id =  'a1a';
      expect(() => instance.objectNormalize(b))
        .to.throw('Failed to validate block schema: Object didn\'t pass validation for format id: a1a');
    });
    it('should validate blockSignature', () => {
      const b          = createFakeBlock();
      delete b.blockSignature;
      expect(() => instance.objectNormalize(b))
        .to.throw();
      b.blockSignature = null;
      expect(() => instance.objectNormalize(b))
        .to.throw();

      // blocksignature not long 64bytes
      b.blockSignature = Buffer.alloc(0);
      const error = 'Failed to validate block schema: Object didn\'t pass validation for format signatureBuf';
      expect(() => instance.objectNormalize(b))
        .to.throw(error);

      // blockSignature as string not long enough
      b.blockSignature = Buffer.alloc(32).toString('hex') as any;
      expect(() => instance.objectNormalize(b))
        .to.throw(error);

      // valid buffer
      b.blockSignature = Buffer.alloc(64);
      instance.objectNormalize(b);

      // Valid string
      b.blockSignature = Buffer.alloc(64).toString('hex') as any;
      instance.objectNormalize(b);
    });
    it('should validate generatorPublicKEy', () => {
      const b          = createFakeBlock();
      delete b.generatorPublicKey;
      expect(() => instance.objectNormalize(b))
        .to.throw();
      b.generatorPublicKey = null;
      expect(() => instance.objectNormalize(b))
        .to.throw();

      // blocksignature not long 64bytes
      b.generatorPublicKey = Buffer.alloc(0);
      const error = 'Failed to validate block schema: Object didn\'t pass validation for format publicKeyBuf';
      expect(() => instance.objectNormalize(b))
        .to.throw(error);

      // blockSignature as string not long enough
      b.generatorPublicKey = Buffer.alloc(31).toString('hex') as any;
      expect(() => instance.objectNormalize(b))
        .to.throw(error);

      // valid buffer
      b.generatorPublicKey = Buffer.alloc(32);
      instance.objectNormalize(b);

      // Valid string
      b.generatorPublicKey = Buffer.alloc(32).toString('hex') as any;
      instance.objectNormalize(b);
    });
    it('should validate numberOfTransactions field', () => {
      const b = createFakeBlock();

      delete b.numberOfTransactions;
      expect(() => instance.objectNormalize(b)).to.throw();
      b.numberOfTransactions = null;
      expect(() => instance.objectNormalize(b)).to.throw();

      b.numberOfTransactions = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum');
    });
    it('should validate payloadHash field', () => {
      const b = createFakeBlock();
      delete b.payloadHash;
      expect(() => instance.objectNormalize(b)).to.throw();
      b.payloadHash = null;
      expect(() => instance.objectNormalize(b)).to.throw();
      // payloadHash not long 32bytes
      b.payloadHash = Buffer.alloc(0);
      const error = 'Failed to validate block schema: Object didn\'t pass validation for format sha256Buf';
      expect(() => instance.objectNormalize(b))
        .to.throw(error);

      // payloadHash as string not long enough
      b.payloadHash = Buffer.alloc(31).toString('hex') as any;
      expect(() => instance.objectNormalize(b))
        .to.throw(error);

      // valid buffer
      b.payloadHash = Buffer.alloc(32);
      instance.objectNormalize(b);

      // Valid string
      b.payloadHash = Buffer.alloc(32).toString('hex') as any;
      instance.objectNormalize(b);
    });
    it('should validate payloadLength', () => {
      const b = createFakeBlock();
      delete b.payloadLength;
      expect(() => instance.objectNormalize(b)).to.throw();
      b.payloadLength = null;
      expect(() => instance.objectNormalize(b)).to.throw();
      b.payloadLength = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum');
    });
    it('should validate previousBlock field', () => {
      const b = createFakeBlock();
      delete b.previousBlock;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: previousBlock');

      b.previousBlock = 'a1a';
      expect(() => instance.objectNormalize(b))
        .to.throw(' Object didn\'t pass validation for format id: a1a');
    });
    it('should validate timestamp field', () => {
      const b = createFakeBlock();
      delete b.timestamp;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: timestamp');

      b.timestamp = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum 0');
    });
    it('should validate totalAmount', () => {
      const b = createFakeBlock();
      delete b.totalAmount;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: totalAmount');

      b.totalAmount = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum 0');
    });
    it('should validate totalFee', () => {
      const b = createFakeBlock();
      delete b.totalFee;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: totalFee');

      b.totalFee = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum 0');
    });
    it('should validate reward', () => {
      const b = createFakeBlock();
      delete b.reward;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: reward');

      b.reward = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum 0');
    });
    it('should validate height', () => {
      const b = createFakeBlock();
      delete b.height;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: height');

      b.height = 0;
      expect(() => instance.objectNormalize(b))
        .to.throw();
    });
    it('should validate version', () => {
      const b = createFakeBlock();
      delete b.version;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: version');

      b.version = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum 0');
    });

    it('should validate transactions', () => {
      let b = createFakeBlock();
      delete b.transactions;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: transactions');
      b.transactions = null;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: transactions');

      b = createFakeBlock({transactions: createRandomTransactions({send: 2}).map((tx) => toBufferedTransaction(tx))});
      instance.objectNormalize(b);
      expect(transactionLogicStub.stubs.objectNormalize.callCount).eq(2);
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
    });
  });

  describe('getId', () => {
    it('should returns an id string', () => {
      expect(instance.getId(dummyBlock)).to.equal('1931531116681750305');
    });

    it('should call supersha.sha256', () => {
      instance.getId(dummyBlock);
      expect(createHashSpy.called).to.be.true;
    });

    it('should call BlockLogic.getBytes with block', () => {
      const getBytesSpy = sinon.spy(instance, 'getBytes');
      instance.getId(dummyBlock);
      expect(getBytesSpy.called).to.be.true;
      expect(getBytesSpy.firstCall.args[0]).to.be.deep.equal(dummyBlock);
      getBytesSpy.restore();
    });
  });

  describe('dbRead', () => {
    const raw = {
      b_blockSignature: Buffer.alloc(64).fill('a'),
      b_payloadHash: Buffer.alloc(32).fill('a'),
      b_confirmations: 1,
      b_generatorPublicKey: 'c950f1e6c91485d2e6932fbd689bba636f73970557fe644cd901a438f74883c5',
      b_height: 12,
      b_id: 10,
      b_numberOfTransactions: 1,
      b_payloadLength: 13,
      b_previousBlock: 9,
      b_reward: 50,
      b_timestamp: Date.now(),
      b_totalAmount: 0,
      b_totalFee: 100,
      b_version: 11,
    } as any;

    it('should return a specific format', () => {
      const block = instance.dbRead(raw);
      expect(block).to.be.instanceof(Object);
      expect(block).to.have.all.keys([
        'id',
        'version',
        'timestamp',
        'height',
        'previousBlock',
        'previousBlockIDSignature',
        'numberOfTransactions',
        'totalAmount',
        'totalFee',
        'reward',
        'payloadLength',
        'payloadHash',
        'generatorPublicKey',
        'generatorId',
        'blockSignature',
        'totalForged',
      ]);
      expect(block.totalForged).to.equal('150');
    });

    it('should not call this.getAddressByPublicKey with b_generatorPublicKey until generatorId is read', () => {
      accLogic.enqueueResponse('generateAddressByPublicKey', 'meow');
      const result = instance.dbRead(raw);
      expect(accLogic.stubs.generateAddressByPublicKey.called).to.be.false;
      result.generatorId;
      expect(accLogic.stubs.generateAddressByPublicKey.called).to.be.true;
      expect(accLogic.stubs.generateAddressByPublicKey.firstCall.args[0]).to.be.eq(raw.b_generatorPublicKey);
    });

    it('should call parseInt on 8 fields', () => {
      const parseIntSpy = sinon.spy(global, 'parseInt');
      instance.dbRead(raw);
      expect(parseIntSpy.callCount).to.be.eq(8);
      parseIntSpy.restore();
    });
    it('should return null is raw.d_id is undefined', () => {
      delete raw.b_id;
      expect(instance.dbRead(raw)).to.be.null;
    });
  });

});
