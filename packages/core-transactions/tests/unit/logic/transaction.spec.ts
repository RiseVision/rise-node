import {
  IAccountLogic,
  IAccountsModel,
  ICrypto,
  ILogger,
  Symbols,
  VerificationType,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { DBBulkCreateOp } from '@risevision/core-types';
import { MyBigNumb } from '@risevision/core-utils';
import * as ByteBuffer from 'bytebuffer';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as crypto from 'crypto';
import { LiskWallet } from 'dpos-offline';
import { Container } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { createFakeBlock } from '../../../../core-blocks/tests/unit/utils/createFakeBlocks';
import {
  IBaseTransaction,
  SignedAndChainedBlockType,
  SignedBlockType,
} from '../../../../core-types/src';
import {
  TransactionLogic,
  TransactionsModel,
  TxApplyFilter,
  TxApplyUnconfirmedFilter,
  TxLogicStaticCheck,
  TxLogicVerify,
  TXSymbols,
  TxUndoFilter,
  TxUndoUnconfirmedFilter,
} from '../../../src';
import { SendTransaction } from '../../../src/sendTransaction';
import { DummyTxType } from '../utils/dummyTxType';
import {
  createSendTransaction,
  toBufferedTransaction,
} from '../utils/txCrafter';

chai.use(chaiAsPromised);

// tslint:disable-next-line no-var-requires
const expect = chai.expect;

// tslint:disable no-unused-expression no-big-function object-literal-sort-keys max-line-length
describe('logic/transaction', () => {
  let AccountsModel: typeof IAccountsModel;
  let instance: TransactionLogic;
  let container: Container;
  let cryptoImpl: ICrypto;
  let accountLogic: IAccountLogic;
  let sendTransaction: SendTransaction;
  let sandbox: SinonSandbox;
  let logger: ILogger;
  let genesisBlock: SignedAndChainedBlockType;
  let txModel: typeof TransactionsModel;

  let tx: IBaseTransaction<any>;
  let account: LiskWallet;

  let sender: IAccountsModel;
  const requester: IAccountsModel = null;
  before(async () => {
    container = await createContainer([
      'core-transactions',
      'core-helpers',
      'core-crypto',
      'core-blocks',
      'core',
      'core-accounts',
    ]);
  });
  beforeEach(async () => {
    AccountsModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.accounts
    );
    instance = container.get(Symbols.logic.transaction);
    cryptoImpl = container.get(Symbols.generic.crypto);
    accountLogic = container.get(Symbols.logic.account);
    logger = container.get(Symbols.helpers.logger);
    genesisBlock = container.get(Symbols.generic.genesisBlock);
    txModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    );
    account = new LiskWallet('meow', 'R');
    tx = toBufferedTransaction(
      createSendTransaction(account, '15256762582730568272R', 10, {
        amount: 108910891000000,
      })
    );
    sendTransaction = container.getNamed(
      TXSymbols.transaction,
      TXSymbols.sendTX
    );
    sandbox = sinon.createSandbox();
    sender = new AccountsModel({
      address: account.address,
      publicKey: tx.senderPublicKey,
      balance: 10,
      u_balance: 9,
    });
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.reset();
  });

  describe('attachAssetType', () => {
    it('should throw an error if invalid object is passed', () => {
      expect(() => {
        instance.attachAssetType({} as any);
      }).to.throw('Invalid instance interface');
    });
  });

  describe('getId', () => {
    it('should call getHash', () => {
      const getHashSpy = sandbox.spy(instance, 'getHash');
      instance.getId(tx);
      expect(getHashSpy.calledOnce).to.be.true;
      expect(getHashSpy.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should return proper id', () => {
      expect(instance.getId(tx)).eq('13691763139902401266');
    });
  });
  //
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

    it('should return correct buffer', () => {
      const retVal = instance.getHash(tx);
      expect(retVal).deep.eq(
        Buffer.from(
          'f26aab9e08ea02be9be0c26f4d65879b6ae6ff0fcf48d6d4bba58bb6939e67eb',
          'hex'
        )
      );
    });
  });

  describe('getBytes', () => {
    let sequence: any[];
    let lastBB: any;
    const toRestore = {} as any;
    before(() => {
      toRestore.writeByte = ByteBuffer.prototype.writeByte;
      toRestore.writeInt = ByteBuffer.prototype.writeInt;
      toRestore.writeLong = (ByteBuffer.prototype as any).writeLong;
      toRestore.flip = ByteBuffer.prototype.flip;
    });
    beforeEach(() => {
      sequence = [];
      (ByteBuffer.prototype as any).writeByte = function(b) {
        sequence.push(b);
        lastBB = this;
      };
      (ByteBuffer.prototype as any).writeInt = (b) => sequence.push(b);
      (ByteBuffer.prototype as any).writeLong = (b) => sequence.push(b);
      ByteBuffer.prototype.flip = sandbox.stub();
    });

    after(() => {
      (ByteBuffer.prototype as any).writeByte = toRestore.writeByte;
      (ByteBuffer.prototype as any).writeInt = toRestore.writeInt;
      (ByteBuffer.prototype as any).writeLong = toRestore.writeLong;
      ByteBuffer.prototype.flip = toRestore.flip;
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
      tx.requesterPublicKey = Buffer.from(
        '35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51899',
        'hex'
      );
      instance.getBytes(tx);
      for (let i = 0; i < tx.requesterPublicKey.length; i++) {
        // We always get here after 34 writes to the ByteBuffer
        expect(sequence[34 + i]).to.be.equal(tx.requesterPublicKey[i]);
      }
    });

    it('should add the recipientId to the ByteBuffer if tx.recipientId', () => {
      tx.recipientId = '123123123123123R';
      const recipient = tx.recipientId.slice(0, -1);
      const recBuf = new MyBigNumb(recipient).toBuffer({ size: 8 });
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
      tx.signSignature = Buffer.from('');
      const getBytesStub = sinon.stub(sendTransaction, 'getBytes');
      const sampleBuffer = Buffer.from('aabbccddee', 'hex');
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
      tx.signSignature = Buffer.from(
        '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9' +
          '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9',
        'hex'
      );
      instance.getBytes(tx);

      for (let i = 0; i < tx.signSignature.length; i++) {
        // tx.asset is empty so we start from 43
        expect(sequence[107 + i]).to.be.equal(tx.signSignature[i]);
      }
    });

    it('should NOT add the signSignature to the ByteBuffer if skipSecondSignature', () => {
      tx.signSignature = Buffer.from(
        '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9' +
          '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9',
        'hex'
      );
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
    it('should call assertKnownTransactionType', async () => {
      const akttStub = sandbox.stub(instance, 'assertKnownTransactionType');
      await instance.ready(tx, {} as any);
      expect(akttStub.calledOnce).to.be.true;
    });
    it('should return false if !sender', async () => {
      const retVal = await instance.ready(tx, undefined);
      expect(retVal).to.be.false;
    });
    it('should call txType.ready and return', async () => {
      const txTypeReadyStub = sandbox
        .stub(sendTransaction, 'ready')
        .returns('OK');
      const retVal = await instance.ready(tx, {} as any);
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
      const retVal = instance.checkBalance(10, 'balance', tx, sender);
      expect(retVal.error).to.be.eq(null);
    });

    it('should return error if balance exceeded', () => {
      // Pass an amount greater than sender balance.
      const retVal = instance.checkBalance(11, 'balance', tx, sender);
      expect(retVal.error).to.match(/Account does not have enough currency/);
    });

    it('should check against u_balance', () => {
      let retVal = instance.checkBalance(10, 'u_balance', tx, sender);
      expect(retVal.error).to.match(/Account does not have enough currency/);
      retVal = instance.checkBalance(9, 'u_balance', tx, sender);
      expect(retVal.error).to.be.eq(null);
    });
  });

  describe('verify', () => {
    let verifySignatureStub: SinonStub;
    let checkBalanceStub: SinonStub;
    let calculateFeeStub: SinonStub;
    let txTypeVerifyStub: SinonStub;
    let instGetIdStub;

    beforeEach(() => {
      (tx as any).blockId = '12345ab';
      // instance stubs
      verifySignatureStub = sandbox
        .stub(instance, 'verifySignature')
        .returns(true);
      checkBalanceStub = sandbox
        .stub(instance, 'checkBalance')
        .returns({ exceeded: false });
      // txType stubs
      calculateFeeStub = sandbox
        .stub(sendTransaction, 'calculateFee')
        .returns(tx.fee);
      txTypeVerifyStub = sandbox.stub(sendTransaction, 'verify').resolves();

      instGetIdStub = sandbox.stub(instance, 'getId').returns(tx.id);
    });

    it('should throw if the tx.id is wrong', async () => {
      instGetIdStub.returns('10');
      await expect(
        instance.verify(tx, sender, {} as any, null)
      ).to.be.rejectedWith('Invalid transaction id');
    });

    it('should call assertKnownTransactionType', async () => {
      // we want it to throw immediately
      tx.type = 99999;
      const akttStub = sandbox
        .stub(instance, 'assertKnownTransactionType')
        .throws('stop');
      try {
        await instance.verify(tx, sender, requester, 1);
      } catch (e) {
        expect(akttStub.calledOnce).to.be.true;
      }
    });

    it('should throw if Missing sender', async () => {
      await expect(
        instance.verify(tx, undefined, requester, 1)
      ).to.be.rejectedWith('Missing sender');
    });

    // it('should throw if sender second signature + multisig and no signSignature in tx', async () => {
    //   tx.requesterPublicKey   = requester.publicKey;
    //   sender.multisignatures  = [];
    //   sender.isMultisignature = () => true;
    //   sender.secondSignature  = 'signature';
    //   delete tx.signSignature;
    //   await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Missing sender second signature');
    // });
    //
    // it('should throw if second signature provided and sender has none enabled', async () => {
    //   delete tx.requesterPublicKey;
    //   delete sender.secondSignature;
    //   tx.signSignature = Buffer.from('signSignature');
    //   await expect(instance.verify(tx, sender, requester, 1))
    //     .to.be.rejectedWith('Sender does not have a second signature');
    // });
    //
    // it('should throw if missing requester second signature', async () => {
    //   tx.requesterPublicKey     = requester.publicKey;
    //   sender.isMultisignature   = () => true;
    //   requester.secondSignature = Buffer.from('secondSignature');
    //   sender.multisignatures    = [];
    //   delete tx.signSignature;
    //   await expect(instance.verify(tx, sender, requester, 1)).to.be.rejectedWith('Missing requester second signature');
    // });
    //
    // it('should throw if second signature provided, and requester has none enabled', async () => {
    //   tx.requesterPublicKey = requester.publicKey;
    //   delete requester.secondSignature;
    //   sender.multisignatures  = [];
    //   sender.isMultisignature = () => true;
    //   tx.signSignature        = Buffer.from('signSignature');
    //   await expect(instance.verify(tx, sender, requester, 1))
    //     .to.be.rejectedWith('Requester does not have a second signature');
    // });

    it('should throw if sender publicKey and tx.senderPublicKey mismatches', async () => {
      sender.publicKey = Buffer.from('ahaha');
      tx.senderPublicKey = Buffer.from('anotherPublicKey');
      await expect(
        instance.verify(tx, sender, requester, 1)
      ).to.be.rejectedWith(/Invalid sender public key/);
    });

    it('should throw if sender is not genesis account unless block id equals genesis', async () => {
      sender.publicKey = genesisBlock.generatorPublicKey;
      tx.senderPublicKey = sender.publicKey;
      (tx as any).blockId = 'anotherBlockId';
      await expect(
        instance.verify(tx, sender, requester, 1)
      ).to.be.rejectedWith('Invalid sender. Can not send from genesis account');
    });

    it('should throw if senderId mismatch', async () => {
      tx.senderId = sender.address + 'ABC';
      await expect(
        instance.verify(tx, sender, requester, 1)
      ).to.be.rejectedWith('Invalid sender address');
    });

    it('should call txType.calculateFee and throw if fee mismatch', async () => {
      // Returned value different from fee in tx (tx.fee is 10)
      calculateFeeStub.returns(9);
      await expect(
        instance.verify(tx, sender, requester, 1)
      ).to.be.rejectedWith('Invalid transaction fee');
      expect(calculateFeeStub.calledOnce).to.be.true;
      expect(calculateFeeStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(calculateFeeStub.firstCall.args[1]).to.be.deep.equal(sender);
      expect(calculateFeeStub.firstCall.args[2]).to.be.equal(1);
    });

    it('should throw if amount is < 0', async () => {
      tx.amount = -100;
      await expect(
        instance.verify(tx, sender, requester, 1)
      ).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should throw if amount is > totalAmout', async () => {
      (tx as any).amount = '10999999991000001';
      await expect(
        instance.verify(tx, sender, requester, 1)
      ).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should throw if amount is decimal', async () => {
      tx.amount = 10.1;
      await expect(
        instance.verify(tx, sender, requester, 1)
      ).to.be.rejectedWith('Invalid transaction amount');
    });

    // tslint:disable-next-line
    it('should throw if amount is written in exponential notation', async () => {
      (tx as any).amount = '10e3';
      await expect(
        instance.verify(tx, sender, requester, 1)
      ).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should reject tx if verifySignature throws (for whatever reason', async () => {
      verifySignatureStub.throws(new Error('whatever'));

      await expect(instance.verify(tx, sender, null, 1)).to.rejectedWith(
        'whatever'
      );
    });

    it('should call checkBalance and throw if checkBalance returns an error', async () => {
      checkBalanceStub.returns({ exceeded: true, error: 'checkBalance error' });
      await expect(
        instance.verify(tx, sender, requester, 1)
      ).to.be.rejectedWith('checkBalance error');
      expect(checkBalanceStub.calledOnce).to.be.true;
      expect(checkBalanceStub.firstCall.args[0].toString()).to.be.equal(
        '108910891000010'
      );
      expect(checkBalanceStub.firstCall.args[1]).to.be.equal('balance');
      expect(checkBalanceStub.firstCall.args[2]).to.be.deep.equal(tx);
      expect(checkBalanceStub.firstCall.args[3]).to.be.deep.equal(sender);
    });

    // it('should call slots.getSlotNumber', async () => {
    //   slotsStub.stubs.getSlotNumber.returns(1);
    //   await instance.verify(tx, sender, requester, 1);
    //   expect(slotsStub.stubs.getSlotNumber.calledTwice).to.be.true;
    //   expect(slotsStub.stubs.getSlotNumber.firstCall.args[0]).to.be.equal(tx.timestamp);
    // });
    //
    // it('should throw if timestamp is in the future', async () => {
    //   slotsStub.stubs.getSlotNumber.onCall(0).returns(1000000);
    //   slotsStub.stubs.getSlotNumber.onCall(1).returns(10);
    //   await expect(instance.verify(tx, sender, requester, 1))
    //     .to.be.rejectedWith('Invalid transaction timestamp. Timestamp is in the future');
    // });

    it('should await verify from the txType', async () => {
      await instance.verify(tx, sender, requester, 1);
      expect(txTypeVerifyStub.calledOnce).to.be.true;
      expect(txTypeVerifyStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeVerifyStub.firstCall.args[1]).to.be.deep.equal(sender);
    });

    describe('hooks', () => {
      let staticCheck: SinonStub;
      let verifyStub: SinonStub;

      class Meow extends WPHooksSubscriber(Object) {
        public hookSystem: WordPressHookSystem;

        @TxLogicStaticCheck()
        public staticCheck(...args: any[]) {
          return staticCheck(...args);
        }

        @TxLogicVerify()
        public verify(...args: any[]) {
          return verifyStub(...args);
        }
      }

      let m: Meow;
      beforeEach(async () => {
        staticCheck = sandbox.stub();
        verifyStub = sandbox.stub();
        m = new Meow();
        m.hookSystem = container.get(Symbols.generic.hookSystem);
        await m.hookMethods();
      });
      afterEach(async () => {
        await m.unHook();
      });
      it('should call static-checks with proper data and honor hooks throws', async () => {
        await instance.verify(tx, sender, requester, 1);
        expect(staticCheck.calledOnce).is.true;
        expect(staticCheck.firstCall.args).deep.eq([tx, sender, requester, 1]);

        staticCheck.resetHistory();
        staticCheck.rejects(new Error('m sorry'));
        await expect(instance.verify(tx, sender, requester, 1)).rejectedWith(
          'm sorry'
        );
      });
      it('call action verify/tx and with proper data and honor throws', async () => {
        await instance.verify(tx, sender, requester, 1);
        expect(verifyStub.calledOnce).is.true;
        expect(verifyStub.firstCall.args).deep.eq([tx, sender, requester, 1]);

        verifyStub.resetHistory();
        verifyStub.rejects(new Error('m sorry'));
        await expect(instance.verify(tx, sender, requester, 1)).rejectedWith(
          'm sorry'
        );
      });
    });
  });

  describe('verifySignature', () => {
    let akttStub: SinonStub;
    let getHashStub: SinonStub;
    const theHash = Buffer.from('123abc', 'hex');

    beforeEach(() => {
      akttStub = sandbox
        .stub(instance, 'assertKnownTransactionType')
        .returns(true);
      getHashStub = sandbox.stub(instance, 'getHash').returns(theHash);
    });

    it('should call assertKnownTransactionType', () => {
      instance.verifySignature(
        tx,
        tx.senderPublicKey,
        tx.signature,
        VerificationType.ALL
      );
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx.type);
    });

    it('should call ed.verify', () => {
      const edStub = sandbox.stub(cryptoImpl, 'verify').returns(true);
      instance.verifySignature(
        tx,
        tx.senderPublicKey,
        tx.signature,
        VerificationType.ALL
      );
      expect(edStub.calledOnce).to.be.true;
      expect(edStub.firstCall.args[0]).to.be.deep.equal(theHash);
      expect(edStub.firstCall.args[1]).to.be.deep.equal(tx.signature);
      expect(edStub.firstCall.args[2]).to.be.deep.equal(tx.senderPublicKey);
    });
    describe('verificationType', () => {
      it('should call getHash with false, false when VerificationType is ALL', () => {
        instance.verifySignature(
          tx,
          tx.senderPublicKey,
          tx.signature,
          VerificationType.ALL
        );
        expect(getHashStub.calledOnce).to.be.true;
        expect(getHashStub.firstCall.args[0]).to.be.deep.equal(tx);
        expect(getHashStub.firstCall.args[1]).to.be.equal(false);
        expect(getHashStub.firstCall.args[2]).to.be.equal(false);
      });
      it('should call getHash with false, true when VerificationType is SECOND_SIGNATURE', () => {
        instance.verifySignature(
          tx,
          tx.senderPublicKey,
          tx.signature,
          VerificationType.SECOND_SIGNATURE
        );
        expect(getHashStub.calledOnce).to.be.true;
        expect(getHashStub.firstCall.args[0]).to.be.deep.equal(tx);
        expect(getHashStub.firstCall.args[1]).to.be.equal(false);
        expect(getHashStub.firstCall.args[2]).to.be.equal(true);
      });
      it('should call getHash with true, true when VerificationType is SIGNATURE', () => {
        instance.verifySignature(
          tx,
          tx.senderPublicKey,
          tx.signature,
          VerificationType.SIGNATURE
        );
        expect(getHashStub.calledOnce).to.be.true;
        expect(getHashStub.firstCall.args[0]).to.be.deep.equal(tx);
        expect(getHashStub.firstCall.args[1]).to.be.equal(true);
        expect(getHashStub.firstCall.args[2]).to.be.equal(true);
      });
    });
    it('should call false if signature is null', () => {
      expect(
        instance.verifySignature(
          tx,
          tx.senderPublicKey,
          null,
          VerificationType.ALL
        )
      ).to.be.false;
    });
  });

  describe('apply', () => {
    let readyStub: SinonStub;
    let checkBalanceStub: SinonStub;
    let txTypeApplyStub: SinonStub;
    let block: SignedBlockType;

    beforeEach(() => {
      // instance stubs
      readyStub = sandbox.stub(instance, 'ready').returns(true);
      checkBalanceStub = sandbox
        .stub(instance, 'checkBalance')
        .returns({ exceeded: false });
      // dependency stubs
      // txType stub
      txTypeApplyStub = sandbox.stub(sendTransaction, 'apply').resolves([]);
      block = createFakeBlock(container, { transactions: [tx] });
    });

    it('should call ready', async () => {
      await instance.apply(tx as any, block, sender);
      expect(readyStub.calledOnce).to.be.true;
      expect(readyStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(readyStub.firstCall.args[1]).to.be.deep.equal(sender);
    });

    it('should throw if not ready', async () => {
      readyStub.returns(false);
      await expect(instance.apply(tx as any, block, sender)).to.be.rejectedWith(
        'Transaction is not ready'
      );
    });

    it('should call checkBalance', async () => {
      await instance.apply(tx as any, block, sender);
      expect(checkBalanceStub.calledOnce).to.be.true;
      const expectedAmount = new MyBigNumb(tx.amount.toString()).plus(
        tx.fee.toString()
      );
      expect(checkBalanceStub.firstCall.args[0]).to.be.deep.equal(
        expectedAmount
      );
      expect(checkBalanceStub.firstCall.args[1]).to.be.equal('balance');
      expect(checkBalanceStub.firstCall.args[2]).to.be.deep.equal(tx);
      expect(checkBalanceStub.firstCall.args[3]).to.be.deep.equal(sender);
    });

    it('should throw if checkBalance returns an error', async () => {
      checkBalanceStub.returns({ exceeded: true, error: 'checkBalance error' });
      await expect(instance.apply(tx as any, block, sender)).to.be.rejectedWith(
        'checkBalance error'
      );
    });

    it('should call accountLogic.merge', async () => {
      const mergeStub = sandbox.stub(accountLogic, 'merge').returns([]);
      await instance.apply(tx as any, block, sender);

      expect(mergeStub.calledOnce).to.be.true;
      expect(mergeStub.firstCall.args[0]).to.be.equal(sender.address);
      expect(mergeStub.firstCall.args[1]).to.be.deep.equal({
        balance: -108910891000010,
        blockId: block.id,
      });
    });

    // it('should call roundsLogic.calcRound', async () => {
    //   await instance.apply(tx as any, block, sender);
    //   expect(roundsLogicStub.stubs.calcRound.called).to.be.true;
    //   expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(block.height);
    // });

    it('should call apply from the txType', async () => {
      await instance.apply(tx as any, block, sender);
      expect(txTypeApplyStub.calledOnce).to.be.true;
      expect(txTypeApplyStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeApplyStub.firstCall.args[1]).to.be.deep.equal(block);
      expect(txTypeApplyStub.firstCall.args[2]).to.be.deep.equal(sender);
    });

    it('should call apply_filter over operations', async () => {
      const stub = sandbox.stub().callsFake((ops) => ['meow'].concat(ops));

      // tslint:disable-next-line
      class A extends WPHooksSubscriber(Object) {
        public hookSystem: WordPressHookSystem = container.get(
          Symbols.generic.hookSystem
        );

        @TxApplyFilter()
        public apply(...args: any[]) {
          return stub(...args);
        }
      }

      const a = new A();
      await a.hookMethods();
      const res = await instance.apply(tx as any, block, sender);
      expect(stub.calledOnce).is.true;
      expect(stub.firstCall.args.length).eq(4);
      expect(res[0]).eq('meow');
      await a.unHook();
    });
  });

  describe('undo', () => {
    let txTypeUndoStub: SinonStub;
    let block: SignedBlockType;
    beforeEach(() => {
      // dependency stubs
      // txType stub
      txTypeUndoStub = sandbox.stub(sendTransaction, 'undo').resolves([]);
      block = createFakeBlock(container, { transactions: [tx] });
    });

    it('should call accountLogic.merge', async () => {
      const alstub = sandbox.stub(accountLogic, 'merge').returns([]);
      await instance.undo(tx as any, block, sender);
      expect(alstub.calledOnce).to.be.true;
      expect(alstub.firstCall.args[0]).to.be.equal(sender.address);
      expect(alstub.firstCall.args[1]).to.be.deep.equal({
        balance: 108910891000010,
        blockId: block.id,
      });
    });
    // TODO:
    // it('should call roundsLogic.calcRound', async () => {
    //   await instance.undo(tx as any, block, sender);
    //   expect(roundsLogicStub.stubs.calcRound.called).to.be.true;
    //   expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(block.height);
    // });

    it('should call undo from the txType', async () => {
      await instance.undo(tx as any, block, sender);

      expect(txTypeUndoStub.calledOnce).to.be.true;
      expect(txTypeUndoStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeUndoStub.firstCall.args[1]).to.be.deep.equal(block);
      expect(txTypeUndoStub.firstCall.args[2]).to.be.deep.equal(sender);
    });

    it('should call apply_filter over operations', async () => {
      const stub = sandbox.stub().callsFake((ops) => ['meow'].concat(ops));

      // tslint:disable-next-line
      class A extends WPHooksSubscriber(Object) {
        public hookSystem: WordPressHookSystem = container.get(
          Symbols.generic.hookSystem
        );

        @TxUndoFilter()
        public undo(...args: any[]) {
          return stub(...args);
        }
      }

      const a = new A();
      await a.hookMethods();
      const res = await instance.undo(tx as any, block, sender);
      expect(stub.calledOnce).is.true;
      expect(stub.firstCall.args.length).eq(4);
      expect(res[0]).eq('meow');
      await a.unHook();
    });
  });
  //
  describe('applyUnconfirmed', () => {
    let txTypeApplyUnconfirmedStub: SinonStub;

    beforeEach(() => {
      // instance stubs
      // // dependency stubs
      // roundsLogicStub.stubs.calcRound.returns(1);
      // accountLogicStub.stubs.merge.returns([]);
      // txType stub
      txTypeApplyUnconfirmedStub = sandbox
        .stub(sendTransaction, 'applyUnconfirmed')
        .resolves([]);
      sender.u_balance = tx.amount * 2;
    });

    it('should check unconfirmed balance', async () => {
      sender.u_balance = 1000000;
      tx.amount = 1000000 - 1;
      await expect(
        instance.applyUnconfirmed(tx as any, sender, requester)
      ).rejectedWith(
        'Account does not have enough currency: 12135315034565240595R balance: 0.01 - 0.01000009'
      );
    });

    it('should call accountLogic.merge', async () => {
      const aMStub = sandbox.stub(accountLogic, 'merge').returns([]);
      await instance.applyUnconfirmed(tx as any, sender, requester);
      expect(aMStub.calledOnce).to.be.true;
      expect(aMStub.firstCall.args[0]).to.be.equal(sender.address);
      expect(aMStub.firstCall.args[1]).to.be.deep.equal({
        u_balance: -108910891000010,
      });
    });

    it('should call applyUnconfirmed from the txTypes', async () => {
      await instance.applyUnconfirmed(tx as any, sender, requester);
      expect(txTypeApplyUnconfirmedStub.calledOnce).to.be.true;
      expect(txTypeApplyUnconfirmedStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeApplyUnconfirmedStub.firstCall.args[1]).to.be.deep.equal(
        sender
      );
    });

    it('should call apply_filter over operations', async () => {
      const stub = sandbox.stub().callsFake((ops) => ['meow'].concat(ops));

      // tslint:disable-next-line
      class A extends WPHooksSubscriber(Object) {
        public hookSystem: WordPressHookSystem = container.get(
          Symbols.generic.hookSystem
        );

        @TxApplyUnconfirmedFilter()
        public applyUnconfirmed(...args: any[]) {
          return stub(...args);
        }
      }

      const a = new A();
      await a.hookMethods();
      const res = await instance.applyUnconfirmed(tx as any, sender);
      expect(stub.calledOnce).is.true;
      expect(stub.firstCall.args.length).eq(3);
      expect(res[0]).eq('meow');
      await a.unHook();
    });
  });

  describe('undoUnconfirmed', () => {
    let txTypeUndoUnconfirmedStub: SinonStub;

    beforeEach(() => {
      // // dependency stubs
      // roundsLogicStub.stubs.calcRound.returns(1);
      // accountLogicStub.stubs.merge.returns([]);
      // txType stub
      txTypeUndoUnconfirmedStub = sandbox
        .stub(sendTransaction, 'undoUnconfirmed')
        .resolves([]);
    });

    it('should call accountLogic.merge', async () => {
      const aMStub = sandbox.stub(accountLogic, 'merge').returns([]);

      await instance.undoUnconfirmed(tx as any, sender);
      expect(aMStub.calledOnce).to.be.true;
      expect(aMStub.firstCall.args[0]).to.be.equal(sender.address);
      expect(aMStub.firstCall.args[1]).to.be.deep.equal({
        u_balance: 108910891000010,
      });
    });

    it('should call undo from the txType', async () => {
      await instance.undoUnconfirmed(tx as any, sender);
      expect(txTypeUndoUnconfirmedStub.calledOnce).to.be.true;
      expect(txTypeUndoUnconfirmedStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(txTypeUndoUnconfirmedStub.firstCall.args[1]).to.be.deep.equal(
        sender
      );
    });

    it('should call apply_filter over operations', async () => {
      const stub = sandbox.stub().callsFake((ops) => ['meow'].concat(ops));

      // tslint:disable-next-line
      class A extends WPHooksSubscriber(Object) {
        public hookSystem: WordPressHookSystem = container.get(
          Symbols.generic.hookSystem
        );

        @TxUndoUnconfirmedFilter()
        public undoUnconfirmed(...args: any[]) {
          return stub(...args);
        }
      }

      const a = new A();
      await a.hookMethods();
      const res = await instance.undoUnconfirmed(tx as any, sender);
      expect(stub.calledOnce).is.true;
      expect(stub.firstCall.args.length).eq(3);
      expect(res[0]).eq('meow');
      await a.unHook();
    });
  });

  describe('dbSave', () => {
    let akttStub: SinonStub;
    let txTypeDbSaveStub: SinonStub;

    beforeEach(() => {
      tx.senderId = sender.address;
      akttStub = sandbox
        .stub(instance, 'assertKnownTransactionType')
        .returns(true);
      txTypeDbSaveStub = sandbox
        .stub(sendTransaction, 'dbSave')
        .returns({ table: 'table', fields: [], values: [] });
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
      expect(retVal[1]).to.be.deep.equal({
        table: 'table',
        fields: [],
        values: [],
      });
    });

    it('should return the correct first object', () => {
      tx.requesterPublicKey = sender.publicKey;
      const retVal = instance.dbSave([tx as any], '11', 100);
      expect(retVal[0].model).to.be.deep.eq(txModel);
      expect(retVal[0].type).to.be.deep.eq('bulkCreate');
      expect((retVal[0] as DBBulkCreateOp<any>).values[0]).to.be.deep.eq({
        amount: tx.amount,
        blockId: '11',
        fee: tx.fee,
        height: 100,
        id: tx.id,
        recipientId: tx.recipientId || null,
        requesterPublicKey: tx.requesterPublicKey,
        senderId: tx.senderId,
        senderPublicKey: tx.senderPublicKey,
        signSignature: null,
        signature: tx.signature,
        signatures: tx.signatures ? tx.signatures.join(',') : null,
        timestamp: tx.timestamp,
        type: tx.type,
      });
    });

    it('should cluster multiple txs together in single bulkCreate and append sub assets db ops', () => {
      instance.types[2] = new DummyTxType(2);

      const txs = [
        createSendTransaction(account, '1R', 10, { amount: 1 }),
        createSendTransaction(account, '1R', 11, { amount: 1 }),
        { ...createSendTransaction(account, '1R', 10, { amount: 1 }), type: 2 },
        { ...createSendTransaction(account, '1R', 10, { amount: 1 }), type: 2 },
      ]
        .map((t) => toBufferedTransaction(t))
        .map((t) => ({ ...t, senderId: t.recipientId }));
      const retVal = instance.dbSave(txs, '11', 100);
      expect(retVal[0].model).to.be.deep.eq(txModel);
      expect(retVal[0].type).to.be.deep.eq('bulkCreate');
      const op: DBBulkCreateOp<any> = retVal[0] as any;
      expect(op.values).to.be.an('array');
      for (let i = 0; i < txs.length; i++) {
        const expectedValue = {
          ...txs[i],
          blockId: '11',
          height: 100,
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
      tx.senderId = sender.address;
      akttStub = sandbox
        .stub(instance, 'assertKnownTransactionType')
        .returns(true);
      txTypeAfterSaveStub = sandbox
        .stub(sendTransaction, 'afterSave')
        .returns('txType aftersave');
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
      tx.senderId = sender.address;
      akttStub = sandbox
        .stub(instance, 'assertKnownTransactionType')
        .returns(true);
      txTypeObjectNormalizeStub = sandbox
        .stub(sendTransaction, 'objectNormalize')
        .returns('txType objectNormalize');
    });

    it('should call assertKnownTransactionType', () => {
      instance.objectNormalize({ ...tx, blockId: '10' } as any);
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx.type);
    });

    it('should remove nulls and undefined', () => {
      (tx as any).nullItem = null;
      (tx as any).undefinedItem = undefined;
      txTypeObjectNormalizeStub.callsFake((transaction) => transaction);
      const retVal = instance.objectNormalize(tx);
      expect(retVal.signature).to.be.deep.equal(tx.signature);
      expect((retVal as any).nullItem).to.be.undefined;
      expect((retVal as any).undefinedItem).to.be.undefined;
    });

    it('should call objectNormalize from the txType and return the result of execution', () => {
      const retVal = instance.objectNormalize(tx);
      expect(txTypeObjectNormalizeStub.calledOnce).to.be.true;
      const dpassedTx = { ...tx };
      delete dpassedTx.requesterPublicKey;
      delete dpassedTx.signSignature;
      delete dpassedTx.signatures;
      expect(txTypeObjectNormalizeStub.firstCall.args[0]).to.be.deep.equal(
        dpassedTx
      );
      expect(retVal).to.be.equal('txType objectNormalize');
    });

    describe('with real schema validation', () => {
      beforeEach(() => {
        instance.attachAssetType(sendTransaction);
      });
      it('valid', () => {
        instance.objectNormalize(tx);
      });

      ['signature', 'signSignature'].forEach((sig) => {
        it(`should validate ${sig}`, () => {
          // wrong length or buf string
          tx[sig] = Buffer.alloc(32);
          expect(() => instance.objectNormalize(tx)).to.throw(
            'format signatureBuf'
          );
          tx[sig] = Buffer.alloc(32).toString('hex') as any;
          expect(() => instance.objectNormalize(tx)).to.throw(
            'format signatureBuf'
          );
          tx[sig] = 'hey' as any;
          expect(() => instance.objectNormalize(tx)).to.throw(
            'format signatureBuf'
          );

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
        it('should validate ' + pk, () => {
          // wrong length or buf string
          tx[pk] = Buffer.alloc(31);
          expect(() => instance.objectNormalize(tx)).to.throw(
            'format publicKeyBuf'
          );
          tx[pk] = Buffer.alloc(31).toString('hex') as any;
          expect(() => instance.objectNormalize(tx)).to.throw(
            'format publicKeyBuf'
          );
          tx[pk] = 'hey' as any;
          expect(() => instance.objectNormalize(tx)).to.throw(
            'format publicKeyBuf'
          );

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
        expect(() => instance.objectNormalize(tx)).to.throw(
          'Value -1 is less than minimum'
        );
      });
      ['senderId', 'recipientId'].forEach((add) => {
        it(`should validate address field ${add}`, () => {
          tx[add] = 'asd';
          expect(() => instance.objectNormalize(tx)).to.throw('format address');
          tx[add] = '';
          expect(() => instance.objectNormalize(tx)).to.throw('format address');
          tx[add] =
            Array(22)
              .fill('1')
              .join('') + 'R';
          expect(() => instance.objectNormalize(tx)).to.throw('format address');
        });
      });

      ['fee', 'amount'].forEach((field) => {
        it(`should validate ${field}`, () => {
          delete tx[field];
          expect(() => instance.objectNormalize(tx)).to.throw();
          tx[field] = null;
          expect(() => instance.objectNormalize(tx)).to.throw();
          tx[field] = -1;
          expect(() => instance.objectNormalize(tx)).to.throw(
            'Value -1 is less than minimum'
          );
          tx[field] = 10999999991000000 + 10000;
          expect(() => instance.objectNormalize(tx)).to.throw(
            'is greater than maximum'
          );
        });
      });
    });
  });
});
