import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BigNum, IKeypair, TransactionType } from '../../../src/helpers';
import { TransactionLogic } from '../../../src/logic';
import { IBaseTransaction, SendTransaction } from '../../../src/logic/transactions';
import {
  AccountLogicStub, DbStub, EdStub, ExceptionsManagerStub, LoggerStub,
  RoundsLogicStub, SlotsStub, ZSchemaStub
} from '../../stubs';
import ByteBufferStub from '../../stubs/utils/ByteBufferStub';

chai.use(chaiAsPromised);

// tslint:disable-next-line no-var-requires
const genesisBlock      = require('../../../etc/mainnet/genesisBlock.json');
const expect            = chai.expect;
const RewireTransaction = rewire('../../../src/logic/transaction.ts');

// tslint:disable no-unused-expression
describe('logic/transaction', () => {
  let instance: TransactionLogic;

  let dbStub: DbStub;
  let edStub: EdStub;
  let slotsStub: SlotsStub;
  let zSchemaStub: ZSchemaStub;
  let accountLogicStub: AccountLogicStub;
  let roundsLogicStub: RoundsLogicStub;
  let loggerStub: LoggerStub;
  let excManagerStub: ExceptionsManagerStub;
  let sendTransaction: SendTransaction;
  let sandbox: SinonSandbox;
  let sender: any;
  let requester: any;
  let block: any;

  let tx: IBaseTransaction<any>;
  const sampleBuffer = Buffer.from('35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892', 'hex');

  const publicKeyHex      = '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3';
  const privateKeyHex     = 'cd25f48e0bf2c9ac3c9fe67f22fea54bb108f694bb69eb10520c48b228635df0' +
    '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3';
  const keyPair: IKeypair = {
    publicKey : Buffer.from(publicKeyHex, 'hex'),
    privateKey: Buffer.from(privateKeyHex, 'hex'),
  };

  beforeEach(() => {
    dbStub           = new DbStub();
    edStub           = new EdStub();
    slotsStub        = new SlotsStub();
    zSchemaStub      = new ZSchemaStub();
    accountLogicStub = new AccountLogicStub();
    roundsLogicStub  = new RoundsLogicStub();
    loggerStub       = new LoggerStub();
    loggerStub       = new LoggerStub();
    excManagerStub   = new ExceptionsManagerStub();
    sendTransaction  = new SendTransaction();

    instance = new RewireTransaction.TransactionLogic();
    instance.attachAssetType(sendTransaction);

    // inject dependencies
    (instance as any).db           = dbStub;
    (instance as any).ed           = edStub;
    (instance as any).slots        = slotsStub;
    (instance as any).schema       = zSchemaStub;
    (instance as any).genesisBlock = genesisBlock;
    (instance as any).accountLogic = accountLogicStub;
    (instance as any).roundsLogic  = roundsLogicStub;
    (instance as any).logger       = loggerStub;
    (instance as any).excManager   = excManagerStub;

    tx = {
      type           : TransactionType.SEND,
      amount         : 108910891000000,
      fee            : 10,
      timestamp      : 0,
      recipientId    : '15256762582730568272R',
      senderId       : '1233456789012345R',
      senderPublicKey: '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3',
      signature      : 'f8fbf9b8433bf1bbea971dc8b14c6772d33c7dd285d84c5e6c984b10c4141e9f' +
      'a56ace902b910e05e98b55898d982b3d5b9bf8bd897083a7d1ca1d5028703e03',
      id             : '8139741256612355994',
      asset          : {},
    };

    sender = {
      balance  : 10000000,
      address  : '1233456789012345R',
      publicKey: '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3',
    };

    requester = {
      balance  : 20000000,
      address  : '9999999999999999R',
      publicKey: 'e73f4ab9f4794b110ceefecd8f880d5189235526f8a1e2f482264e5d4982fc07',
    };

    block = {
      version             : 0,
      totalAmount         : 10999999991000000,
      totalFee            : 0,
      payloadHash         : 'cd8171332c012514864edd8eb6f68fc3ea6cb2afbaf21c56e12751022684cea5',
      timestamp           : 0,
      numberOfTransactions: 0,
      payloadLength       : 0,
      previousBlock       : null,
      generatorPublicKey  : '35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892',
      transactions        : [],
      height              : 1,
      blockSignature      : 'a9e12f49432364c1e171dd1f9e2d34f8baffdda0f4ef0989d9439e5d46aba55ef640' +
      '149ff7ed7d3e3d4e1ad4173ecfd1cc0384f5598175c15434e0d97ce4150d',
      id                  : '13191140260435645922',
    };

    edStub.stubs.sign.returns(sampleBuffer);
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('attachAssetType', () => {
    it('should throw an error if invalid object is passed', () => {
      expect(() => {
        instance.attachAssetType({} as any);
      }).to.throw('Invalid instance interface');
    });

    it('should add the instance to the types array and return instance', () => {
      // We need a valid object to avoid the error, easy to instantiate real code.
      const txType = new SendTransaction();
      instance.attachAssetType(txType);
      expect((instance as any).types[txType.type]).to.be.deep.equal(txType);
    });
  });

  describe('sign', () => {
    it('should call getHash', () => {
      const getHashSpy = sandbox.spy(instance, 'getHash');
      instance.sign(keyPair, tx);
      expect(getHashSpy.calledOnce).to.be.true;
      expect(getHashSpy.firstCall.args.length).to.be.equal(1);
      expect(getHashSpy.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should call ed.sign', () => {
      const getHashSpy = sandbox.spy(instance, 'getHash');
      instance.sign(keyPair, tx);
      expect(edStub.stubs.sign.calledOnce).to.be.true;
      expect(edStub.stubs.sign.firstCall.args.length).to.be.equal(2);
      expect(edStub.stubs.sign.firstCall.args[0]).to.be.deep.equal(getHashSpy.firstCall.returnValue);
      expect(edStub.stubs.sign.firstCall.args[1]).to.be.deep.equal(keyPair);
    });

    it('should return a hex string', () => {
      const toRet = instance.sign(keyPair, tx);
      expect(toRet).to.match(/^[0-9a-f]+$/);
    });
  });

  describe('multiSign', () => {
    it('should call getHash', () => {
      const getHashSpy = sandbox.spy(instance, 'getHash');
      instance.multiSign(keyPair, tx);
      expect(getHashSpy.calledOnce).to.be.true;
      expect(getHashSpy.firstCall.args.length).to.be.equal(3);
      expect(getHashSpy.firstCall.args[0]).to.be.deep.equal(tx);
      expect(getHashSpy.firstCall.args[1]).to.be.true;
      expect(getHashSpy.firstCall.args[2]).to.be.true;
    });

    it('should call ed.sign', () => {
      const getHashSpy = sandbox.spy(instance, 'getHash');
      instance.multiSign(keyPair, tx);
      expect(edStub.stubs.sign.calledOnce).to.be.true;
      expect(edStub.stubs.sign.firstCall.args.length).to.be.equal(2);
      expect(edStub.stubs.sign.firstCall.args[0]).to.be.deep.equal(getHashSpy.firstCall.returnValue);
      expect(edStub.stubs.sign.firstCall.args[1]).to.be.deep.equal(keyPair);
    });

    it('should return a hex string', () => {
      const toRet = instance.multiSign(keyPair, tx);
      expect(toRet).to.match(/[0-9a-f]+/);
    });
  });

  describe('getId', () => {
    it('should call getHash', () => {
      const getHashSpy = sandbox.spy(instance, 'getHash');
      instance.getId(tx);
      expect(getHashSpy.calledOnce).to.be.true;
      expect(getHashSpy.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should call BigNum.fromBuffer', () => {
      const RewBigNum     = RewireTransaction.__get__('_1').BigNum;
      const fromBufferSpy = sandbox.spy(RewBigNum, 'fromBuffer');
      instance.getId(tx);
      expect(fromBufferSpy.calledOnce).to.be.true;
    });

    it('should return a string', () => {
      const retVal = instance.getId(tx);
      expect(retVal).to.be.a('string');
      expect(retVal).to.match(/^[0-9]+$/);
    });
  });

  describe('getHash', () => {
    it('should call crypto.createHash', () => {
      const crypto        = RewireTransaction.__get__('crypto');
      const createHashSpy = sandbox.spy(crypto, 'createHash');
      instance.getHash(tx);
      expect(createHashSpy.calledOnce).to.be.true;
      expect(createHashSpy.firstCall.args.length).to.be.equal(1);
      expect(createHashSpy.firstCall.args[0]).to.be.equal('sha256');
    });

    it('should call this.getBytes', () => {
      const getBytesSpy = sandbox.spy(instance, 'getBytes');
      instance.getHash(tx, true, false);
      expect(getBytesSpy.calledOnce).to.be.true;
      expect(getBytesSpy.firstCall.args[0]).to.be.deep.equal(tx);
      expect(getBytesSpy.firstCall.args[1]).to.be.deep.equal(true);
      expect(getBytesSpy.firstCall.args[2]).to.be.deep.equal(false);
    });

    it('should return a Buffer', () => {
      const retVal = instance.getHash(tx);
      expect(retVal).to.be.instanceOf(Buffer);
    });
  });

  describe('getBytes', () => {
    let origByteBuffer;
    let byteBufferStub;
    beforeEach(() => {
      byteBufferStub = new ByteBufferStub();
      origByteBuffer = RewireTransaction.__get__('ByteBuffer');
      // We need to fake the behavior of new ByteBuffer(...) to be able to test calls to methods.
      RewireTransaction.__set__('ByteBuffer', (capacity?: number, littleEndian?: boolean, noAssert?: boolean) => {
        if (capacity) {
          byteBufferStub.capacity = capacity;
        }
        if (littleEndian) {
          byteBufferStub.littleEndian = littleEndian;
        }
        if (noAssert) {
          byteBufferStub.noAssert = noAssert;
        }
        return byteBufferStub;
      });
      byteBufferStub.enqueueResponse('toBuffer', new Buffer(10));
    });

    afterEach(() => {
      RewireTransaction.__set__('ByteBuffer', origByteBuffer);
    });

    it('should throw an error if wrong tx type', () => {
      // Only tx type 0 is registered
      tx.type = 999;
      expect(() => {
        instance.getBytes(tx);
      }).to.throw('Unknown transaction type 999');
    });

    it('should call getBytes from the right txType', () => {
      const getBytesSpy = sandbox.spy(sendTransaction, 'getBytes');
      instance.getBytes(tx, true, false);
      expect(getBytesSpy.calledOnce).to.be.true;
      expect(getBytesSpy.firstCall.args[0]).to.be.deep.equal(tx);
      expect(getBytesSpy.firstCall.args[1]).to.be.deep.equal(true);
      expect(getBytesSpy.firstCall.args[2]).to.be.deep.equal(false);
    });

    it('should create a ByteBuffer of the right length', () => {
      instance.getBytes(tx, true, false);
      expect(byteBufferStub.capacity).to.be.equal(213);
    });

    it('should add the type as first byte of the ByteBuffer', () => {
      instance.getBytes(tx, true, false);
      expect(byteBufferStub.sequence[0]).to.be.equal(tx.type);
    });

    it('should add the timestamp to the ByteBuffer via writeInt', () => {
      tx.timestamp = Date.now();
      instance.getBytes(tx, true, false);
      expect(byteBufferStub.sequence[1]).to.be.equal(tx.timestamp);
    });

    it('should add the senderPublicKey to the ByteBuffer', () => {
      const senderPublicKeyBuffer = Buffer.from(tx.senderPublicKey, 'hex');
      instance.getBytes(tx);
      for (let i = 0; i < senderPublicKeyBuffer.length; i++) {
        expect(byteBufferStub.sequence[2 + i]).to.be.equal(senderPublicKeyBuffer[i]);
      }
    });

    it('should add the requesterPublicKey to the ByteBuffer if tx.requesterPublicKey', () => {
      tx.requesterPublicKey          = '35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51899';
      const requesterPublicKeyBuffer = Buffer.from(tx.requesterPublicKey, 'hex');
      instance.getBytes(tx);
      for (let i = 0; i < requesterPublicKeyBuffer.length; i++) {
        // We always get here after 34 writes to the ByteBuffer
        expect(byteBufferStub.sequence[34 + i]).to.be.equal(requesterPublicKeyBuffer[i]);
      }
    });

    it('should add the recipientId to the ByteBuffer if tx.recipientId', () => {
      tx.recipientId  = '123123123123123R';
      const recipient = tx.recipientId.slice(0, -1);
      const recBuf    = new BigNum(recipient).toBuffer({ size: 8 });
      instance.getBytes(tx);
      for (let i = 0; i < recBuf.length; i++) {
        expect(byteBufferStub.sequence[34 + i]).to.be.equal(recBuf[i]);
      }
    });

    it('should add 8 zeroes to the ByteBuffer if NOT tx.recipientId', () => {
      tx.recipientId = undefined;
      instance.getBytes(tx);
      for (let i = 34; i < 42; i++) {
        expect(byteBufferStub.sequence[i]).to.be.equal(0);
      }
    });

    it('should add the amount to the ByteBuffer via writeLong', () => {
      instance.getBytes(tx);
      expect(byteBufferStub.sequence[42]).to.be.equal(tx.amount);
      expect(byteBufferStub.spies.writeLong.calledOnce).to.be.true;
      expect(byteBufferStub.spies.writeLong.firstCall.args[0]).to.be.equal(tx.amount);
    });

    it('should add the asset bytes to the ByteBuffer if not empty', () => {
      tx.signSignature   = '';
      const getBytesStub = sinon.stub(sendTransaction, 'getBytes');
      getBytesStub.returns(sampleBuffer);
      instance.getBytes(tx);
      for (let i = 0; i < sampleBuffer.length; i++) {
        expect(byteBufferStub.sequence[43 + i]).to.be.equal(sampleBuffer[i]);
      }
      getBytesStub.restore();
    });

    it('should add the signature to the ByteBuffer', () => {
      instance.getBytes(tx);
      const sigBuf = Buffer.from(tx.signature, 'hex');
      for (let i = 0; i < sigBuf.length; i++) {
        // tx.asset is empty so we start from 43
        expect(byteBufferStub.sequence[43 + i]).to.be.equal(sigBuf[i]);
      }
    });

    it('should NOT add the signature to the ByteBuffer if skipSignature', () => {
      instance.getBytes(tx, true, true);
      const sigBuf = Buffer.from(tx.signature, 'hex');
      for (let i = 0; i < sigBuf.length; i++) {
        // tx.asset is empty so we start from 43
        expect(byteBufferStub.sequence[43 + i]).to.be.equal(undefined);
      }
    });

    it('should add the signSignature to the ByteBuffer', () => {
      tx.signSignature = '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9' +
        '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9';
      instance.getBytes(tx);
      const sigBuf = Buffer.from(tx.signSignature, 'hex');
      for (let i = 0; i < sigBuf.length; i++) {
        // tx.asset is empty so we start from 43
        expect(byteBufferStub.sequence[107 + i]).to.be.equal(sigBuf[i]);
      }
    });

    it('should NOT add the signSignature to the ByteBuffer if skipSecondSignature', () => {
      tx.signSignature = '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9' +
        '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9';
      instance.getBytes(tx, false, true);
      const sigBuf = Buffer.from(tx.signSignature, 'hex');
      for (let i = 0; i < sigBuf.length; i++) {
        // tx.asset is empty so we start from 43
        expect(byteBufferStub.sequence[107 + i]).to.be.equal(undefined);
      }
    });

    it('should flip the ByteBuffer', () => {
      instance.getBytes(tx, true, true);
      expect(byteBufferStub.spies.flip.calledOnce).to.be.true;
    });

    it('should return a Buffer', () => {
      byteBufferStub.stubs.toBuffer.returns(sampleBuffer);
      const retVal = instance.getBytes(tx, true, true);
      expect(retVal).to.be.instanceOf(Buffer);
    });
  });

  describe('ready', () => {
    it('should call assertKnownTransactionType', () => {
      const akttStub = sandbox.stub(instance, 'assertKnownTransactionType');
      instance.ready(tx, {} as any);
      expect(akttStub.calledOnce).to.be.true;
    });
    it('should return false if !sender', () => {
      const retVal = instance.ready(tx, undefined);
      expect(retVal).to.be.false;
    });
    it('should call txType.ready and return', () => {
      const txTypeReadyStub = sandbox.stub(sendTransaction, 'ready').returns('OK');
      const retVal          = instance.ready(tx, {} as any);
      expect(txTypeReadyStub.calledOnce).to.be.true;
      expect(retVal).to.be.eq('OK');
    });
  });

  describe('assertKnownTransactionType', () => {
    it('should throw if invalid txtype', () => {
      tx.type = 999999;
      expect(() => {
        instance.assertKnownTransactionType(tx);
      }).to.throw(/Unknown transaction type/);
    });

    it('should not throw if OK', () => {
      expect(() => {
        instance.assertKnownTransactionType(tx);
      }).not.to.throw();
    });
  });

  describe('countById', () => {
    it('should call db.one', async () => {
      dbStub.stubs.one.returns({});
      await instance.countById(tx);
      expect(dbStub.stubs.one.calledOnce).to.be.true;
      expect(dbStub.stubs.one.firstCall.args[1]).to.be.deep.equal({ id: tx.id });
    });

    it('should throw and log if db.one throws', async () => {
      const e = new Error('dbStub.one Error');
      dbStub.stubs.one.throws(e);
      await expect(instance.countById(tx)).to.be.rejectedWith('Transaction#countById error');
      expect(loggerStub.stubs.error.calledOnce).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.deep.equal(e.stack);
    });

    it('should return the count', async () => {
      dbStub.stubs.one.returns({ count: 100 });
      const count = await instance.countById(tx);
      expect(count).to.be.equal(100);
    });
  });

  describe('assertNonConfirmed', () => {
    it('should call countById', async () => {
      const countByIdStub = sandbox.stub(instance, 'countById').returns(0);
      await instance.assertNonConfirmed(tx);
      expect(countByIdStub.calledOnce).to.be.true;
    });

    it('should throw if count > 0', async () => {
      sandbox.stub(instance, 'countById').returns(100);
      await expect(instance.assertNonConfirmed(tx)).to.be.rejectedWith(/Transaction is already confirmed/);
    });
  });

  describe('checkBalance', () => {
    it('should return error:null if OK', () => {
      const retVal = instance.checkBalance(1000, 'balance', tx, sender as any);
      expect(retVal.error).to.be.eq(null);
    });

    it('should return error if balance exceeded', () => {
      // Pass an amount greater than sender balance.
      const retVal = instance.checkBalance(sender.balance + 1, 'balance', tx, sender as any);
      expect(retVal.error).to.match(/Account does not have enough currency/);
    });
    it('should allow to exceed balance only for genesisBlock', () => {
      // tslint:disable-next-line
      tx['blockId'] = genesisBlock.id;
      // Pass an amount greater than sender balance.
      const retVal  = instance.checkBalance(sender.balance + 1, 'balance', tx, sender as any);
      expect(retVal.error).to.be.equal(null);
    });
  });

  describe('process', () => {
    let txTypeProcessStub;
    let instGetIdStub;

    beforeEach(() => {
      txTypeProcessStub = sandbox.stub(sendTransaction, 'process').resolves();
      instGetIdStub     = sandbox.stub(instance, 'getId').returns(tx.id);
    });

    it('should call assertKnownTransactionType', async () => {
      const akttStub = sandbox.stub(instance, 'assertKnownTransactionType').throws('stop');
      try {
        await instance.process(tx, sender, {} as any);
        throw new Error('Should throw');
      } catch (e) {
        expect(akttStub.calledOnce).to.be.true;
        expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx);
      }
    });

    it('should throw if Missing sender', async () => {
      await expect(instance.process(tx, undefined, {} as any)).to.be.rejectedWith('Missing sender');
    });

    it('should throw if Invalid transaction id', async () => {
      instGetIdStub.returns('unlikelyId');
      await expect(instance.process(tx, sender, {} as any)).to.be.rejectedWith('Invalid transaction id');
    });

    it('should call getId', async () => {
      await instance.process(tx, sender, {} as any);
      expect(instGetIdStub.calledOnce).to.be.true;
      expect(instGetIdStub.firstCall.args[0]).to.be.deep.eq(tx);
    });

    it('should call process on the right txType', async () => {
      await instance.process(tx, sender, {} as any);
      expect(txTypeProcessStub.calledOnce).to.be.true;
      expect(txTypeProcessStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeProcessStub.firstCall.args[1]).to.be.deep.equal(sender);
    });

    it('should return the tx with senderId added', async () => {
      const retVal            = await instance.process(tx, sender, {} as any);
      const expectedRetVal    = Object.assign({}, tx);
      expectedRetVal.senderId = sender.address;
      expect(retVal).to.be.deep.equal(expectedRetVal);
    });
  });

  describe('verify', () => {
    let verifySignatureStub: SinonStub;
    let checkBalanceStub: SinonStub;
    let assertNonConfirmedStub: SinonStub;
    let calculateFeeStub: SinonStub;
    let txTypeVerifyStub: SinonStub;

    beforeEach(() => {
      (tx as any).blockId    = '12345ab';
      // instance stubs
      verifySignatureStub    = sandbox.stub(instance, 'verifySignature').returns(true);
      checkBalanceStub       = sandbox.stub(instance, 'checkBalance').returns({ exceeded: false });
      assertNonConfirmedStub = sandbox.stub(instance, 'assertNonConfirmed').resolves();
      // txType stubs
      calculateFeeStub       = sandbox.stub(sendTransaction, 'calculateFee').returns(tx.fee);
      txTypeVerifyStub       = sandbox.stub(sendTransaction, 'verify').resolves();
    });

    it('should call assertKnownTransactionType', async () => {
      // we want it to throw immediately
      tx.type        = 99999;
      const akttStub = sandbox.stub(instance, 'assertKnownTransactionType').throws('stop');
      try {
        await instance.verify(tx, sender, requester, 1);
        throw new Error('Should throw!');
      } catch (e) {
        expect(akttStub.calledOnce).to.be.true;
      }
    });

    it('should throw if Missing sender', async () => {
      await expect(instance.verify(tx, undefined, requester, 1)).to.be.rejectedWith('Missing sender');
    });

    it('should throw if sender second signature and no signSignature in tx', async () => {
      tx.requesterPublicKey  = requester.publicKey;
      sender.secondSignature = 'signature';
      delete tx.signSignature;
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Missing sender second signature');
    });

    it('should throw if second signature provided and sender has none enabled', async () => {
      delete tx.requesterPublicKey;
      delete sender.secondSignature;
      tx.signSignature = 'signSignature';
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Sender does not have a second signature');
    });

    it('should throw if missing requester second signature', async () => {
      tx.requesterPublicKey     = requester.publicKey;
      requester.secondSignature = 'secondSignature';
      delete tx.signSignature;
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Missing requester second signature');
    });

    it('should throw if second signature provided, and requester has none enabled', async () => {
      tx.requesterPublicKey = requester.publicKey;
      delete requester.secondSignature;
      tx.signSignature = 'signSignature';
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Requester does not have a second signature');
    });

    it('should throw if sender publicKey and tx.senderPublicKey mismatches', async () => {
      tx.senderPublicKey = 'anotherPublicKey';
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith(/Invalid sender public key/);
    });

    it('should throw if sender is not genesis account unless block id equals genesis', async () => {
      sender.publicKey    = genesisBlock.generatorPublicKey;
      tx.senderPublicKey  = sender.publicKey;
      (tx as any).blockId = 'anotherBlockId';
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Invalid sender. Can not send from genesis account');
    });

    it('should throw if senderId mismatch', async () => {
      tx.senderId = sender.address + 'ABC';
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Invalid sender address');
    });

    it('should throw if invalid member in keysgroup', async () => {
      sender.multisignatures  = [];
      tx.asset.multisignature = {
        keysgroup: [
          0, // invalid
          false, // invalid
          'a', // valid
        ],
      };
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Invalid member in keysgroup');
    });

    it('should verify multisignatures', async () => {
      sender.multisignatures  = [];
      tx.signatures = ['a', 'b'];
      tx.requesterPublicKey          = 'yz';
      tx.asset.multisignature = {
        keysgroup: [
          'xyz',
          'def',
        ],
      };
      verifySignatureStub.returns(true);

      await instance.verify(tx, sender, requester, 1);

      expect(verifySignatureStub.callCount).to.equal(3);
      expect(verifySignatureStub.args[0][0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.args[0][1]).to.be.equal(tx.requesterPublicKey);
      expect(verifySignatureStub.args[0][2]).to.be.equal(tx.signature);

      expect(verifySignatureStub.args[1][0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.args[1][1]).to.be.equal('ef');
      expect(verifySignatureStub.args[1][2]).to.be.equal('a');

      expect(verifySignatureStub.args[2][0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.args[2][1]).to.be.equal('ef');
      expect(verifySignatureStub.args[2][2]).to.be.equal('b');
    });

    it('should throw if account does not belong to multisignature group', async () => {
      // FIXME This must be broken in src/logic/transaction.ts No other way to test this behavior
      tx.requesterPublicKey  = requester.publicKey;
      // Initializing this as an empty string is the only way to test this behavior
      sender.multisignatures = '';
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Account does not belong to multisignature group');
    });

    it('should call verifySignature', async () => {
      tx.requesterPublicKey  = requester.publicKey;
      sender.multisignatures = [];
      verifySignatureStub.returns(false);
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Failed to verify signature');
      expect(verifySignatureStub.calledOnce).to.be.true;
      expect(verifySignatureStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.firstCall.args[1]).to.be.equal(tx.requesterPublicKey);
      expect(verifySignatureStub.firstCall.args[2]).to.be.equal(tx.signature);
    });

    it('should call verifySignature with secondPublicKey if sender.secondSignature', async () => {
      sender.secondSignature    = 'aaaaaaa';
      sender.secondPublicKey    = 'secondPublicKey';
      requester.secondSignature = 'bbbbbbb';
      tx.signSignature          = sender.secondSignature;
      tx.requesterPublicKey     = requester.publicKey;
      sender.multisignatures    = [];
      verifySignatureStub.onCall(0).returns(true);
      verifySignatureStub.onCall(1).returns(false);
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Failed to verify second signature');
      expect(verifySignatureStub.calledTwice).to.be.true;
      expect(verifySignatureStub.secondCall.args[0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.secondCall.args[1]).to.be.equal(sender.secondPublicKey);
      expect(verifySignatureStub.secondCall.args[2]).to.be.equal(tx.signSignature);
      expect(verifySignatureStub.secondCall.args[3]).to.be.equal(true);
    });

    it('should throw if signatures are not unique', async () => {
      tx.signatures = ['a', 'a', 'b'];
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Encountered duplicate signature in transaction');
    });

    it('should throw if failed to verify multisignature', async () => {
      tx.signatures = ['a', 'b'];
      // First call is simple validation with requester or sender publio key
      verifySignatureStub.onCall(0).returns(true);
      // Second call is inside tx.signatures loop
      verifySignatureStub.onCall(1).returns(false);
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Failed to verify multisignature');
    });

    it('should call verifySignature if tx.signatures not empty', async () => {
      tx.signatures          = ['a', 'b'];
      sender.multisignatures = ['c', 'd'];

      // First call is simple validation with requester or sender publio key
      verifySignatureStub.onCall(0).returns(true);
      // Second call is inside tx.signatures loop
      verifySignatureStub.onCall(1).returns(false);
      await instance.verify(tx, sender, requester, 1);
      expect(verifySignatureStub.secondCall.args[0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.secondCall.args[1]).to.be.equal(sender.multisignatures[0]);
      expect(verifySignatureStub.secondCall.args[2]).to.be.equal(tx.signatures[0]);
    });

    it('should call txType.calculateFee and throw if fee mismatch', async () => {
      // Returned value different from fee in tx (tx.fee is 10)
      calculateFeeStub.returns(9);
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Invalid transaction fee');
      expect(calculateFeeStub.calledOnce).to.be.true;
      expect(calculateFeeStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(calculateFeeStub.firstCall.args[1]).to.be.deep.equal(sender);
      expect(calculateFeeStub.firstCall.args[2]).to.be.equal(1);
    });

    it('should throw if amount is < 0', async () => {
      tx.amount = -100;
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should throw if amount is > totalAmout', async () => {
      (tx as any).amount = '10999999991000001';
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should throw if amount is decimal', async () => {
      tx.amount = 10.1;
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should throw if amount is written in exponential notation', async () => {
      (tx as any).amount = '10e3';
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should call checkBalance and throw if checkBalance returns an error', async () => {
      checkBalanceStub.returns({ exceeded: true, error: 'checkBalance error' });
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('checkBalance error');
      expect(checkBalanceStub.calledOnce).to.be.true;
      expect(checkBalanceStub.firstCall.args[0].toString()).to.be.equal('108910891000010');
      expect(checkBalanceStub.firstCall.args[1]).to.be.equal('balance');
      expect(checkBalanceStub.firstCall.args[2]).to.be.deep.equal(tx);
      expect(checkBalanceStub.firstCall.args[3]).to.be.deep.equal(sender);
    });

    it('should call slots.getSlotNumber', async () => {
      slotsStub.stubs.getSlotNumber.returns(1);
      await instance.verify(tx, sender, requester, 1);
      expect(slotsStub.stubs.getSlotNumber.calledTwice).to.be.true;
      expect(slotsStub.stubs.getSlotNumber.firstCall.args[0]).to.be.equal(tx.timestamp);
    });

    it('should throw if timestamp is in the future', async () => {
      slotsStub.stubs.getSlotNumber.onCall(0).returns(1000000);
      slotsStub.stubs.getSlotNumber.onCall(1).returns(10);
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Invalid transaction timestamp. Timestamp is in the future');
    });

    it('should await verify from the txType', async () => {
      await instance.verify(tx, sender, requester, 1);
      expect(txTypeVerifyStub.calledOnce).to.be.true;
      expect(txTypeVerifyStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeVerifyStub.firstCall.args[1]).to.be.deep.equal(sender);
    });

    it('should call assertNonConfirmed', async () => {
      await instance.verify(tx, sender, requester, 1);
      expect(assertNonConfirmedStub.calledOnce).to.be.true;
    });
  });

  describe('verifySignature', () => {
    let akttStub: SinonStub;
    let getHashStub: SinonStub;
    const theHash = Buffer.from('123abc', 'hex');

    beforeEach(() => {
      edStub.enqueueResponse('verify', true);
      akttStub    = sandbox.stub(instance, 'assertKnownTransactionType').returns(true);
      getHashStub = sandbox.stub(instance, 'getHash').returns(theHash);
    });

    it('should call assertKnownTransactionType', () => {
      instance.verifySignature(tx, tx.senderPublicKey, tx.signature);
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should call ed.verify', () => {
      instance.verifySignature(tx, tx.senderPublicKey, tx.signature);
      expect(edStub.stubs.verify.calledOnce).to.be.true;
      expect(edStub.stubs.verify.firstCall.args[0]).to.be.deep.equal(theHash);
      expect(edStub.stubs.verify.firstCall.args[1]).to.be.deep.equal(Buffer.from(tx.signature, 'hex'));
      expect(edStub.stubs.verify.firstCall.args[2]).to.be.deep.equal(Buffer.from(tx.senderPublicKey, 'hex'));
    });

    it('should call getHash', () => {
      instance.verifySignature(tx, tx.senderPublicKey, tx.signature);
      expect(getHashStub.calledOnce).to.be.true;
      expect(getHashStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(getHashStub.firstCall.args[1]).to.be.equal(true);
      expect(getHashStub.firstCall.args[2]).to.be.equal(true);
    });
    it('should call false if signature is null', ()=>{
      expect(instance.verifySignature(tx, tx.senderPublicKey, null)).to.be.false;
    });
  });

  describe('apply', () => {
    let readyStub: SinonStub;
    let checkBalanceStub: SinonStub;
    let txTypeApplyStub: SinonStub;

    beforeEach(() => {
      // instance stubs
      readyStub        = sandbox.stub(instance, 'ready').returns(true);
      checkBalanceStub = sandbox.stub(instance, 'checkBalance').returns({ exceeded: false });
      // dependency stubs
      roundsLogicStub.stubs.calcRound.returns(1);
      accountLogicStub.stubs.merge.resolves();
      // txType stub
      txTypeApplyStub = sandbox.stub(sendTransaction, 'apply').resolves();
    });

    it('should call ready', async () => {
      await instance.apply(tx as any, block, sender);
      expect(readyStub.calledOnce).to.be.true;
      expect(readyStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(readyStub.firstCall.args[1]).to.be.deep.equal(sender);
    });

    it('should throw if not ready', async () => {
      readyStub.returns(false);
      await expect(instance.apply(tx as any, block, sender)).to.be.rejectedWith('Transaction is not ready');
    });

    it('should call checkBalance', async () => {
      await instance.apply(tx as any, block, sender);
      expect(checkBalanceStub.calledOnce).to.be.true;
      const expectedAmount = new BigNum(tx.amount.toString()).plus(tx.fee.toString());
      expect(checkBalanceStub.firstCall.args[0]).to.be.deep.equal(expectedAmount);
      expect(checkBalanceStub.firstCall.args[1]).to.be.equal('balance');
      expect(checkBalanceStub.firstCall.args[2]).to.be.deep.equal(tx);
      expect(checkBalanceStub.firstCall.args[3]).to.be.deep.equal(sender);
    });

    it('should throw if checkBalance returns an error', async () => {
      checkBalanceStub.returns({ exceeded: true, error: 'checkBalance error' });
      await expect(instance.apply(tx as any, block, sender)).to.be.rejectedWith('checkBalance error');
    });

    it('should call logger.trace', async () => {
      await instance.apply(tx as any, block, sender);
      expect(loggerStub.stubs.trace.calledOnce).to.be.true;
    });

    it('should call accountLogic.merge', async () => {
      await instance.apply(tx as any, block, sender);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        balance: -108910891000010,
        blockId: '13191140260435645922',
        round  : 1,
      });
    });

    it('should call roundsLogic.calcRound', async () => {
      await instance.apply(tx as any, block, sender);
      expect(roundsLogicStub.stubs.calcRound.called).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(block.height);
    });

    it('should call apply from the txType', async () => {
      await instance.apply(tx as any, block, sender);
      expect(txTypeApplyStub.calledOnce).to.be.true;
      expect(txTypeApplyStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeApplyStub.firstCall.args[1]).to.be.deep.equal(block);
      expect(txTypeApplyStub.firstCall.args[2]).to.be.deep.equal(sender);
    });

    it('should rollback calling accountLogic.merge twice in case of error, then throw', async () => {
      txTypeApplyStub.rejects(new Error('applyError'));
      await expect(instance.apply(tx as any, block, sender)).to.be.rejectedWith('applyError');
      expect(accountLogicStub.stubs.merge.calledTwice).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        balance: -108910891000010,
        blockId: '13191140260435645922',
        round  : 1,
      });

      expect(accountLogicStub.stubs.merge.secondCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.secondCall.args[1]).to.be.deep.equal({
        balance: 108910891000010,
        blockId: '13191140260435645922',
        round  : 1,
      });
    });
  });

  describe('undo', () => {
    let txTypeUndoStub: SinonStub;

    beforeEach(() => {
      // dependency stubs
      roundsLogicStub.stubs.calcRound.returns(1);
      accountLogicStub.stubs.merge.resolves(sender);
      // txType stub
      txTypeUndoStub = sandbox.stub(sendTransaction, 'undo').resolves();
    });

    it('should call logger.trace', async () => {
      await instance.undo(tx as any, block, sender);
      expect(loggerStub.stubs.trace.calledOnce).to.be.true;
    });

    it('should call accountLogic.merge', async () => {
      await instance.undo(tx as any, block, sender);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        balance: 108910891000010,
        blockId: '13191140260435645922',
        round  : 1,
      });
    });

    it('should call roundsLogic.calcRound', async () => {
      await instance.undo(tx as any, block, sender);
      expect(roundsLogicStub.stubs.calcRound.called).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(block.height);
    });

    it('should call undo from the txType', async () => {
      await instance.undo(tx as any, block, sender);
      expect(txTypeUndoStub.calledOnce).to.be.true;
      expect(txTypeUndoStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeUndoStub.firstCall.args[1]).to.be.deep.equal(block);
      expect(txTypeUndoStub.firstCall.args[2]).to.be.deep.equal(sender);
    });

    it('should rollback calling accountLogic.merge in case of error, then throw', async () => {
      txTypeUndoStub.rejects(new Error('undoError'));
      await expect(instance.undo(tx as any, block, sender)).to.be.rejectedWith('undoError');
      expect(accountLogicStub.stubs.merge.calledTwice).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        balance: 108910891000010,
        blockId: '13191140260435645922',
        round  : 1,
      });

      expect(accountLogicStub.stubs.merge.secondCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.secondCall.args[1]).to.be.deep.equal({
        balance: -108910891000010,
        blockId: '13191140260435645922',
        round  : 1,
      });
    });
  });

  describe('applyUnconfirmed', () => {
    let checkBalanceStub: SinonStub;
    let txTypeApplyUnconfirmedStub: SinonStub;

    beforeEach(() => {
      // instance stubs
      checkBalanceStub = sandbox.stub(instance, 'checkBalance').returns({ exceeded: false });
      // dependency stubs
      roundsLogicStub.stubs.calcRound.returns(1);
      accountLogicStub.stubs.merge.resolves();
      // txType stub
      txTypeApplyUnconfirmedStub = sandbox.stub(sendTransaction, 'applyUnconfirmed').resolves();
    });

    it('should call checkBalance', async () => {
      await instance.applyUnconfirmed(tx as any, sender, requester);
      expect(checkBalanceStub.calledOnce).to.be.true;
      const expectedAmount = new BigNum(tx.amount.toString()).plus(tx.fee.toString());
      expect(checkBalanceStub.firstCall.args[0]).to.be.deep.equal(expectedAmount);
      expect(checkBalanceStub.firstCall.args[1]).to.be.equal('u_balance');
      expect(checkBalanceStub.firstCall.args[2]).to.be.deep.equal(tx);
      expect(checkBalanceStub.firstCall.args[3]).to.be.deep.equal(sender);
    });

    it('should throw if checkBalance returns an error', async () => {
      checkBalanceStub.returns({ exceeded: true, error: 'checkBalance error' });
      await expect(instance.applyUnconfirmed(tx as any, block, sender)).to.be.rejectedWith('checkBalance error');
    });

    it('should call accountLogic.merge', async () => {
      await instance.applyUnconfirmed(tx as any, sender, requester);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        u_balance: -108910891000010,
      });
    });

    it('should call applyUnconfirmed from the txTypes', async () => {
      await instance.applyUnconfirmed(tx as any, sender, requester);
      expect(txTypeApplyUnconfirmedStub.calledOnce).to.be.true;
      expect(txTypeApplyUnconfirmedStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeApplyUnconfirmedStub.firstCall.args[1]).to.be.deep.equal(sender);
    });

    it('should rollback calling accountLogic.merge in case of error, then throw', async () => {
      txTypeApplyUnconfirmedStub.rejects(new Error('applyUnconfirmedError'));
      await expect(instance.applyUnconfirmed(tx as any, sender, requester)).to.be.rejectedWith('applyUnconfirmedError');
      expect(accountLogicStub.stubs.merge.calledTwice).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        u_balance: -108910891000010,
      });

      expect(accountLogicStub.stubs.merge.secondCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.secondCall.args[1]).to.be.deep.equal({
        u_balance: 108910891000010,
      });
    });
  });

  describe('undoUnconfirmed', () => {
    let txTypeUndoUnconfirmedStub: SinonStub;

    beforeEach(() => {
      // dependency stubs
      roundsLogicStub.stubs.calcRound.returns(1);
      accountLogicStub.stubs.merge.resolves(sender);
      // txType stub
      txTypeUndoUnconfirmedStub = sandbox.stub(sendTransaction, 'undoUnconfirmed').resolves();
    });

    it('should call accountLogic.merge', async () => {
      await instance.undoUnconfirmed(tx as any, sender);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        u_balance: 108910891000010,
      });
    });

    it('should call undo from the txType', async () => {
      await instance.undoUnconfirmed(tx as any, sender);
      expect(txTypeUndoUnconfirmedStub.calledOnce).to.be.true;
      expect(txTypeUndoUnconfirmedStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeUndoUnconfirmedStub.firstCall.args[1]).to.be.deep.equal(sender);
    });

    it('should rollback calling accountLogic.merge in case of error, then throw', async () => {
      txTypeUndoUnconfirmedStub.rejects(new Error('undoUnconfirmedError'));
      await expect(instance.undoUnconfirmed(tx as any, sender)).to.be.rejectedWith('undoUnconfirmedError');
      expect(accountLogicStub.stubs.merge.calledTwice).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        u_balance: 108910891000010,
      });

      expect(accountLogicStub.stubs.merge.secondCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.secondCall.args[1]).to.be.deep.equal({
        u_balance: -108910891000010,
      });
    });
  });

  describe('dbSave', () => {
    let akttStub: SinonStub;
    let txTypeDbSaveStub: SinonStub;

    beforeEach(() => {
      tx.senderId      = sender.address;
      akttStub         = sandbox.stub(instance, 'assertKnownTransactionType').returns(true);
      txTypeDbSaveStub = sandbox.stub(sendTransaction, 'dbSave').returns({ table: 'table', fields: [], values: [] });
    });

    it('should call assertKnownTransactionType', () => {
      instance.dbSave(tx as any);
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should return an array', () => {
      const retVal = instance.dbSave(tx as any);
      expect(Array.isArray(retVal)).to.be.true;
    });

    it('should call dbSave from the txType', () => {
      instance.dbSave(tx as any);
      expect(txTypeDbSaveStub.calledOnce).to.be.true;
      expect(txTypeDbSaveStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should add the specific SQL from the txType', () => {
      const retVal = instance.dbSave(tx as any);
      expect(retVal[1]).to.be.deep.equal({ table: 'table', fields: [], values: [] });
    });

    it('should return the correct first object', () => {
      tx.requesterPublicKey = requester.publicKey;
      const retVal          = instance.dbSave(tx as any);
      expect(retVal[0]).to.be.deep.equal({
        table : 'trs',
        fields: [
          'id',
          'blockId',
          'type',
          'timestamp',
          'senderPublicKey',
          'requesterPublicKey',
          'senderId',
          'recipientId',
          'amount',
          'fee',
          'signature',
          'signSignature',
          'signatures',
        ],
        values: {
          id                : tx.id,
          blockId           : (tx as any).blockId,
          type              : tx.type,
          timestamp         : tx.timestamp,
          senderPublicKey   : Buffer.from(tx.senderPublicKey, 'hex'),
          requesterPublicKey: Buffer.from(tx.requesterPublicKey, 'hex'),
          senderId          : tx.senderId,
          recipientId       : tx.recipientId || null,
          amount            : tx.amount,
          fee               : tx.fee,
          signature         : Buffer.from(tx.signature, 'hex'),
          signSignature     : null,
          signatures        : tx.signatures ? tx.signatures.join(',') : null,
        },
      });
    });
  });

  describe('afterSave', () => {
    let akttStub: SinonStub;
    let txTypeAfterSaveStub: SinonStub;

    beforeEach(() => {
      tx.senderId         = sender.address;
      akttStub            = sandbox.stub(instance, 'assertKnownTransactionType').returns(true);
      txTypeAfterSaveStub = sandbox.stub(sendTransaction, 'afterSave').returns('txType aftersave');
    });

    it('should call assertKnownTransactionType', async () => {
      await instance.afterSave(tx);
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should call afterSave from the txType and return the result of execution', async () => {
      const retVal = await instance.afterSave(tx);
      expect(txTypeAfterSaveStub.calledOnce).to.be.true;
      expect(txTypeAfterSaveStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(retVal).to.be.equal('txType aftersave');
    });
  });

  describe('objectNormalize', () => {
    let akttStub: SinonStub;
    let txTypeObjectNormalizeStub: SinonStub;

    beforeEach(() => {
      tx.senderId                            = sender.address;
      akttStub                               = sandbox.stub(instance, 'assertKnownTransactionType').returns(true);
      txTypeObjectNormalizeStub              = sandbox.stub(sendTransaction, 'objectNormalize')
        .returns('txType objectNormalize');
    });

    it('should call assertKnownTransactionType', () => {
      instance.objectNormalize(tx);
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should remove nulls and undefined', () => {
      (tx as any).nullItem      = null;
      (tx as any).undefinedItem = undefined;
      txTypeObjectNormalizeStub.callsFake((transaction) => transaction);
      const retVal = instance.objectNormalize(tx);
      expect(retVal.signature).to.be.equal(tx.signature);
      expect((retVal as any).nullItem).to.be.undefined;
      expect((retVal as any).undefinedItem).to.be.undefined;
    });

    it('should call schema.validate', () => {
      instance.objectNormalize(tx);
      expect(zSchemaStub.stubs.validate.calledOnce).to.be.true;
      expect(zSchemaStub.stubs.validate.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should throw if validation fails', () => {
      zSchemaStub.enqueueResponse('getLastErrors', []);
      zSchemaStub.enqueueResponse('validate', false);
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Failed to validate transaction schema/);
    });

    it('should call objectNormalize from the txType and return the result of execution', () => {
      const retVal = instance.objectNormalize(tx);
      expect(txTypeObjectNormalizeStub.calledOnce).to.be.true;
      expect(txTypeObjectNormalizeStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(retVal).to.be.equal('txType objectNormalize');
    });
  });

  describe('dbRead', () => {
    let raw: any;
    let convertedTx;
    let akttStub: SinonStub;
    let txTypeDbReadStub: SinonStub;
    beforeEach(() => {
      akttStub         = sandbox.stub(instance, 'assertKnownTransactionType').returns(true);
      txTypeDbReadStub = sandbox.stub(sendTransaction, 'dbRead').returns({ my: 'asset' });
      raw              = {
        t_id                : tx.id,
        b_height            : 1,
        b_id                : block.id,
        t_type              : TransactionType.SEND,
        t_timestamp         : 0,
        t_senderPublicKey   : sender.publicKey,
        t_requesterPublicKey: requester.publicKey,
        t_senderId          : sender.address,
        t_recipientId       : requester.address,
        m_recipientPublicKey: requester.publicKey,
        t_amount            : tx.amount,
        t_fee               : tx.fee,
        t_signature         : tx.signature,
        t_signSignature     : '',
        t_signatures        : 'a,b',
        confirmations       : 10,
      };
      convertedTx      = {
        id                : raw.t_id,
        height            : raw.b_height,
        blockId           : raw.b_id || raw.t_blockId,
        type              : parseInt(raw.t_type, 10),
        timestamp         : parseInt(raw.t_timestamp, 10),
        senderPublicKey   : raw.t_senderPublicKey,
        requesterPublicKey: raw.t_requesterPublicKey,
        senderId          : raw.t_senderId,
        recipientId       : raw.t_recipientId,
        recipientPublicKey: raw.m_recipientPublicKey || null,
        amount            : parseInt(raw.t_amount, 10),
        fee               : parseInt(raw.t_fee, 10),
        signature         : raw.t_signature,
        signSignature     : raw.t_signSignature,
        signatures        : raw.t_signatures ? raw.t_signatures.split(',') : [],
        confirmations     : parseInt(raw.confirmations, 10),
        asset             : {},
      };
    });

    it('should return null if not t_id', () => {
      delete raw.t_id;
      const retVal = instance.dbRead(raw);
      expect(retVal).to.be.equal(null);
    });

    it('should call parseInt 5 times', () => {
      const parseIntSpy = sandbox.spy(global, 'parseInt');
      instance.dbRead(raw);
      expect(parseIntSpy.callCount).to.be.equal(5);
    });

    it('should call assertKnownTransactionType', () => {
      akttStub.throws('stop execution please');
      expect(() => {
        instance.dbRead(raw);
      }).to.throw();
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(convertedTx);
    });

    it('should call dbRead from the txType', () => {
      convertedTx.asset = { my: 'asset' };
      const retVal      = instance.dbRead(raw);
      expect(txTypeDbReadStub.calledOnce).to.be.true;
      expect(txTypeDbReadStub.firstCall.args[0]).to.be.deep.equal(raw);
      expect(retVal).to.be.deep.equal(convertedTx);
    });

    it('should add the asset to the tx', () => {
      const retVal = instance.dbRead(raw);
      expect(retVal.asset).to.be.deep.equal({ my: 'asset' });
    });
  });

  describe('restoreAsset', () => {
    it('should throw if tx is not valid type', async () => {
      await expect(instance.restoreAsset({type: 102} as any))
        .to.be.rejectedWith('Unknown transaction type 102');
    });
    it('should delegate asset restore to type implementation', async () => {
      const stub = sandbox.stub(sendTransaction, 'restoreAsset').returns('meow');
      expect(await instance.restoreAsset({type: TransactionType.SEND} as any))
        .to.be.eq('meow');

      expect(stub.calledWith({type: TransactionType.SEND})).is.true;
    });
  });
});
