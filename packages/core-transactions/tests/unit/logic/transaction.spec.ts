import {
  IAccountLogic,
  IAccountsModel,
  ICrypto,
  IIdsHandler,
  ILogger,
  Symbols,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { DBBulkCreateOp } from '@risevision/core-types';
import { toBigIntBE, toBigIntLE, toBufferLE } from 'bigint-buffer';
import * as ByteBuffer from 'bytebuffer';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as crypto from 'crypto';
import { Address, IKeypair, RiseV2 } from 'dpos-offline';
import { Container } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import 'reflect-metadata';
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
  TXBytes,
  TxLogicStaticCheck,
  TxLogicVerify,
  TXSymbols,
  TxUndoFilter,
  TxUndoUnconfirmedFilter,
} from '../../../src';
import { SendTransaction } from '../../../src/sendTransaction';
import { DummyTxType } from '../utils/dummyTxType';
import { createSendTransaction, toNativeTx } from '../utils/txCrafter';

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
  let idsHandler: IIdsHandler;
  let txBytes: TXBytes;
  let tx: IBaseTransaction<any, bigint>;
  let account: IKeypair;

  let sender: IAccountsModel;
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
    idsHandler = container.get(Symbols.helpers.idsHandler);
    txBytes = container.get(TXSymbols.txBytes);
    cryptoImpl = container.get(Symbols.generic.crypto);
    accountLogic = container.get(Symbols.logic.account);
    logger = container.get(Symbols.helpers.logger);
    genesisBlock = container.get(Symbols.generic.genesisBlock);
    txModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.transactions
    );
    account = RiseV2.deriveKeypair('meow');
    tx = toNativeTx(
      createSendTransaction(account, '15256762582730568272R' as Address, 10, {
        amount: 108910891000000,
      })
    );
    sendTransaction = container.getNamed(
      TXSymbols.transaction,
      TXSymbols.sendTX
    );
    sandbox = sinon.createSandbox();
    sender = new AccountsModel({
      address: RiseV2.calcAddress(account.publicKey),
      balance: 10n,
      u_balance: 9n,
    });
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.reset();
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
    it('should return a Buffer', () => {
      const retVal = instance.getHash(tx);
      expect(retVal).to.be.instanceOf(Buffer);
    });

    it('should return correct buffer', () => {
      const retVal = instance.getHash(tx);

      expect(retVal).deep.eq(
        Buffer.from(
          'e7ce23fd72bc7be9618443b7d0d4742f472736068898f79b98d0b264ca7ec43c',
          'hex'
        )
      );
    });
  });
  //
  // describe('getBytes', () => {
  //   let sequence: any[];
  //   let lastBB: any;
  //   const toRestore = {} as any;
  //   before(() => {
  //     toRestore.writeByte = ByteBuffer.prototype.writeByte;
  //     toRestore.append = ByteBuffer.prototype.append;
  //     toRestore.writeInt = ByteBuffer.prototype.writeInt;
  //     toRestore.writeLong = (ByteBuffer.prototype as any).writeLong;
  //     toRestore.flip = ByteBuffer.prototype.flip;
  //   });
  //   beforeEach(() => {
  //     sequence = [];
  //     (ByteBuffer.prototype as any).writeByte = function(b) {
  //       sequence.push(b);
  //       lastBB = this;
  //     };
  //     (ByteBuffer.prototype as any).writeInt = (b) => sequence.push(b);
  //     (ByteBuffer.prototype as any).writeLong = (b) => sequence.push(b);
  //     (ByteBuffer.prototype as any).append = (b) => sequence.push(b);
  //     ByteBuffer.prototype.flip = sandbox.stub();
  //   });
  //
  //   after(() => {
  //     (ByteBuffer.prototype as any).writeByte = toRestore.writeByte;
  //     (ByteBuffer.prototype as any).writeInt = toRestore.writeInt;
  //     (ByteBuffer.prototype as any).writeLong = toRestore.writeLong;
  //     (ByteBuffer.prototype as any).append = toRestore.append;
  //     ByteBuffer.prototype.flip = toRestore.flip;
  //   });
  //
  //   it('should throw an error if wrong tx type', () => {
  //     // Only tx type 0 is registered
  //     tx.type = 999;
  //     expect(() => {
  //       instance.getBytes(tx);
  //     }).to.throw('Unknown transaction type 999');
  //   });
  //
  //   it('should call getBytes from the right txType', () => {
  //     const getBytesSpy = sandbox.spy(sendTransaction, 'getBytes');
  //     instance.getBytes(tx, true, false);
  //     expect(getBytesSpy.calledOnce).to.be.true;
  //     expect(getBytesSpy.firstCall.args[0]).to.be.deep.equal(tx);
  //     expect(getBytesSpy.firstCall.args[1]).to.be.deep.equal(true);
  //     expect(getBytesSpy.firstCall.args[2]).to.be.deep.equal(false);
  //   });
  //
  //   it('should create a ByteBuffer of the right length', () => {
  //     instance.getBytes(tx, true, false);
  //     expect(lastBB.capacity()).to.be.equal(213);
  //   });
  //
  //   it('should add the type as first byte of the ByteBuffer', () => {
  //     instance.getBytes(tx, true, false);
  //     expect(sequence[0]).to.be.equal(tx.type);
  //   });
  //
  //   it('should add the timestamp to the ByteBuffer via writeInt', () => {
  //     tx.timestamp = Date.now();
  //     instance.getBytes(tx, true, false);
  //     expect(sequence[1]).to.be.equal(tx.timestamp);
  //   });
  //
  //   it('should add the senderPublicKey to the ByteBuffer', () => {
  //     instance.getBytes(tx);
  //     expect(sequence[2]).deep.eq(tx.senderPublicKey);
  //   });
  //
  //   it('should add the requesterPublicKey to the ByteBuffer if tx.requesterPublicKey', () => {
  //     tx.requesterPublicKey = Buffer.from(
  //       '35526f8a1e2f482264e5d4982fc07e73f4ab9f4794b110ceefecd8f880d51899',
  //       'hex'
  //     );
  //     instance.getBytes(tx);
  //     expect(sequence[3]).deep.eq(tx.requesterPublicKey);
  //   });
  //
  //   it('should add the recipientId to the ByteBuffer if tx.recipientId', () => {
  //     tx.recipientId = '123123123123123R';
  //     instance.getBytes(tx);
  //     expect(toBigIntBE(sequence[3])).eq(123123123123123n);
  //   });
  //
  //   it('should add 8 zeroes to the ByteBuffer if NOT tx.recipientId', () => {
  //     tx.recipientId = undefined;
  //     instance.getBytes(tx);
  //
  //     expect(toBigIntBE(sequence[3])).eq(0n);
  //     expect(sequence[3]).deep.eq(Buffer.alloc(8).fill(0));
  //   });
  //
  //   it('should add the amount to the ByteBuffer via bigint-buffer', () => {
  //     instance.getBytes(tx);
  //     expect(sequence[4]).to.be.deep.equal(toBufferLE(tx.amount, 8));
  //   });
  //
  //   it('should add the asset bytes to the ByteBuffer if not empty', () => {
  //     tx.signSignature = Buffer.from('');
  //     const getBytesStub = sinon.stub(sendTransaction, 'getBytes');
  //     const sampleBuffer = Buffer.from('aabbccddee', 'hex');
  //     getBytesStub.returns(sampleBuffer);
  //     instance.getBytes(tx);
  //     expect(sequence[5]).deep.eq(sampleBuffer);
  //     getBytesStub.restore();
  //   });
  //
  //   it('should add the signature to the ByteBuffer', () => {
  //     instance.getBytes(tx);
  //     expect(sequence[5]).deep.eq(tx.signature);
  //   });
  //
  //   it('should NOT add the signature to the ByteBuffer if skipSignature', () => {
  //     instance.getBytes(tx, true, true);
  //     expect(sequence[5]).not.deep.eq(tx.signature);
  //   });
  //
  //   it('should add the signSignature to the ByteBuffer', () => {
  //     tx.signSignature = Buffer.from(
  //       '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9' +
  //         '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9',
  //       'hex'
  //     );
  //     instance.getBytes(tx);
  //     expect(sequence[5]).deep.eq(tx.signature);
  //     expect(sequence[6]).deep.eq(tx.signSignature);
  //   });
  //
  //   it('should NOT add the signSignature to the ByteBuffer if skipSecondSignature', () => {
  //     tx.signSignature = Buffer.from(
  //       '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9' +
  //         '93e49ce591472c5c587ff419c02c80e78159a82e0143f87c51dec43a2613cbd9',
  //       'hex'
  //     );
  //     instance.getBytes(tx, false, true);
  //     expect(sequence[6]).not.deep.eq(tx.signSignature);
  //   });
  //
  //   it('should flip the ByteBuffer', () => {
  //     instance.getBytes(tx, true, true);
  //     expect(lastBB.flip.calledOnce).to.be.true;
  //   });
  //
  //   it('should return a Buffer', () => {
  //     const retVal = instance.getBytes(tx, true, true);
  //     expect(retVal).to.be.instanceOf(Buffer);
  //   });
  // });

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
        .returns('OK' as any);
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

  describe('assertEnoughBalance', () => {
    it('should return error:null if OK', () => {
      instance.assertEnoughBalance(10n, 'balance', tx, sender);
    });

    it('should return error if balance exceeded', () => {
      // Pass an amount greater than sender balance.
      expect(() =>
        instance.assertEnoughBalance(11n, 'balance', tx, sender)
      ).to.throw(/Account does not have enough currency/);
    });

    it('should check against u_balance', () => {
      expect(() =>
        instance.assertEnoughBalance(10n, 'u_balance', tx, sender)
      ).to.throw(/Account does not have enough currency/);

      instance.assertEnoughBalance(9n, 'u_balance', tx, sender);
    });
  });

  describe('verify', () => {
    let verifySignatureStub: SinonStub;
    let checkBalanceStub: SinonStub;
    let calculateMinFeeStub: SinonStub;
    let txTypeVerifyStub: SinonStub;
    // let instGetIdStub;

    beforeEach(() => {
      (tx as any).blockId = '12345ab';
      // instance stubs
      verifySignatureStub = sandbox
        .stub(instance, 'verifySignature')
        .returns(true);
      checkBalanceStub = sandbox
        .stub(instance, 'assertEnoughBalance')
        .returns({ exceeded: false } as any);
      // txType stubs
      calculateMinFeeStub = sandbox
        .stub(sendTransaction, 'calculateMinFee')
        .returns(tx.fee);
      txTypeVerifyStub = sandbox.stub(sendTransaction, 'verify').resolves();

      // instGetIdStub = sandbox.stub(instance, 'getId').returns(tx.id);
    });

    it('should throw if the tx.id is wrong', async () => {
      // instGetIdStub.returns('10');
      tx.id = '1';
      await expect(instance.verify(tx, sender, null)).to.be.rejectedWith(
        'Invalid transaction id'
      );
    });

    it('should call assertKnownTransactionType', async () => {
      // we want it to throw immediately
      tx.type = 99999;
      const akttStub = sandbox
        .stub(instance, 'assertKnownTransactionType')
        .throws('stop');
      try {
        await instance.verify(tx, sender, 1);
      } catch (e) {
        expect(akttStub.calledOnce).to.be.true;
      }
    });

    it('should throw if Missing sender', async () => {
      await expect(instance.verify(tx, undefined, 1)).to.be.rejectedWith(
        'Missing sender'
      );
    });

    // it('should throw if sender second signature + multisig and no signSignature in tx', async () => {
    //   tx.requesterPublicKey   = requester.publicKey;
    //   sender.multisignatures  = [];
    //   sender.isMultisignature = () => true;
    //   sender.secondSignature  = 'signature';
    //   delete tx.signSignature;
    //   await expect(instance.verify(tx, sender, 1)).to.be.rejectedWith('Missing sender second signature');
    // });
    //
    // it('should throw if second signature provided and sender has none enabled', async () => {
    //   delete tx.requesterPublicKey;
    //   delete sender.secondSignature;
    //   tx.signSignature = Buffer.from('signSignature');
    //   await expect(instance.verify(tx, sender, 1))
    //     .to.be.rejectedWith('Sender does not have a second signature');
    // });
    //
    // it('should throw if missing requester second signature', async () => {
    //   tx.requesterPublicKey     = requester.publicKey;
    //   sender.isMultisignature   = () => true;
    //   requester.secondSignature = Buffer.from('secondSignature');
    //   sender.multisignatures    = [];
    //   delete tx.signSignature;
    //   await expect(instance.verify(tx, sender, 1)).to.be.rejectedWith('Missing requester second signature');
    // });
    //
    // it('should throw if second signature provided, and requester has none enabled', async () => {
    //   tx.requesterPublicKey = requester.publicKey;
    //   delete requester.secondSignature;
    //   sender.multisignatures  = [];
    //   sender.isMultisignature = () => true;
    //   tx.signSignature        = Buffer.from('signSignature');
    //   await expect(instance.verify(tx, sender, 1))
    //     .to.be.rejectedWith('Requester does not have a second signature');
    // });

    // TODO: restore these.
    // it('should throw if sender publicKey and tx.senderPublicKey mismatches', async () => {
    //   sender.publicKey = Buffer.from('ahaha');
    //   tx.senderPublicKey = Buffer.from('anotherPublicKey');
    //   tx.id = idsHandler.calcTxIdFromBytes(txBytes.fullBytes(tx));
    //   await expect(instance.verify(tx, sender, 1)).to.be.rejectedWith(
    //     /Invalid sender public key/
    //   );
    // });
    //
    // it('should throw if sender is not genesis account unless block id equals genesis', async () => {
    //   sender.publicKey = genesisBlock.generatorPublicKey;
    //   tx.senderPublicKey = sender.publicKey;
    //   (tx as any).blockId = 'anotherBlockId';
    //   tx.id = idsHandler.calcTxIdFromBytes(txBytes.fullBytes(tx));
    //   await expect(instance.verify(tx, sender, 1)).to.be.rejectedWith(
    //     'Invalid sender. Can not send from genesis account'
    //   );
    // });

    it('should throw if senderId mismatch', async () => {
      tx.senderId = (sender.address + 'ABC') as Address;
      await expect(instance.verify(tx, sender, 1)).to.be.rejectedWith(
        'Invalid sender address'
      );
    });

    it('should call txType.calculateFee and throw if fee is lower', async () => {
      // Returned value different from fee in tx (tx.fee is 10)
      calculateMinFeeStub.returns(11);
      await expect(instance.verify(tx, sender, 1)).to.be.rejectedWith(
        'Invalid transaction fee'
      );
      expect(calculateMinFeeStub.calledOnce).to.be.true;
      expect(calculateMinFeeStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(calculateMinFeeStub.firstCall.args[1]).to.be.deep.equal(sender);
      expect(calculateMinFeeStub.firstCall.args[2]).to.be.equal(1);
    });

    it('should throw if amount is < 0', async () => {
      tx.amount = -100n;
      tx.id = idsHandler.calcTxIdFromBytes(txBytes.fullBytes(tx));
      await expect(instance.verify(tx, sender, 1)).to.be.rejectedWith(
        'tx.amount is either negative or greater than totalAmount'
      );
    });

    // TODO: verifySignature
    // it('should reject tx if verifySignature throws (for whatever reason', async () => {
    //   verifySignatureStub.throws(new Error('whatever'));
    //
    //   await expect(instance.verify(tx, sender, 1)).to.rejectedWith('whatever');
    // });

    it('should call checkBalance and throw if checkBalance returns an error', async () => {
      checkBalanceStub.throws(new Error('checkBalance error'));
      await expect(instance.verify(tx, sender, 1)).to.be.rejectedWith(
        'checkBalance error'
      );
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
    //   await instance.verify(tx, sender, 1);
    //   expect(slotsStub.stubs.getSlotNumber.calledTwice).to.be.true;
    //   expect(slotsStub.stubs.getSlotNumber.firstCall.args[0]).to.be.equal(tx.timestamp);
    // });
    //
    // it('should throw if timestamp is in the future', async () => {
    //   slotsStub.stubs.getSlotNumber.onCall(0).returns(1000000);
    //   slotsStub.stubs.getSlotNumber.onCall(1).returns(10);
    //   await expect(instance.verify(tx, sender, 1))
    //     .to.be.rejectedWith('Invalid transaction timestamp. Timestamp is in the future');
    // });

    it('should await verify from the txType', async () => {
      await instance.verify(tx, sender, 1);
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
        await instance.verify(tx, sender, 1);
        expect(staticCheck.calledOnce).is.true;
        expect(staticCheck.firstCall.args).deep.eq([tx, sender, 1]);

        staticCheck.resetHistory();
        staticCheck.rejects(new Error('m sorry'));
        await expect(instance.verify(tx, sender, 1)).rejectedWith('m sorry');
      });
      it('call action verify/tx and with proper data and honor throws', async () => {
        await instance.verify(tx, sender, 1);
        expect(verifyStub.calledOnce).is.true;
        expect(verifyStub.firstCall.args).deep.eq([tx, sender, 1]);

        verifyStub.resetHistory();
        verifyStub.rejects(new Error('m sorry'));
        await expect(instance.verify(tx, sender, 1)).rejectedWith('m sorry');
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
        .returns(void 0);
      getHashStub = sandbox.stub(instance, 'getHash').returns(theHash);
    });

    it('should call assertKnownTransactionType', () => {
      instance.verifySignature(tx, account.publicKey, tx.signatures[0]);
      expect(akttStub.calledOnce).to.be.true;
      expect(akttStub.firstCall.args[0]).to.be.deep.equal(tx.type);
    });

    it('should call ed.verify', () => {
      const edStub = sandbox.stub(cryptoImpl, 'verify').returns(true);
      instance.verifySignature(tx, account.publicKey, tx.signatures[0]);
      expect(edStub.calledOnce).to.be.true;
      expect(edStub.firstCall.args[0]).to.be.deep.equal(theHash);
      expect(edStub.firstCall.args[1]).to.be.deep.equal(tx.signatures[0]);
      expect(edStub.firstCall.args[2]).to.be.deep.equal(account.publicKey);
    });
    describe('verificationType', () => {
      it('should call getHash with false, false when VerificationType is ALL', () => {
        instance.verifySignature(tx, account.publicKey, tx.signatures[0]);
        expect(getHashStub.calledOnce).to.be.true;
        expect(getHashStub.firstCall.args[0]).to.be.deep.equal(tx);
      });
    });
    it('should call false if signature is null', () => {
      expect(instance.verifySignature(tx, account.publicKey, null)).to.be.false;
    });
  });

  describe('apply', () => {
    let readyStub: SinonStub;
    let assertEnoughBalance: SinonStub;
    let txTypeApplyStub: SinonStub;
    let block: SignedBlockType;

    beforeEach(() => {
      // instance stubs
      readyStub = sandbox.stub(instance, 'ready').resolves(true);
      assertEnoughBalance = sandbox
        .stub(instance, 'assertEnoughBalance')
        .returns({ exceeded: false } as any);
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
      expect(assertEnoughBalance.calledOnce).to.be.true;
      const expectedAmount = BigInt(tx.amount) + BigInt(tx.fee);
      expect(assertEnoughBalance.firstCall.args[0]).to.be.deep.equal(
        expectedAmount
      );
      expect(assertEnoughBalance.firstCall.args[1]).to.be.equal('balance');
      expect(assertEnoughBalance.firstCall.args[2]).to.be.deep.equal(tx);
      expect(assertEnoughBalance.firstCall.args[3]).to.be.deep.equal(sender);
    });

    it('should throw if checkBalance returns an error', async () => {
      assertEnoughBalance.throws(new Error('checkBalance error'));
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
        balance: -108910891000010n,
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
        balance: 108910891000010n,
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
      sender.u_balance = BigInt(tx.amount) * 2n;
    });

    it('should check unconfirmed balance', async () => {
      sender.u_balance = 1000000n;
      // tslint:disable-next-line
      tx.amount = 1000000n - 1n;
      await expect(instance.applyUnconfirmed(tx as any, sender)).rejectedWith(
        'Account does not have enough currency: rise1qx0h9eama8m0v9kak8gjply3fy8mx00dqj65f9zjs30m2eq5sp6s7zaszq4 balance: 1000000 - 1000009'
      );
    });

    it('should call accountLogic.merge', async () => {
      const aMStub = sandbox.stub(accountLogic, 'merge').returns([]);
      await instance.applyUnconfirmed(tx as any, sender);
      expect(aMStub.calledOnce).to.be.true;
      expect(aMStub.firstCall.args[0]).to.be.equal(sender.address);
      expect(aMStub.firstCall.args[1]).to.be.deep.equal({
        u_balance: -108910891000010n,
      });
    });

    it('should call applyUnconfirmed from the txTypes', async () => {
      await instance.applyUnconfirmed(tx as any, sender);
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
        u_balance: 108910891000010n,
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
        .returns(void 0);
      txTypeDbSaveStub = sandbox
        .stub(sendTransaction, 'dbSave')
        .returns({ table: 'table', fields: [], values: [] } as any);
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
    //
    // it('should return the correct first object', () => {
    //   tx.requesterPublicKey = sender.publicKey;
    //   const retVal = instance.dbSave([tx as any], '11', 100);
    //   expect(retVal[0].model).to.be.deep.eq(txModel);
    //   expect(retVal[0].type).to.be.deep.eq('bulkCreate');
    //   expect((retVal[0] as DBBulkCreateOp<any>).values[0]).to.be.deep.eq({
    //     amount: BigInt(tx.amount),
    //     blockId: '11',
    //     fee: BigInt(tx.fee),
    //     height: 100,
    //     id: tx.id,
    //     recipientId: tx.recipientId || null,
    //     requesterPublicKey: tx.requesterPublicKey,
    //     senderId: tx.senderId,
    //     senderPublicKey: tx.senderPublicKey,
    //     signSignature: null,
    //     signature: tx.signature,
    //     signatures: tx.signatures ? tx.signatures.join(',') : null,
    //     timestamp: tx.timestamp,
    //     type: tx.type,
    //   });
    // });

    it('should cluster multiple txs together in single bulkCreate and append sub assets db ops', () => {
      (instance as any).types[2] = new DummyTxType();

      const txs = [
        createSendTransaction(account, '1R' as Address, 10, { amount: 1 }),
        createSendTransaction(account, '1R' as Address, 11, { amount: 1 }),
        {
          ...createSendTransaction(account, '1R' as Address, 10, { amount: 1 }),
          type: 2,
        },
        {
          ...createSendTransaction(account, '1R' as Address, 10, { amount: 1 }),
          type: 2,
        },
      ]
        .map((t) => toNativeTx(t))
        .map((t) => ({ ...t, senderId: t.recipientId }));
      const retVal = instance.dbSave(txs, '11', 100);
      expect(retVal[0].model).to.be.deep.eq(txModel);
      expect(retVal[0].type).to.be.deep.eq('bulkCreate');
      const op: DBBulkCreateOp<any> = retVal[0] as any;
      expect(op.values).to.be.an('array');
      for (let i = 0; i < txs.length; i++) {
        const expectedValue = {
          ...txs[i],
          amount: BigInt(txs[i].amount),
          fee: BigInt(txs[i].fee),
          blockId: '11',
          height: 100,
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
        .returns(void 0);
      txTypeAfterSaveStub = sandbox
        .stub(sendTransaction, 'afterSave')
        .resolves('txType aftersave');
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
        .resolves(true);
      txTypeObjectNormalizeStub = sandbox
        .stub(sendTransaction, 'objectNormalize')
        .returns('txType objectNormalize' as any);
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
      expect(retVal.signatures).to.be.deep.equal(tx.signatures);
      expect((retVal as any).nullItem).to.be.undefined;
      expect((retVal as any).undefinedItem).to.be.undefined;
    });

    // it('should call objectNormalize from the txType and return the result of execution', () => {
    //   const retVal = instance.objectNormalize(tx);
    //   expect(txTypeObjectNormalizeStub.calledOnce).to.be.true;
    //   const dpassedTx = { ...tx };
    //   delete dpassedTx.requesterPublicKey;
    //   delete dpassedTx.signSignature;
    //   delete dpassedTx.signatures;
    //   expect(txTypeObjectNormalizeStub.firstCall.args[0]).to.be.deep.equal(
    //     dpassedTx
    //   );
    //   expect(retVal).to.be.equal('txType objectNormalize');
    // });

    describe('with real schema validation', () => {
      beforeEach(() => {
        (instance as any).types[0] = sendTransaction;
      });
      it('valid', () => {
        instance.objectNormalize(tx);
      });

      ['signatures'].forEach((sig) => {
        it(`should validate ${sig}`, () => {
          // wrong length or buf string
          tx[sig] = [Buffer.alloc(32)];
          expect(() => instance.objectNormalize(tx)).to.throw(
            'format signatureBuf'
          );
          tx[sig] = [Buffer.alloc(32).toString('hex') as any];
          expect(() => instance.objectNormalize(tx)).to.throw(
            'format signatureBuf'
          );
          tx[sig] = ['hey' as any];
          expect(() => instance.objectNormalize(tx)).to.throw(
            'format signatureBuf'
          );

          // valid as string
          tx[sig] = [Buffer.alloc(64).toString('hex') as any];
          instance.objectNormalize(tx);
        });
      });
      it('signature field is mandatory', () => {
        delete tx.signatures;
        expect(() => instance.objectNormalize(tx)).to.throw();
        tx.signatures = null;
        expect(() => instance.objectNormalize(tx)).to.throw();
        tx.signatures = [];
        expect(() => instance.objectNormalize(tx)).to.throw();
      });

      ['senderPubData'].forEach((pk) => {
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
      it('senderPubData is mandatory', () => {
        delete tx.senderPubData;
        expect(() => instance.objectNormalize(tx)).to.throw();
        tx.senderPubData = null;
        expect(() => instance.objectNormalize(tx)).to.throw();
        tx.senderPubData = '' as any;
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
          tx[field] = -1n;
          expect(() => instance.objectNormalize(tx)).to.throw(
            `tx.${field} is either negative or greater than totalAmount`
          );
          tx[field] = 10999999991000000n + 10000n;
          expect(() => instance.objectNormalize(tx)).to.throw(
            `tx.${field} is either negative or greater than totalAmount`
          );
        });
      });
    });
  });
});
