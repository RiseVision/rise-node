import * as ByteBuffer from 'bytebuffer';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as crypto from 'crypto';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BigNum, IKeypair, TransactionType } from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { SignedAndChainedBlockType, TransactionLogic, AccountLogic } from '../../../src/logic';
import { IConfirmedTransaction, SendTransaction, VoteTransaction, RegisterDelegateTransaction,
  SecondSignatureTransaction } from '../../../src/logic/transactions';
import {
  AccountLogicStub,
  EdStub,
  ExceptionsManagerStub,
  LoggerStub,
  RoundsLogicStub,
  SlotsStub,
  ZSchemaStub
} from '../../stubs';
import { createContainer } from '../../utils/containerCreator';
import { TransactionsModel } from '../../../src/models';
import { VerificationType } from '../../../src/ioc/interfaces/logic';
import { DBBulkCreateOp } from '../../../src/types/genericTypes';
import { createRandomTransactions, toBufferedTransaction } from '../../utils/txCrafter';
import { z_schema } from '../../../src/helpers/z_schema';
import {createRandomWallet} from '../../integration/common/utils';

chai.use(chaiAsPromised);

// tslint:disable-next-line no-var-requires
const expect           = chai.expect;

// tslint:disable no-unused-expression
describe('logic/transaction', () => {
  let instance: TransactionLogic;
  let container: Container;
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
  let genesisBlock: SignedAndChainedBlockType;
  let txModel: typeof TransactionsModel;

  let tx: IConfirmedTransaction<any>;
  const sampleBuffer = Buffer.from('35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892', 'hex');

  const publicKeyHex      = '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3';
  const privateKeyHex     = 'cd25f48e0bf2c9ac3c9fe67f22fea54bb108f694bb69eb10520c48b228635df0' +
    '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3';
  const keyPair: IKeypair = {
    privateKey: Buffer.from(privateKeyHex, 'hex'),
    publicKey : Buffer.from(publicKeyHex, 'hex'),
  };

  beforeEach(() => {
    container          = createContainer();
    container.rebind(Symbols.logic.transaction).to(TransactionLogic).inSingletonScope();
    instance = container.get(Symbols.logic.transaction);
    edStub           = container.get(Symbols.helpers.ed);
    slotsStub        = container.get(Symbols.helpers.slots);
    zSchemaStub      = container.get(Symbols.generic.zschema);
    accountLogicStub = container.get(Symbols.logic.account);
    roundsLogicStub  = container.get(Symbols.logic.rounds);
    loggerStub       = container.get(Symbols.helpers.logger);
    genesisBlock     = container.get(Symbols.generic.genesisBlock);
    excManagerStub   = container.get(Symbols.helpers.exceptionsManager);
    txModel = container.get(Symbols.models.transactions);
    sendTransaction  = new SendTransaction();

    instance.attachAssetType(sendTransaction);


    tx = {
      amount         : 108910891000000,
      asset          : {},
      fee            : 10,
      id             : '8139741256612355994',
      recipientId    : '15256762582730568272R',
      senderId       : '1233456789012345R',
      senderPublicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
      signature      : Buffer.from('f8fbf9b8433bf1bbea971dc8b14c6772d33c7dd285d84c5e6c984b10c4141e9f' +
      'a56ace902b910e05e98b55898d982b3d5b9bf8bd897083a7d1ca1d5028703e03', 'hex'),
      timestamp      : 0,
      height         : 10,
      blockId        : '11',
      type           : TransactionType.SEND,
    };

    sender = {
      address  : '1233456789012345R',
      balance  : 10000000,
      publicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex')
    };

    requester = {
      address  : '9999999999999999R',
      balance  : 20000000,
      publicKey: Buffer.from('e73f4ab9f4794b110ceefecd8f880d5189235526f8a1e2f482264e5d4982fc07', 'hex'),
    };

    block = {
      blockSignature      : Buffer.from('a9e12f49432364c1e171dd1f9e2d34f8baffdda0f4ef0989d9439e5d46aba55ef640' +
      '149ff7ed7d3e3d4e1ad4173ecfd1cc0384f5598175c15434e0d97ce4150d', 'hex'),
      generatorPublicKey  : Buffer.from('35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51892', 'hex'),
      height              : 1,
      id                  : '13191140260435645922',
      numberOfTransactions: 0,
      payloadHash         : Buffer.from('cd8171332c012514864edd8eb6f68fc3ea6cb2afbaf21c56e12751022684cea5', 'hex'),
      payloadLength       : 0,
      previousBlock       : null,
      timestamp           : 0,
      totalAmount         : 10999999991000000,
      totalFee            : 0,
      transactions        : [],
      version             : 0,
    };

    edStub.stubs.sign.returns(sampleBuffer);
    sandbox = sinon.createSandbox();
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
      const fromBufferSpy = sandbox.spy(BigNum, 'fromBuffer');
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
    let sequence: any[];
    let lastBB: any;
    const toRestore = {} as any;
    before(() => {
      toRestore.writeByte = ByteBuffer.prototype.writeByte;
      toRestore.writeInt  = ByteBuffer.prototype.writeInt;
      toRestore.writeUint32  = ByteBuffer.prototype.writeUint32;
      toRestore.writeLong = (ByteBuffer.prototype as any).writeLong;
      toRestore.flip      = ByteBuffer.prototype.flip;
    });
    beforeEach(() => {
      sequence                                = [];
      (ByteBuffer.prototype as any).writeByte = function(b) {
        sequence.push(b);
        lastBB = this;
      };
      (ByteBuffer.prototype as any).writeInt  = (b) => sequence.push(b);
      (ByteBuffer.prototype as any).writeUint32  = (b) => sequence.push(b);
      (ByteBuffer.prototype as any).writeLong = (b) => sequence.push(b);
      ByteBuffer.prototype.flip               = sandbox.stub();
    });

    after(() => {
      (ByteBuffer.prototype as any).writeByte = toRestore.writeByte;
      (ByteBuffer.prototype as any).writeInt  = toRestore.writeInt;
      (ByteBuffer.prototype as any).writeUint32  = toRestore.writeUint32;
      (ByteBuffer.prototype as any).writeLong = toRestore.writeLong;
      ByteBuffer.prototype.flip               = toRestore.flip;
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
      expect(lastBB.capacity()).to.be.equal(213);
    });

    it('should add the type as first byte of the ByteBuffer', () => {
      instance.getBytes(tx, true, false);
      expect(sequence[0]).to.be.equal(tx.type);
    });

    it('should add the timestamp to the ByteBuffer via writeInt', () => {
      tx.timestamp = Date.now();
      instance.getBytes(tx, true, false);
      expect(sequence[1]).to.be.equal(tx.timestamp);
    });

    it('should add the senderPublicKey to the ByteBuffer', () => {
      const senderPublicKeyBuffer = tx.senderPublicKey;
      instance.getBytes(tx);
      for (let i = 0; i < senderPublicKeyBuffer.length; i++) {
        expect(sequence[2 + i]).to.be.equal(senderPublicKeyBuffer[i]);
      }
    });

    it('should add the requesterPublicKey to the ByteBuffer if tx.requesterPublicKey', () => {
      tx.requesterPublicKey          = Buffer.from('35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51899', 'hex');
      instance.getBytes(tx);
      for (let i = 0; i < tx.requesterPublicKey.length; i++) {
        // We always get here after 34 writes to the ByteBuffer
        expect(sequence[34 + i]).to.be.equal(tx.requesterPublicKey[i]);
      }
    });

    it('should add the recipientId to the ByteBuffer if tx.recipientId', () => {
      tx.recipientId  = '123123123123123R';
      const recipient = tx.recipientId.slice(0, -1);
      const recBuf    = new BigNum(recipient).toBuffer({ size: 8 });
      instance.getBytes(tx);
      for (let i = 0; i < recBuf.length; i++) {
        expect(sequence[34 + i]).to.be.equal(recBuf[i]);
      }
    });

    it('should add 8 zeroes to the ByteBuffer if NOT tx.recipientId', () => {
      tx.recipientId = undefined;
      instance.getBytes(tx);
      for (let i = 34; i < 42; i++) {
        expect(sequence[i]).to.be.equal(0);
      }
    });

    it('should add the amount to the ByteBuffer via writeLong', () => {
      instance.getBytes(tx);
      expect(sequence[42]).to.be.equal(tx.amount);
    });

    it('should add the asset bytes to the ByteBuffer if not empty', () => {
      tx.signSignature   = Buffer.from('');
      const getBytesStub = sinon.stub(sendTransaction, 'getBytes');
      getBytesStub.returns(sampleBuffer);
      instance.getBytes(tx);
      for (let i = 0; i < sampleBuffer.length; i++) {
        expect(sequence[43 + i]).to.be.equal(sampleBuffer[i]);
      }
      getBytesStub.restore();
    });

    it('should add the signature to the ByteBuffer', () => {
      instance.getBytes(tx);
      for (let i = 0; i < tx.signature.length; i++) {
        // tx.asset is empty so we start from 43
        expect(sequence[43 + i]).to.be.equal(tx.signature[i]);
      }
    });

    it('should NOT add the signature to the ByteBuffer if skipSignature', () => {
      instance.getBytes(tx, true, true);
      for (let i = 0; i < tx.signature.length; i++) {
        // tx.asset is empty so we start from 43
        expect(sequence[43 + i]).to.be.equal(undefined);
      }
    });

    it('should add the signSignature to the ByteBuffer', () => {
      tx.signSignature = Buffer.from('93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9' +
        '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9', 'hex');
      instance.getBytes(tx);

      for (let i = 0; i < tx.signSignature.length; i++) {
        // tx.asset is empty so we start from 43
        expect(sequence[107 + i]).to.be.equal(tx.signSignature[i]);
      }
    });

    it('should NOT add the signSignature to the ByteBuffer if skipSecondSignature', () => {
      tx.signSignature = Buffer.from('93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9' +
        '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9', 'hex');
      instance.getBytes(tx, false, true);

      for (let i = 0; i < tx.signSignature.length; i++) {
        // tx.asset is empty so we start from 43
        expect(sequence[107 + i]).to.be.equal(undefined);
      }
    });

    it('should flip the ByteBuffer', () => {
      instance.getBytes(tx, true, true);
      expect(lastBB.flip.calledOnce).to.be.true;
    });

    it('should return a Buffer', () => {
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
        instance.assertKnownTransactionType(tx.type);
      }).to.throw(/Unknown transaction type/);
    });

    it('should not throw if OK', () => {
      expect(() => {
        instance.assertKnownTransactionType(tx.type);
      }).not.to.throw();
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
  });

  describe('verify', () => {
    let verifySignatureStub: SinonStub;
    let checkBalanceStub: SinonStub;
    let calculateFeeStub: SinonStub;
    let txTypeVerifyStub: SinonStub;
    let instGetIdStub;


    beforeEach(() => {
      (tx as any).blockId    = '12345ab';
      // instance stubs
      verifySignatureStub    = sandbox.stub(instance, 'verifySignature').returns(true);
      checkBalanceStub       = sandbox.stub(instance, 'checkBalance').returns({ exceeded: false });
      // txType stubs
      calculateFeeStub       = sandbox.stub(sendTransaction, 'calculateFee').returns(tx.fee);
      txTypeVerifyStub       = sandbox.stub(sendTransaction, 'verify').resolves();
      sender.isMultisignature = () => false;
      instGetIdStub     = sandbox.stub(instance, 'getId').returns(tx.id);
      accountLogicStub.stubs.assertValidAddress.returns(null);
    });

    it('should throw if the tx.id is wrong', async () => {
      instGetIdStub.returns('10');
      await expect(instance.verify(tx, sender, {} as any, null))
        .to.be.rejectedWith('Invalid transaction id');
    });

    it('should call assertKnownTransactionType', async () => {
      // we want it to throw immediately
      tx.type        = 99999;
      const akttStub = sandbox.stub(instance, 'assertKnownTransactionType').throws('stop');
      try {
        await instance.verify(tx, sender, requester, 1);
      } catch (e) {
        expect(akttStub.calledOnce).to.be.true;
      }
    });

    it('should throw if Missing sender', async () => {
      await expect(instance.verify(tx, undefined, requester, 1)).to.be.rejectedWith('Missing sender');
    });

    it('should throw if sender second signature + multisig and no signSignature in tx', async () => {
      tx.requesterPublicKey  = requester.publicKey;
      sender.multisignatures = [];
      sender.isMultisignature = () => true;
      sender.secondSignature = 'signature';
      delete tx.signSignature;
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Missing sender second signature');
    });

    it('should throw if second signature provided and sender has none enabled', async () => {
      delete tx.requesterPublicKey;
      delete sender.secondSignature;
      tx.signSignature = Buffer.from('signSignature');
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Sender does not have a second signature');
    });

    it('should throw if missing requester second signature', async () => {
      tx.requesterPublicKey     = requester.publicKey;
      sender.isMultisignature = () => true;
      requester.secondSignature = Buffer.from('secondSignature');
      sender.multisignatures = [];
      delete tx.signSignature;
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Missing requester second signature');
    });

    it('should throw if second signature provided, and requester has none enabled', async () => {
      tx.requesterPublicKey = requester.publicKey;
      delete requester.secondSignature;
      sender.multisignatures = [];
      sender.isMultisignature = () => true;
      tx.signSignature = Buffer.from('signSignature');
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Requester does not have a second signature');
    });

    it('should throw if sender publicKey and tx.senderPublicKey mismatches', async () => {
      tx.senderPublicKey = Buffer.from('anotherPublicKey');
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
      tx.signatures = ['aa', 'bb'];
      tx.asset.multisignature = {
        keysgroup: [
          '+cc',
          '+dd',
        ],
      };
      sender.isMultisignature = () => true;
      verifySignatureStub.returns(true);
      verifySignatureStub.onCall(2).returns(false);

      await instance.verify(tx, sender, requester, 1);

      expect(verifySignatureStub.callCount).to.equal(4);
      expect(verifySignatureStub.args[0][0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.args[0][1]).to.be.deep.equal(sender.publicKey);
      expect(verifySignatureStub.args[0][2]).to.be.equal(tx.signature);

      expect(verifySignatureStub.args[1][0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.args[1][1]).to.be.deep.equal(Buffer.from('cc', 'hex'));
      expect(verifySignatureStub.args[1][2]).to.be.deep.equal(Buffer.from('aa', 'hex'));
      expect(verifySignatureStub.args[1][3]).to.be.deep.equal(VerificationType.ALL);

      expect(verifySignatureStub.args[3][0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.args[3][1]).to.be.deep.equal(Buffer.from('dd', 'hex'));
      expect(verifySignatureStub.args[3][2]).to.be.deep.equal(Buffer.from('bb', 'hex'));
      expect(verifySignatureStub.args[3][3]).to.be.deep.equal(VerificationType.ALL);
    });

    it('should throw if account does not belong to multisignature group', async () => {
      tx.requesterPublicKey  = Buffer.from('bb', 'hex');
      // Initializing this as an empty string is the only way to test this behavior
      sender.multisignatures = ['aa'];
      sender.isMultisignature = () => true;
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Account does not belong to multisignature group');
    });

    it('should call verifySignature', async () => {
      tx.requesterPublicKey  = requester.publicKey;
      sender.multisignatures = [tx.requesterPublicKey.toString('hex')];
      sender.isMultisignature = () => true;
      verifySignatureStub.returns(false);
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Failed to verify signature');
      expect(verifySignatureStub.calledOnce).to.be.true;
      expect(verifySignatureStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.firstCall.args[1]).to.be.deep.equal(tx.requesterPublicKey);
      expect(verifySignatureStub.firstCall.args[2]).to.be.equal(tx.signature);
      expect(verifySignatureStub.firstCall.args[3]).to.be.equal(VerificationType.SIGNATURE);
    });

    it('should call verifySignature with secondPublicKey if sender.secondSignature', async () => {
      sender.secondSignature    = 'aaaaaaa';
      sender.secondPublicKey    = 'secondPublicKey';
      requester.secondSignature = 'bbbbbbb';
      tx.signSignature          = sender.secondSignature;
      // tx.requesterPublicKey     = requester.publicKey;
      sender.multisignatures    = [];
      verifySignatureStub.onCall(0).returns(true);
      verifySignatureStub.onCall(1).returns(false);
      await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Failed to verify second signature');
      expect(verifySignatureStub.calledTwice).to.be.true;
      expect(verifySignatureStub.secondCall.args[0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.secondCall.args[1]).to.be.equal(sender.secondPublicKey);
      expect(verifySignatureStub.secondCall.args[2]).to.be.equal(tx.signSignature);
      expect(verifySignatureStub.secondCall.args[3]).to.be.equal(VerificationType.SECOND_SIGNATURE);
    });

    it('should throw if signatures are not unique', async () => {
      tx.signatures = ['a', 'a', 'b'];
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Encountered duplicate signature in transaction');
    });

    it('should throw if failed to verify multisignature', async () => {
      tx.signatures = ['a', 'b'];
      // First call is simple validation with requester or sender public key
      verifySignatureStub.onCall(0).returns(true);
      // Second call is inside tx.signatures loop
      verifySignatureStub.onCall(1).returns(false);
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Failed to verify multisignature');
    });

    it('should throw Failed to verify multisignature if verifySignature() is fails', async () => {
      sender.multisignatures  = ['aa'];
      sender.isMultisignature = () => true;
      tx.signatures = ['a', 'b'];
      tx.requesterPublicKey          = Buffer.from('aa', 'hex');
      tx.asset.multisignature = {
        keysgroup: [
          '+yz',
          '+ef',
        ],
      };
      verifySignatureStub.returns(false);
      verifySignatureStub.onCall(0).returns(true);
      verifySignatureStub.onCall(2).returns(true);
      await expect(instance.verify(tx, sender, requester, 1))
        .to.be.rejectedWith('Failed to verify multisignature');
    });

    it('should call verifySignature if tx.signatures not empty', async () => {
      tx.signatures          = ['aa', 'bb'];
      sender.multisignatures = ['cc', 'dd'];
      sender.isMultisignature = () => true;
      // First call is simple validation with requester or sender publio key
      verifySignatureStub.onCall(0).returns(true);
      // Second call is inside tx.signatures loop
      verifySignatureStub.onCall(1).returns(false);
      await instance.verify(tx, sender, requester, 1);
      expect(verifySignatureStub.secondCall.args[0]).to.be.deep.equal(tx);
      expect(verifySignatureStub.secondCall.args[1]).to.be.deep.equal(Buffer.from(sender.multisignatures[0], 'hex'));
      expect(verifySignatureStub.secondCall.args[2]).to.be.deep.equal(Buffer.from(tx.signatures[0], 'hex'));
      expect(verifySignatureStub.secondCall.args[3]).to.be.equal(VerificationType.ALL);
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

    it('should reject tx if verifySignature throws (for whatever reason', async () => {
      verifySignatureStub.throws(new Error('whatever'));

      await expect(instance.verify(tx, sender, null, 1))
        .to.rejectedWith('whatever');
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

    it('should reject tx if requesetPublicKey and account is not multisign', async () => {
      sender.multisignatures  = null;
      tx.signatures = ['a', 'b'];
      tx.requesterPublicKey          = Buffer.from('aa', 'hex');
      tx.asset.multisignature = {
        keysgroup: [
          '+aa',
          '+ef',
        ],
      };
      verifySignatureStub.returns(true);

      await expect(instance.verify(tx, sender, requester, 1))
        .to.rejectedWith('Account or requester account is not multisignature');
    });
    it('should reject tx if requesterPublicKey, account is multisign but requester is null', async () => {
      sender.multisignatures  = ['a'];
      tx.signatures = ['a', 'b'];
      tx.requesterPublicKey          = Buffer.from('aa', 'hex');
      tx.asset.multisignature = {
        keysgroup: [
          '+aa',
          '+ef',
        ],
      };
      verifySignatureStub.returns(true);

      await expect(instance.verify(tx, sender, null /*requester*/, 1))
        .to.rejectedWith('Account or requester account is not multisignature');
    });

    describe('wrong recipient', () => {
      it('should throw if accountLogic.assertValidAddress fails', async () => {
        accountLogicStub.stubs.assertValidAddress.throws(new Error('AL Error'));
        await expect(instance.verify(tx, sender, requester, 1)).rejectedWith('AL Error');
      });
      it('should not throw if accountLogic.assertValidAddresses does not fail', async () => {
        accountLogicStub.stubs.assertValidAddress.returns(null);
        await expect(instance.verify(tx, sender, requester, 1)).fulfilled;
      });
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
      instance.verifySignature(tx, tx.senderPublicKey, tx.signature, VerificationType.ALL);
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx.type);
    });

    it('should call ed.verify', () => {
      instance.verifySignature(tx, tx.senderPublicKey, tx.signature, VerificationType.ALL);
      expect(edStub.stubs.verify.calledOnce).to.be.true;
      expect(edStub.stubs.verify.firstCall.args[0]).to.be.deep.equal(theHash);
      expect(edStub.stubs.verify.firstCall.args[1]).to.be.deep.equal(tx.signature);
      expect(edStub.stubs.verify.firstCall.args[2]).to.be.deep.equal(tx.senderPublicKey);
    });
    describe('verificationType', () => {
      it ('should call getHash with false, false when VerificationType is ALL', () => {
        instance.verifySignature(tx, tx.senderPublicKey, tx.signature, VerificationType.ALL);
        expect(getHashStub.calledOnce).to.be.true;
        expect(getHashStub.firstCall.args[0]).to.be.deep.equal(tx);
        expect(getHashStub.firstCall.args[1]).to.be.equal(false);
        expect(getHashStub.firstCall.args[2]).to.be.equal(false);
      });
      it ('should call getHash with false, true when VerificationType is SECOND_SIGNATURE', () => {
        instance.verifySignature(tx, tx.senderPublicKey, tx.signature, VerificationType.SECOND_SIGNATURE);
        expect(getHashStub.calledOnce).to.be.true;
        expect(getHashStub.firstCall.args[0]).to.be.deep.equal(tx);
        expect(getHashStub.firstCall.args[1]).to.be.equal(false);
        expect(getHashStub.firstCall.args[2]).to.be.equal(true);
      });
      it ('should call getHash with true, true when VerificationType is SIGNATURE', () => {
        instance.verifySignature(tx, tx.senderPublicKey, tx.signature, VerificationType.SIGNATURE);
        expect(getHashStub.calledOnce).to.be.true;
        expect(getHashStub.firstCall.args[0]).to.be.deep.equal(tx);
        expect(getHashStub.firstCall.args[1]).to.be.equal(true);
        expect(getHashStub.firstCall.args[2]).to.be.equal(true);
      });
    });
    it('should call false if signature is null', () => {
      expect(instance.verifySignature(tx, tx.senderPublicKey, null, VerificationType.ALL)).to.be.false;
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
      accountLogicStub.stubs.merge.returns([{op1: 'op'}]);
      // txType stub
      txTypeApplyStub = sandbox.stub(sendTransaction, 'apply').resolves([]);
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

  });

  describe('undo', () => {
    let txTypeUndoStub: SinonStub;

    beforeEach(() => {
      // dependency stubs
      roundsLogicStub.stubs.calcRound.returns(1);
      accountLogicStub.stubs.merge.returns([]);
      // txType stub
      txTypeUndoStub = sandbox.stub(sendTransaction, 'undo').resolves([]);
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

  });

  describe('applyUnconfirmed', () => {
    let checkBalanceStub: SinonStub;
    let txTypeApplyUnconfirmedStub: SinonStub;

    beforeEach(() => {
      // instance stubs
      checkBalanceStub = sandbox.stub(instance, 'checkBalance').returns({ exceeded: false });
      // dependency stubs
      roundsLogicStub.stubs.calcRound.returns(1);
      accountLogicStub.stubs.merge.returns([]);
      // txType stub
      txTypeApplyUnconfirmedStub = sandbox.stub(sendTransaction, 'applyUnconfirmed').resolves([]);
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

  });

  describe('undoUnconfirmed', () => {
    let txTypeUndoUnconfirmedStub: SinonStub;

    beforeEach(() => {
      // dependency stubs
      roundsLogicStub.stubs.calcRound.returns(1);
      accountLogicStub.stubs.merge.returns([]);
      // txType stub
      txTypeUndoUnconfirmedStub = sandbox.stub(sendTransaction, 'undoUnconfirmed').resolves([]);
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
      instance.dbSave([tx as any], '1', 2);
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx.type);
    });

    it('should return an array', () => {
      const retVal = instance.dbSave([tx as any], '1', 2);
      expect(Array.isArray(retVal)).to.be.true;
    });

    it('should call dbSave from the txType', () => {
      instance.dbSave([tx as any], '1', 2);
      expect(txTypeDbSaveStub.calledOnce).to.be.true;
      expect(txTypeDbSaveStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should add the specific SQL from the txType', () => {
      const retVal = instance.dbSave([tx as any], '1', 2);
      expect(retVal[1]).to.be.deep.equal({ table: 'table', fields: [], values: [] });
    });

    it('should return the correct first object', () => {
      tx.requesterPublicKey = requester.publicKey;
      const retVal          = instance.dbSave([tx], '11', 100);
      expect(retVal[0].model).to.be.deep.eq(txModel);
      expect(retVal[0].type).to.be.deep.eq('bulkCreate');
      expect((retVal[0] as DBBulkCreateOp<any>).values[0]).to.be.deep.eq({
        amount            : tx.amount,
        blockId           : '11',
        fee               : tx.fee,
        height            : 100,
        id                : tx.id,
        recipientId       : tx.recipientId || null,
        requesterPublicKey: tx.requesterPublicKey,
        senderId          : tx.senderId,
        senderPublicKey   : tx.senderPublicKey,
        signSignature     : null,
        signature         : tx.signature,
        signatures        : tx.signatures ? tx.signatures.join(',') : null,
        timestamp         : tx.timestamp,
        type              : tx.type,
      });
    });

    it('should cluster multiple txs together in single bulkCreate and append sub assets db ops', () => {
      instance.attachAssetType(new VoteTransaction());
      const txs    = createRandomTransactions({ send: 2, vote: 3 })
        .map((t) => toBufferedTransaction(t))
        .map((t) => ({ ...t, senderId: t.recipientId }));
      const retVal = instance.dbSave(txs, '11', 100);
      expect(retVal[0].model).to.be.deep.eq(txModel);
      expect(retVal[0].type).to.be.deep.eq('bulkCreate');
      const op: DBBulkCreateOp<any> = retVal[0] as any;
      expect(op.values).to.be.an('array');
      for (let i = 0; i < txs.length; i++) {
        const expectedValue = {
          ... txs[i],
          blockId: '11',
          height : 100,
          signatures: null,
        };
        delete expectedValue.asset;
        expect(op.values[i]).deep.eq(expectedValue);
      }

      expect(retVal.length).gt(1);
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
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx.type);
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
      tx.senderId               = sender.address;
      akttStub                  = sandbox.stub(instance, 'assertKnownTransactionType').returns(true);
      txTypeObjectNormalizeStub = sandbox.stub(sendTransaction, 'objectNormalize')
        .returns('txType objectNormalize');
    });

    it('should call assertKnownTransactionType', () => {
      instance.objectNormalize({ ... tx, blockId: '10'} as any);
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx.type);
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

    describe('with real schema validation', () => {
      beforeEach(() => {
        container.rebind(Symbols.logic.transaction).to(TransactionLogic).inSingletonScope();

        container.rebind(Symbols.generic.zschema).toConstantValue(new z_schema({}));
        instance = container.get(Symbols.logic.transaction);
        akttStub                  = sandbox.stub(instance, 'assertKnownTransactionType').returns(true);
        instance.attachAssetType(sendTransaction);
      });
      it('valid', () => {
        instance.objectNormalize(tx);
      });

      ['signature', 'signSignature'].forEach((sig) => {
        it(`should validate ${sig}`, () => {
          // wrong length or buf string
          tx[sig] = Buffer.alloc(32);
          expect(() => instance.objectNormalize(tx)).to.throw('format signatureBuf');
          tx[sig] = Buffer.alloc(32).toString('hex') as any;
          expect(() => instance.objectNormalize(tx)).to.throw('format signatureBuf');
          tx[sig] = 'hey' as any;
          expect(() => instance.objectNormalize(tx)).to.throw('format signatureBuf');

          // valid as string
          tx[sig] = Buffer.alloc(64).toString('hex') as any;
          instance.objectNormalize(tx);
        });
      });
      it('signature field is mandatory', () => {
        delete tx.signature;
        expect(() => instance.objectNormalize(tx)).to.throw();
        tx.signature = null;
        expect(() => instance.objectNormalize(tx)).to.throw();
      });

      ['senderPublicKey', 'requesterPublicKey'].forEach((pk) => {
        it('should validate '+pk, () => {
          // wrong length or buf string
          tx[pk] = Buffer.alloc(31);
          expect(() => instance.objectNormalize(tx)).to.throw('format publicKeyBuf');
          tx[pk] = Buffer.alloc(31).toString('hex') as any;
          expect(() => instance.objectNormalize(tx)).to.throw('format publicKeyBuf');
          tx[pk] = 'hey' as any;
          expect(() => instance.objectNormalize(tx)).to.throw('format publicKeyBuf');

          // valid as string
          tx[pk] = Buffer.alloc(32).toString('hex') as any;
          instance.objectNormalize(tx);
        });
      });
      it('senderPublicKey is mandatory', () => {
        delete tx.senderPublicKey;
        expect(() => instance.objectNormalize(tx)).to.throw();
        tx.senderPublicKey = null;
        expect(() => instance.objectNormalize(tx)).to.throw();
      });
      it('should validate timestamp', () => {
        delete tx.timestamp;
        expect(() => instance.objectNormalize(tx)).to.throw();
        tx.timestamp = null;
        expect(() => instance.objectNormalize(tx)).to.throw();
        tx.timestamp = -1;
        expect(() => instance.objectNormalize(tx)).to.throw('Value -1 is less than minimum');
      });
      ['senderId', 'recipientId'].forEach((add) => {
        it(`should validate address field ${add}`, () => {
          tx[add] = 'asd';
          expect(() => instance.objectNormalize(tx)).to.throw('format address');
          tx[add] = '';
          expect(() => instance.objectNormalize(tx)).to.throw('format address');
          tx[add] = Array(21).fill('1').join('') + 'R';
          expect(() => instance.objectNormalize(tx)).to.throw('format address');
          tx[add] = Array(20).fill('1').join('') + 'R';
          expect(() => instance.objectNormalize(tx)).to.not.throw;
        });
      });
      it('should not allow missing senderId', () => {
        tx.senderId = null;
        expect(() => instance.objectNormalize(tx)).to.throw('Missing required property: senderId');

        delete tx.senderId;
        expect(() => instance.objectNormalize(tx)).to.throw('Missing required property: senderId');
      });

      ['fee', 'amount'].forEach((field) => {
        it(`should validate ${field}`, () => {
          delete tx[field];
          expect(() => instance.objectNormalize(tx)).to.throw();
          tx[field] = null;
          expect(() => instance.objectNormalize(tx)).to.throw();
          tx[field] = -1;
          expect(() => instance.objectNormalize(tx)).to.throw('Value -1 is less than minimum');
          tx[field] = 10999999991000000 + 10000;
          expect(() => instance.objectNormalize(tx)).to.throw('is greater than maximum');
        });
      });
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
        b_height            : 1,
        b_id                : block.id,
        confirmations       : 10,
        m_recipientPublicKey: requester.publicKey,
        t_amount            : tx.amount,
        t_fee               : tx.fee,
        t_id                : tx.id,
        t_recipientId       : requester.address,
        t_requesterPublicKey: requester.publicKey,
        t_senderId          : sender.address,
        t_senderPublicKey   : sender.publicKey,
        t_signSignature     : '',
        t_signature         : tx.signature,
        t_signatures        : 'a,b',
        t_timestamp         : 0,
        t_type              : TransactionType.SEND,
      };
      convertedTx      = {
        amount            : parseInt(raw.t_amount, 10),
        asset             : {},
        blockId           : raw.b_id || raw.t_blockId,
        confirmations     : parseInt(raw.confirmations, 10),
        fee               : parseInt(raw.t_fee, 10),
        height            : raw.b_height,
        id                : raw.t_id,
        recipientId       : raw.t_recipientId,
        recipientPublicKey: raw.m_recipientPublicKey || null,
        requesterPublicKey: raw.t_requesterPublicKey,
        senderId          : raw.t_senderId,
        senderPublicKey   : raw.t_senderPublicKey,
        signSignature     : raw.t_signSignature,
        signature         : raw.t_signature,
        signatures        : raw.t_signatures ? raw.t_signatures.split(',') : [],
        timestamp         : parseInt(raw.t_timestamp, 10),
        type              : parseInt(raw.t_type, 10),
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
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(convertedTx.type);
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

  describe('fromBytes', () => {
    beforeEach(() => {
      container.rebind(Symbols.logic.account).to(AccountLogic).inSingletonScope();
      container.rebind(Symbols.logic.transaction).to(TransactionLogic).inSingletonScope();
      instance = container.get(Symbols.logic.transaction);
      instance.attachAssetType(sendTransaction);
      instance.attachAssetType(new VoteTransaction());
      instance.attachAssetType(new RegisterDelegateTransaction());
      instance.attachAssetType(new SecondSignatureTransaction());
    });
    it('should return the original send transaction', () => {
      const [t] = createRandomTransactions({send: 1});
      const b = instance.getBytes(toBufferedTransaction(t));
      const expected = {... toBufferedTransaction(t), relays: 0, asset: null};

      delete expected.signSignature;
      expect(instance.fromBytes({
        bytes: b,
        hasRequesterPublicKey: false,
        hasSignSignature: false,
        fee: t.fee,
        relays: 0,
      })).deep.eq(expected);
    });
    it('should return the original send transaction with signsignature', () => {
      const [t] = createRandomTransactions({send: 1});
      t.signSignature = t.signature.split('').reverse().join('');
      t.id = instance.getId(toBufferedTransaction(t));
      const b = instance.getBytes(toBufferedTransaction(t));
      const expected = {... toBufferedTransaction(t), relays: 0, asset: null};

      expect(instance.fromBytes({
        bytes: b,
        hasRequesterPublicKey: false,
        hasSignSignature: true,
        fee: t.fee,
        relays: 0,
      })).deep.eq(expected);
    });
    it('should work for vote tx and signSignature', () => {
      const [t] = createRandomTransactions({vote: 1});
      t.signSignature = t.signature.split('').reverse().join('');
      t.id = instance.getId(toBufferedTransaction(t));
      const b = instance.getBytes(toBufferedTransaction(t));
      const expected = {... toBufferedTransaction(t), relays: 0 };

      expect(instance.fromBytes({
        bytes: b,
        hasRequesterPublicKey: false,
        hasSignSignature: true,
        fee: t.fee,
        relays: 0,
      })).deep.eq(expected);
    });
    it('should work for delegate tx and signSignature', () => {
      const [t] = createRandomTransactions({delegate: 1});
      t.signSignature = t.signature.split('').reverse().join('');
      t.id = instance.getId(toBufferedTransaction(t));
      const b = instance.getBytes(toBufferedTransaction(t));
      const expected = {... toBufferedTransaction(t), relays: 0, recipientId: null };

      expect(instance.fromBytes({
        bytes: b,
        hasRequesterPublicKey: false,
        hasSignSignature: true,
        fee: t.fee,
        relays: 0,
      })).deep.eq(expected);
    });
    it('should work for secondSign tx', () => {
      const [t] = createRandomTransactions({signature: 1});
      t.id = instance.getId(toBufferedTransaction(t));
      const b = instance.getBytes(toBufferedTransaction(t));
      const expected = {... toBufferedTransaction(t), relays: 0, recipientId: null };
      delete expected.signSignature;
      expect(instance.fromBytes({
        bytes: b,
        hasRequesterPublicKey: false,
        hasSignSignature: false,
        fee: t.fee,
        relays: 0,
      })).deep.eq(expected);
    });
    describe('with signatures', () => {
      it('will restore tx with signatures', () => {
        const [t] = createRandomTransactions({send: 1});
        t.signatures = new Array(5)
          .fill(null)
          .map(() => createRandomWallet().publicKey + createRandomWallet().publicKey);
        t.id = instance.getId(toBufferedTransaction(t));
        const b = instance.getBytes(toBufferedTransaction(t));
        const expected = {... toBufferedTransaction(t), relays: 0, asset: null };
        delete expected.signSignature;
        expect(instance.fromBytes({
          bytes: b,
          hasRequesterPublicKey: false,
          hasSignSignature: false,
          fee: t.fee,
          relays: 0,
          signatures: t.signatures.map((s) => Buffer.from(s, 'hex'))
        })).deep.eq(expected);
      });
    });
  });
});
