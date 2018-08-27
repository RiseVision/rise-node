import * as ByteBuffer from 'bytebuffer';
import * as chai from 'chai';
import 'chai-arrays';
import * as crypto from 'crypto';
import {Container} from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import { IAccountLogic, IBlockLogic } from '../../../core-interfaces/src/logic';
import { BlockLogic } from '../../src/logic';
import { BlocksModel } from '../../src/models/BlocksModel';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { BlocksSymbols } from '../../src/blocksSymbols';
import { ModelSymbols } from '../../../core-models/src/helpers';
import { AppConfig, ConstantsType, DBCreateOp, IKeypair } from '../../../core-types/src';
import { ICrypto, Symbols } from '../../../core-interfaces/src';
import { createFakeBlock } from '../utils/createFakeBlocks';


// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');

const { expect } = chai;
chai.use(assertArrays);



// tslint:disable no-unused-expression
describe('logic/block', () => {
  const passphrase = 'oath polypody manumit effector half sigmoid abound osmium jewfish weed sunproof ramose';
  let keyPair: IKeypair;
  let sandbox: SinonSandbox;
  let container: Container;
  let dummyBlock;
  let dummyTransactions;
  let callback;
  let instance: BlockLogic;
  let constants: ConstantsType;
  let data;
  let createHashSpy: SinonSpy;
  let blocksModel: typeof BlocksModel;
  let cryptoImplementation: ICrypto;

  const bb = new ByteBuffer(1 + 4 + 32 + 32 + 8 + 8 + 64 + 64, true);
  bb.writeInt(123);
  bb.flip();
  const buffer = bb.toBuffer();

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer(['core-blocks', 'core-helpers', 'core', 'core-accounts', 'core-transactions']);
    cryptoImplementation = container.get(Symbols.generic.crypto);
    keyPair = cryptoImplementation.makeKeyPair(
      crypto.createHash('sha256').update(passphrase, 'utf8').digest()
    );
    constants = container.get(Symbols.generic.constants);
    createHashSpy = sandbox.spy(crypto, 'createHash');
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
        type: 0,
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
        type: 0,
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
        type: 0,
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
    instance = container.get(BlocksSymbols.logic.block);
    data = {
      keypair: keyPair,
      previousBlock: { id: '1', height: 10 },
      timestamp: Date.now(),
      transactions: dummyTransactions,
    };

    blocksModel = container.getNamed(ModelSymbols.model, BlocksSymbols.model);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('create', () => {
    it('should return a valid signed block', () => {
      const newBlock = instance.create(data);
      expect(newBlock).to.be.an.instanceof(Object);
      expect(newBlock.totalFee).to.equal(11);
      expect(newBlock.numberOfTransactions).to.equal(3);
      expect(newBlock.transactions).to.have.lengthOf(3);
      expect(newBlock.payloadLength).eq(351);
      expect(newBlock.previousBlock).eq('1');
      expect(newBlock.reward).eq(30000000);
      expect(newBlock.totalAmount).eq(326732673000000);
      expect(newBlock.payloadHash)
        .deep.eq(Buffer.from('6bb2fdf548c3a6c51f9e24e5069c94d09176bedffd91ecc875f477344be8b652', 'hex'))
      expect(newBlock.generatorPublicKey)
        .deep.eq(keyPair.publicKey);
      expect(cryptoImplementation.verify(
        instance.getHash(newBlock, false),
        newBlock.blockSignature,
        keyPair.publicKey,
      )).true;

    });
  });

  describe('sign', () => {
    it('should return a block signature of 64byte ', () => {
      const blockSignature = instance.sign(dummyBlock, keyPair);
      expect(blockSignature).to.have.lengthOf(64);
    });
    it('should return a valid signature', () => {
      const newBlock = instance.create(data);
      expect(instance.verifySignature(newBlock)).true;
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

    it('should call crypto.createHash', () => {
      instance.getHash(dummyBlock);
      expect(createHashSpy.calledOnce).to.be.true;
    });
  });

  describe('verifySignature', () => {
    // it('should call ed.verify and return the same result', () => {
    //   const verifySpy = sinon.spy(ed, 'verify');
    //   const signed = instance.create(data);
    //   const verified = instance.verifySignature(signed);
    //   expect(verifySpy.calledOnce).to.be.true;
    //   expect(verifySpy.firstCall.returnValue).to.be.equal(verified);
    //   verifySpy.restore();
    // });
    //
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
      const validBlock: any = instance.create(data);
      validBlock.foo = null;
      validBlock.bar = undefined;
      const block: any = instance.objectNormalize(validBlock);
      expect(block).to.be.an.instanceof(Object);
      expect(block.foo).to.be.undefined;
      expect(block.bar).to.be.undefined;
      expect(block.greeting).to.be.undefined;
    });

    it('should call fail by schema validation', () => {
      const validBlock: any = instance.create(data);
      delete validBlock.id;
      expect(() => instance.objectNormalize(validBlock)).to.throw('Missing required property: id');
    });
  });

  describe('objectNormalize with real data', () => {
    it('should pass with fake but correct block', () => {
      const b = createFakeBlock(container, {});
      instance.objectNormalize(b);
    });
    it('should return buffers on proper fields', () => {
      const b = createFakeBlock(container, {});
      b.generatorPublicKey = b.generatorPublicKey.toString('hex') as any;
      const res = instance.objectNormalize(b);
      expect(res.generatorPublicKey).instanceOf(Buffer);
    });
    it('should reject if height < 1', () => {
      const b = createFakeBlock(container, {});
      b.height = 0;
      expect(() => instance.objectNormalize(b)).to.throw('Failed to validate block schema: Value 0 is less than minimum 1');
    });
    it('should reject if id is exceeding length', () => {
      const b = createFakeBlock(container, {});
      b.id =  Array(21).fill('1').join('');
      expect(() => instance.objectNormalize(b))
        .to.throw('Failed to validate block schema: String is too long');
    });
    it('should reject if id is defined but zero length', () => {
      const b = createFakeBlock(container, {});
      b.id =  '';
      expect(() => instance.objectNormalize(b))
        .to.throw('Failed to validate block schema: String is too short');
    });
    it('should reject if id is defined invalid', () => {
      const b = createFakeBlock(container, {});
      b.id =  'a1a';
      expect(() => instance.objectNormalize(b))
        .to.throw('Failed to validate block schema: Object didn\'t pass validation for format id: a1a');
    });
    it('should validate blockSignature', () => {
      const b          = createFakeBlock(container, {});
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
      const b          = createFakeBlock(container, {});
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
      const b = createFakeBlock(container, {});

      delete b.numberOfTransactions;
      expect(() => instance.objectNormalize(b)).to.throw();
      b.numberOfTransactions = null;
      expect(() => instance.objectNormalize(b)).to.throw();

      b.numberOfTransactions = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum');
    });
    it('should validate payloadHash field', () => {
      const b = createFakeBlock(container, {});
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
      const b = createFakeBlock(container, {});
      delete b.payloadLength;
      expect(() => instance.objectNormalize(b)).to.throw();
      b.payloadLength = null;
      expect(() => instance.objectNormalize(b)).to.throw();
      b.payloadLength = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum');
    });
    it('should validate previousBlock field', () => {
      const b = createFakeBlock(container, {});
      delete b.previousBlock;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: previousBlock');

      b.previousBlock = 'a1a';
      expect(() => instance.objectNormalize(b))
        .to.throw(' Object didn\'t pass validation for format id: a1a');
    });
    it('should validate timestamp field', () => {
      const b = createFakeBlock(container, {});
      delete b.timestamp;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: timestamp');

      b.timestamp = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum 0');
    });
    it('should validate totalAmount', () => {
      const b = createFakeBlock(container, {});
      delete b.totalAmount;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: totalAmount');

      b.totalAmount = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum 0');
    });
    it('should validate totalFee', () => {
      const b = createFakeBlock(container, {});
      delete b.totalFee;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: totalFee');

      b.totalFee = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum 0');
    });
    it('should validate reward', () => {
      const b = createFakeBlock(container, {});
      delete b.reward;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: reward');

      b.reward = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum 0');
    });
    it('should validate height', () => {
      const b = createFakeBlock(container, {});
      delete b.height;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: height');

      b.height = 0;
      expect(() => instance.objectNormalize(b))
        .to.throw();
    });
    it('should validate version', () => {
      const b = createFakeBlock(container, {});
      delete b.version;
      expect(() => instance.objectNormalize(b))
        .to.throw('Missing required property: version');

      b.version = -1;
      expect(() => instance.objectNormalize(b))
        .to.throw('Value -1 is less than minimum 0');
    });
    //
    // it('should validate transactions', () => {
    //   let b = createFakeBlock(container, {});
    //   delete b.transactions;
    //   expect(() => instance.objectNormalize(b))
    //     .to.throw('Missing required property: transactions');
    //   b.transactions = null;
    //   expect(() => instance.objectNormalize(b))
    //     .to.throw('Missing required property: transactions');
    //
    //   b = createFakeBlock(container, {transactions: createRandomTransactions({send: 2}).map((tx) => toBufferedTransaction(tx))});
    //   instance.objectNormalize(b);
    //   expect(transactionLogicStub.stubs.objectNormalize.callCount).eq(2);
    // });
  });
  // describe('objectNormalize() with a bad block schema', () => {
  //   it('should throw an exception if schema validation fails', () => {
  //     zschemastub.enqueueResponse('getLastErrors', []);
  //     zschemastub.enqueueResponse('validate', false);
  //     dummyBlock.greeting = 'Hello World!';
  //     expect(() => {
  //       instance.objectNormalize(dummyBlock);
  //     }).to.throw(/Failed to validate block schema/);
  //   });
  //   it('should throw an exception if schema validation fails with errors', () => {
  //     zschemastub.enqueueResponse('validate', false);
  //     zschemastub.enqueueResponse('getLastErrors', [{message: '1'}, {message: '2'}]);
  //     dummyBlock.greeting = 'Hello World!';
  //     expect(() => {
  //       instance.objectNormalize(dummyBlock);
  //     }).to.throw('Failed to validate block schema: 1, 2');
  //   });
  // });

  describe('getId', () => {
    it('should returns an id string', () => {
      expect(instance.getId(dummyBlock)).to.equal('1931531116681750305');
    });

    it('should call crypto.createHash', () => {
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
      const accountLogic: IAccountLogic = container.get(Symbols.logic.account);
      const getAddressByPublicKeySpy = sinon.spy(accountLogic as any, 'generateAddressByPublicKey');
      const result = instance.dbRead(raw);
      expect(getAddressByPublicKeySpy.called).to.be.false;
      result.generatorId;
      expect(getAddressByPublicKeySpy.called).to.be.true;
      expect(getAddressByPublicKeySpy.firstCall.args[0]).to.be.deep.eq(Buffer.from(raw.b_generatorPublicKey, 'hex'));
      getAddressByPublicKeySpy.restore();
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
