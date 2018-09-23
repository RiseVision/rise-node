import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { IAccountsModule, ISequence, ITransactionLogic, IInnerTXQueue } from '@risevision/core-interfaces';
import SocketIO from 'socket.io';
import { MultiSignatureTransaction } from '../../src/transaction';
import { InnerTXQueue } from '@risevision/core-transactions/dist/poolTXsQueue';
import { IBaseTransaction, TransactionType } from '@risevision/core-types';
import { MultisignaturesModule } from '../../src/multisignatures';
import { IAccountsModel, ITransactionsModule, Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { AccountsModelWithMultisig } from '../../src/models/AccountsModelWithMultisig';
import { LiskWallet } from 'dpos-offline';
import { MultisigSymbols } from '../../src/helpers';
import { TXSymbols } from '@risevision/core-transactions/dist/';
import { MultisigTransportModule } from '../../src/transport';
import { ITransactionPool } from '../../../core-interfaces/src/logic';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/multisignatures', () => {
  let instance: MultisignaturesModule;
  let container: Container;
  let sandbox: SinonSandbox;
  let tx: IBaseTransaction<any>;
  let sender: any;
  let signature: Buffer;

  let accountsModule: IAccountsModule;
  let sequence: ISequence;
  let socketIO: SocketIO.Server;
  let transactionLogic: ITransactionLogic;
  let multisigTx: MultiSignatureTransaction;
  let transactionPool: ITransactionPool;
  let pendingQueue: IInnerTXQueue<any>;

  let AccountsModel: typeof AccountsModelWithMultisig;

  let getAccountStub: SinonStub;

  before(async () => {
    container = await createContainer(['core-multisignature', 'core', 'core-helpers']);

  });

  beforeEach(() => {
    sandbox            = sinon.createSandbox();
    AccountsModel      = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    instance           = container.get(MultisigSymbols.module);
    accountsModule     = container.get(Symbols.modules.accounts);
    transactionLogic   = container.get(Symbols.logic.transaction);
    transactionPool    = container.get(Symbols.logic.txpool);
    pendingQueue       = transactionPool.pending;
    socketIO           = container.get(Symbols.generic.socketIO);
    // busStub                = container.get(Symbols.helpers.bus);
    // tslint:disable-next-line: max-line-length
    sequence       = container.getNamed(Symbols.helpers.sequence, Symbols.names.helpers.balancesSequence);
    multisigTx     = container.getNamed(TXSymbols.transaction, MultisigSymbols.tx);
    tx             = {
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
      type           : TransactionType.MULTI,
    };
    signature      = Buffer.from('72d33c7dd285d84c5e6c984b10c4141e9ff8fbf9b8433bf1bbea971dc8b14c67' +
      'e98b55898d982b3d5b9ba56ace902b910e05f8bd897083a7d1ca1d5028703e03', 'hex');
    sender         = new AccountsModel({
      address        : '1233456789012345R',
      balance        : 10000000,
      publicKey      : Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
      multisignatures: [
        Buffer.from(new LiskWallet('meeow').publicKey, 'hex'),
        Buffer.from(new LiskWallet('meeow2').publicKey, 'hex'),
      ],
      multilifetime: 24

    }  as any);

    getAccountStub = sandbox.stub(accountsModule, 'getAccount').resolves(sender);

  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('processSignature', () => {
    let processMultisigTxStub: SinonStub;
    let processNormalTxStub: SinonStub;
    let txReadyStub: SinonStub;
    let getPendingTXStub: SinonStub;
    let getPayloadStub: SinonStub;
    let hasPendingTX: SinonStub;
    beforeEach(() => {
      getPendingTXStub = sandbox.stub(pendingQueue, 'get').returns({tx});
      hasPendingTX = sandbox.stub(pendingQueue, 'has').returns(true);

      // transactionsModule.enqueueResponse('getMultisignatureTransaction', tx);
      // transactionsModule.enqueueResponse('getMultisignatureTransaction', tx);
      processMultisigTxStub = sandbox.stub(instance as any, 'processMultiSigSignature').resolves();
      processNormalTxStub   = sandbox.stub(instance as any, 'processNormalTxSignature').resolves();
      txReadyStub           = sandbox.stub(multisigTx as any, 'ready').returns(true);
      getPayloadStub        = sandbox.stub(pendingQueue, 'getPayload').returns({ });
    });

    it('should call transactionsModule.getMultisignatureTransaction', async () => {
      await instance.onNewSignature({ signature, transaction: tx.id , relays: 1});
      expect(getPendingTXStub.called).to.be.true;
      expect(getPendingTXStub.firstCall.args[0]).to.be.equal(tx.id);
    });

    it('should throw if transactionsModule.getMultisignatureTransaction returns false', async () => {
      // transactionsModule.enqueueResponse('getMultisignatureTransaction', false);
      hasPendingTX.returns(false);
      await expect(instance.onNewSignature({
        signature,
        transaction: tx.id, relays: 1,
      })).to.be.rejectedWith('Transaction not found');
    });

    it('should set tx.signatures to [] if TransactionType is MULTI and tx.signatures is not set', async () => {
      delete tx.signatures;
      await instance.onNewSignature({ signature, transaction: tx.id , relays: 1});
      expect(processMultisigTxStub.calledOnce).to.be.true;
      // Our first arg is the modified tx
      expect(Array.isArray(processMultisigTxStub.firstCall.args[0].signatures)).to.be.true;
      expect(processMultisigTxStub.firstCall.args[0].signatures.length).to.be.equal(1);
    });

    it('should call processMultiSigSignature if TransactionType is MULTI', async () => {
      tx.type = TransactionType.MULTI;
      await instance.onNewSignature({ signature, transaction: tx.id , relays: 1});
      expect(processMultisigTxStub.calledOnce).to.be.true;
      expect(processNormalTxStub.notCalled).to.be.true;
      expect(processMultisigTxStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(processMultisigTxStub.firstCall.args[1]).to.be.deep.equal(signature);
    });

    it('should call processNormalTxSignature if TransactionType is NOT MULTI', async () => {
      tx.type = TransactionType.SEND;
      await instance.onNewSignature({ signature, transaction: tx.id , relays: 1});
      expect(processNormalTxStub.calledOnce).to.be.true;
      expect(processMultisigTxStub.notCalled).to.be.true;
      expect(processNormalTxStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(processNormalTxStub.firstCall.args[1]).to.be.deep.equal(signature);
    });

    it('should call balancesSequence.addAndPromise with a worker', async () => {
      const spy = sandbox.spy(sequence, 'addAndPromise');
      await instance.onNewSignature({ signature, transaction: tx.id , relays: 1});
      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.args[0]).to.be.a('function');
    });

    it('should call accountsModule.getAccount (in worker)', async () => {
      await instance.onNewSignature({ signature, transaction: tx.id , relays: 1});
      expect(getAccountStub.calledOnce).to.be.true;
      expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({ address: tx.senderId });
    });

    it('should throw if accountsModule.getAccount returns falsey (in worker)', async () => {
      getAccountStub.returns(false);
      await expect(instance.onNewSignature({ signature, transaction: tx.id , relays: 1})).to.be.rejectedWith('Sender not found');
    });
    //
    // it('should call multisigTransport.onSignature with proper data', async () => {
    //   const transport = container.get<MultisigTransportModule>(MultisigSymbols.multiSigTransport);
    //   const stub = sandbox.stub(transport, 'onSignature');
    //   await instance.processSignature({ signature, transaction: tx.id , relays: 1});
    //   expect(stub.calledOnce).to.be.true;
    //   expect(stub.firstCall.args[0]).to.be.deep.equal({ transaction: tx.id, relays: 1, signature });
    //   expect(stub.firstCall.args[1]).to.be.true;
    // });

    it('Throw: Cannot find payload for such multisig tx', async () => {
      getPayloadStub.returns(false);
      await expect(instance.onNewSignature({
        signature,
        transaction: tx.id, relays: 1,
      })).to.be.rejectedWith('Cannot find payload for such multisig tx');
    });
  });

  describe('processNormalTxSignature', () => {
    let existingSigner: string;
    let verifySignStub: SinonStub;
    beforeEach(() => {
      getAccountStub.resolves(sender);
      verifySignStub         = sandbox.stub(transactionLogic, 'verifySignature').returns(true);
      existingSigner         = tx.senderPublicKey.toString('hex').split('').reverse().join('');
      sender.multisignatures = [existingSigner];
    });

    it('should add the senderPublicKey to tx.multisignatures if tx.requesterPublicKey', async () => {
      tx.requesterPublicKey = Buffer.from('pubkey');
      await (instance as any).processNormalTxSignature(tx, signature, sender);
      expect(Array.isArray(sender.multisignatures)).to.be.true;
      expect(sender.multisignatures.length).to.be.equal(2);
      expect(sender.multisignatures[0]).to.be.equal(existingSigner);
      expect(sender.multisignatures[1]).to.be.equal(tx.senderPublicKey.toString('hex'));
    });

    it('should throw if passed signature is already in tx.signatures', async () => {
      tx.signatures = [signature];
      await expect((instance as any).processNormalTxSignature(tx, signature, sender)).to.be
        .rejectedWith('Signature already exists');
    });

    it('should call transactionLogic.verifySignature until publicKey that verifies is found', async () => {
      tx.requesterPublicKey = Buffer.from('reqPubKey');
      // In this case, tx.senderpublicKey verifies the passed signature
      // transactionLogic.reset();
      verifySignStub.onCall(0).returns(false);
      verifySignStub.onCall(1).returns(false);
      verifySignStub.onCall(2).returns(true);
      sender.multisignatures = ['aa', 'bb']; // tx.senderPublicKey is added...
      await (instance as any).processNormalTxSignature(tx, signature, sender);
      expect(verifySignStub.callCount).to.be.equal(3);
      expect(verifySignStub.getCall(0).args[0]).to.be.deep.equal(tx);
      expect(verifySignStub.getCall(0).args[1]).to.be.deep.equal(Buffer.from(sender.multisignatures[0], 'hex'));
      expect(verifySignStub.getCall(0).args[2]).to.be.deep.equal(signature);
      expect(verifySignStub.getCall(1).args[0]).to.be.deep.equal(tx);
      expect(verifySignStub.getCall(1).args[1]).to.be.deep.equal(Buffer.from(sender.multisignatures[1], 'hex'));
      expect(verifySignStub.getCall(1).args[2]).to.be.deep.equal(signature);
      expect(verifySignStub.getCall(2).args[0]).to.be.deep.equal(tx);
      expect(verifySignStub.getCall(2).args[1]).to.be.deep.equal(tx.senderPublicKey);
      expect(verifySignStub.getCall(2).args[2]).to.be.deep.equal(signature);
    });

    it('should throw if no publicKey verifying the signature is found', async () => {
      // transactionLogic.reset();
      verifySignStub.onCall(0).returns(false);
      verifySignStub.onCall(1).returns(false);
      sender.multisignatures = ['doesnotVerify1', 'doesnotVerify2'];
      await expect((instance as any).processNormalTxSignature(tx, signature, sender)).to.be
        .rejectedWith('Failed to verify signature');
    });

    // it('should call call io.sockets.emit', async () => {
    //   const emitStub = sandbox.stub(socketIO.sockets, 'emit');
    //   await (instance as any).processNormalTxSignature(tx, signature, sender);
    //   expect(emitStub.calledOnce).to.be.true;
    //   expect(emitStub.firstCall.args[0]).to.be.equal('multisignatures/signature/change');
    //   expect(emitStub.firstCall.args[1]).to.be.deep.equal(tx);
    // });
  });

  describe('processMultisigSignature', () => {
    let verifySignStub: SinonStub;

    beforeEach(() => {
      tx.signatures           = [];
      tx.asset.multisignature = {};
      verifySignStub          = sandbox.stub(transactionLogic, 'verifySignature').returns(true);
    });

    it('should throw if tx already has the multisignature.signatures asset', async () => {
      tx.asset.multisignature.signatures = [];
      await expect((instance as any).processMultiSigSignature(tx, signature, sender)).to.be
        .rejectedWith('Permission to sign transaction denied');
    });

    it('should throw if tx.signatures already contains the passed signature', async () => {
      tx.signatures = [signature];
      await expect((instance as any).processMultiSigSignature(tx, signature, sender)).to.be
        .rejectedWith('Permission to sign transaction denied');
    });

    it('should call transactionLogic.verifySignature until publicKey that verifies is found', async () => {
      // In this case, tx.senderpublicKey verifies the passed signature
      // transactionLogic.reset();
      verifySignStub.onCall(0).returns(false);
      verifySignStub.onCall(1).returns(true);
      tx.asset.multisignature.keysgroup = ['+aa', '+bb'];
      await (instance as any).processMultiSigSignature(tx, signature, sender);
      expect(verifySignStub.callCount).to.be.equal(2);
      expect(verifySignStub.getCall(0).args[0]).to.be.deep.equal(tx);
      expect(verifySignStub.getCall(0).args[1]).to.be.deep
        .equal(Buffer.from(tx.asset.multisignature.keysgroup[0].substring(1), 'hex'));
      expect(verifySignStub.getCall(0).args[2]).to.be.deep.equal(signature);
      expect(verifySignStub.getCall(1).args[0]).to.be.deep.equal(tx);
      expect(verifySignStub.getCall(1).args[1]).to.be.deep
        .equal(Buffer.from(tx.asset.multisignature.keysgroup[1].substring(1), 'hex'));
      expect(verifySignStub.getCall(1).args[2]).to.be.deep.equal(signature);
    });

    it('should throw if one or more signatures are not verified', async () => {
      // transactionLogic.reset();
      verifySignStub.onCall(0).returns(false);
      verifySignStub.onCall(1).returns(false);
      sender.isMultisignature           = () => false;
      tx.asset.multisignature.keysgroup = ['+aa', '+bb'];
      await expect((instance as any).processMultiSigSignature(tx, signature, sender)).to.be
        .rejectedWith('Failed to verify signature');
    });
  });

});
