import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { BigNum, IKeypair, TransactionType } from '../../../src/helpers';
import { TransactionLogic } from '../../../src/logic';
import { IBaseTransaction, SendTransaction } from '../../../src/logic/transactions';
import { AccountLogicStub, DbStub, EdStub, ExceptionsManagerStub, LoggerStub,
         RoundsLogicStub, SlotsStub, ZSchemaStub } from '../../stubs';
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
      fee            : 0,
      timestamp      : 0,
      recipientId    : '15256762582730568272R',
      senderId       : '14709573872795067383R',
      senderPublicKey: '35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892',
      signature      : 'f8fbf9b8433bf1bbea971dc8b14c6772d33c7dd285d84c5e6c984b10c4141e9f' +
                       'a56ace902b910e05e98b55898d982b3d5b9bf8bd897083a7d1ca1d5028703e03',
      id             : '8139741256612355994',
      asset          : {},
    };

    sender = {
      balance: 10000000,
      address: '1233456789012345R',
    };

    edStub.stubs.sign.returns(sampleBuffer);
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('attachAssetType', () => {
    it('should throw an error if invalid object is passed', () => {
      expect(() => {
        instance.attachAssetType({} as any);
      }).to.throw('Invalid instance interface');
    });

    it('should add the instance to the types array and return instance', () => {
      // We need a valid object to avoid the error, easy to instanciate real code.
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
      const RewBigNum        = RewireTransaction.__get__('_1').BigNum;
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
      RewireTransaction.__set__('ByteBuffer', (capacity?: number, littleEndian?: boolean, noAssert?: boolean ) => {
        if (capacity) { byteBufferStub.capacity = capacity; }
        if (littleEndian) { byteBufferStub.littleEndian = littleEndian; }
        if (noAssert) { byteBufferStub.noAssert = noAssert; }
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
      tx.requesterPublicKey = '35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51899';
      const requesterPublicKeyBuffer = Buffer.from(tx.requesterPublicKey, 'hex');
      instance.getBytes(tx);
      for (let i = 0; i < requesterPublicKeyBuffer.length; i++) {
        // We always get here after 34 writes to the ByteBuffer
        expect(byteBufferStub.sequence[34 + i]).to.be.equal(requesterPublicKeyBuffer[i]);
      }
    });

    it('should add the recipientId to the ByteBuffer if tx.recipientId', () => {
      tx.recipientId = '123123123123123R';
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
      tx.signSignature = '';
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
      const retVal = instance.ready(tx, {} as any);
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
      expect(dbStub.stubs.one.firstCall.args[1]).to.be.deep.equal({id: tx.id});
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
      const retVal = instance.checkBalance(sender.balance + 1, 'balance', tx, sender as any);
      expect(retVal.error).to.be.equal(null);
    });
  });

  describe('process', () => {
    let txTypeProcessStub;

    beforeEach(() => {
      txTypeProcessStub = sandbox.stub(sendTransaction, 'process').resolves();
    });

    it('should call assertKnownTransactionType', async () => {
      const akttStub = sandbox.stub(instance, 'assertKnownTransactionType');
      await instance.process(tx, sender, {} as any);
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx);
    });
    it('should throw if Missing sender', async () => {
      await expect(instance.process(tx, undefined, {} as any)).to.be.rejectedWith('Missing sender');
    });

    it('should throw if Invalid transaction id', async () => {
      sandbox.stub(instance, 'getId').returns('unlikelyId');
      await expect(instance.process(tx, sender, {} as any)).to.be.rejectedWith('Invalid transaction id');
    });

    it('should call getId', async () => {
      const getIdSpy = sandbox.spy(instance, 'getId');
      await instance.process(tx, sender, {} as any);
      expect(getIdSpy.calledOnce).to.be.true;
      expect(getIdSpy.firstCall.args[0]).to.be.deep.eq(tx);
    });

    it('should call process on the right txType', async () => {
      await instance.process(tx, sender, {} as any);
      expect(txTypeProcessStub.calledOnce).to.be.true;
      expect(txTypeProcessStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeProcessStub.firstCall.args[1]).to.be.deep.equal(sender);
    });

    it('should return the tx with senderId added', async () => {
      const retVal = await instance.process(tx, sender, {} as any);
      const expectedRetVal = Object.assign({}, tx);
      expectedRetVal.senderId = sender.address;
      expect(retVal).to.be.deep.equal(expectedRetVal);
    });
  });

  describe('verify', () => {
    it('should call assertKnownTransactionType');
    it('should throw if Missing sender');
    it('should throw if sender second signature and no signSignature in tx');
    it('should throw if second signature provided and sender has none enabled');
    it('should throw if missing requester second signature');
    it('should throw if second signature provided, and requester has none enabled');
    it('should throw if sender publicKey mismatches');
    it('should throw if sender is not genesis account unless block id equals genesis');
    it('should throw if senderId mismatch');
    it('should throw if invalid member in keysgroup');
    it('should throw if account does not belong to multisignature group');
    it('should throw if signatures are not unique');
    it('should call verifySignature if tx.signatures not empty');
    it('should throw if failed to verify multisignature');
    it('should throw if fee mismatch');
    it('should throw if amount is > totalAmout');
    it('should throw if amount is decimal');
    it('should throw if amount is written in exponential notation');
    it('should call checkBalance');
    it('should throw if checkBalance returns an error');
    it('should call slots.getSlotNumber');
    it('should throw if slotNumber mismatches');
    it('should await verify from the txType');
    it('should call assertNonConfirmed');
  });

  describe('verifySignature', () => {
    it('should call assertKnownTransactionType');
    it('should call ed.verify');
    it('should call getHash');
  });

  describe('apply', () => {
    it('should call ready');
    it('should call throw if not ready');
    it('should call checkBalance');
    it('should throw if checkBalance returns an error');
    it('should call logger.trace');
    it('should call accountLogic.merge');
    it('should call roundsLogic.calcRound');
    it('should call accountLogic.merge');
    it('should call apply from the txType');
    it('should rollback calling accountLogic.merge in case of error');
    it('should throw if it had to rollback');
  });

  describe('undo', () => {
    it('should call logger.trace');
    it('should call accountLogic.merge');
    it('should call roundsLogic.calcRound');
    it('should call undo from the txType');
    it('should rollback calling accountLogic.merge in case of error');
    it('should throw if it had to rollback');
  });

  describe('applyUnconfirmed', () => {
    it('should call checkBalance');
    it('should throw if checkBalance returns an error');
    it('should call accountLogic.merge');
    it('should call applyUnconfirmed from the txTypes');
    it('should rollback calling accountLogic.merge in case of error');
    it('should throw if it had to rollback');
  });

  describe('undoUnconfirmed', () => {
    it('should call accountLogic.merge');
    it('should call undoUnconfirmed from the txTypes');
    it('should rollback calling accountLogic.merge in case of error');
    it('should throw if it had to rollback');
  });

  describe('dbSave', () => {
    it('should call assertKnownTransactionType');
    it('should return an array');
    it('should call undoUnconfirmed from the dbSave');
    it('should add the specific SQL from the txType');
    it('should return the correct objects');
  });

  describe('afterSave', () => {
    it('should call assertKnownTransactionType');
    it('should call afterSave from the txType and return the result of execution');
  });

  describe('objectNormalize', () => {
    it('should remove nulls and undefined');
    it('should call schema.validate');
    it('should throw if validation fails');
    it('should call objectNormalize from the txType and return the result of execution');
  });

  describe('dbRead', () => {
    it('should return null if not t_id');
    it('should call parseInt 5 times');
    it('should call dbRead from the txType');
    it('should add the asset to the tx');
  });

});
