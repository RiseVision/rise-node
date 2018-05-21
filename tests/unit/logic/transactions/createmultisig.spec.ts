'use strict';
import * as ByteBuffer from 'bytebuffer';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import * as helpers from '../../../../src/helpers';
import { TransactionType } from '../../../../src/helpers';
import { Symbols } from '../../../../src/ioc/symbols';
import { MultiSignatureTransaction } from '../../../../src/logic/transactions';
import {
  AccountLogicStub, AccountsModuleStub, RoundsLogicStub, SystemModuleStub,
  TransactionLogicStub, ZSchemaStub
} from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';
import { AccountsModel, MultiSignaturesModel } from '../../../../src/models';
import { DBCreateOp } from '../../../../src/types/genericTypes';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');

const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('logic/transactions/createmultisig', () => {
  let sandbox: SinonSandbox;
  let socketIOStub: any;
  let zSchemaStub: ZSchemaStub;
  let accountLogicStub: AccountLogicStub;
  let transactionLogicStub: TransactionLogicStub;
  let roundsLogicStub: RoundsLogicStub;
  let accountsModuleStub: AccountsModuleStub;
  let systemModuleStub: SystemModuleStub;
  let accountsModel: typeof AccountsModel;
  let multisigModel: typeof MultiSignaturesModel;
  let instance: MultiSignatureTransaction;
  let tx: any;
  let sender: any;
  let block: any;
  let container: Container;

  beforeEach(() => {
    sandbox              = sinon.sandbox.create();
    container            = createContainer();
    accountsModel = container.get(Symbols.models.accounts);
    multisigModel = container.get(Symbols.models.multisignatures);
    socketIOStub         = {
      sockets: {
        emit: sandbox.stub(),
      },
    };
    zSchemaStub          = container.get(Symbols.generic.zschema);
    accountLogicStub     = container.get(Symbols.logic.account);
    transactionLogicStub = container.get(Symbols.logic.transaction);
    accountsModuleStub   = container.get(Symbols.modules.accounts);
    systemModuleStub     = container.get(Symbols.modules.system);
    roundsLogicStub      = container.get(Symbols.logic.rounds);

    tx = {
      amount         : 0,
      asset          : {
        multisignature: {
          keysgroup: ['+' + new Array(64).fill('a').join(''), '+' + new Array(64).fill('b').join('')],
          lifetime : 33,
          min      : 2,
        },
      },
      fee            : 10,
      id             : '8139741256612355994',
      senderId       : '1233456789012345R',
      senderPublicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
      signatures     : ['sig1', 'sig2'],
      timestamp      : 0,
      type           : TransactionType.MULTI,
    };

    sender = {
      address  : '1233456789012345R',
      balance  : 10000000,
      publicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
      isMultisignature() {
        return false;
      },
    };

    block = {
      height: 8797,
      id    : '13191140260435645922',
    };

    container.rebind(Symbols.logic.transactions.createmultisig).to(MultiSignatureTransaction).inSingletonScope();
    instance = container.get(Symbols.logic.transactions.createmultisig);
    (instance as any).io = socketIOStub;
    systemModuleStub.stubs.getFees.returns({fees: {multisignature: 123}});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('calculateFee', () => {
    it('should call systemModule.getFees', () => {
      instance.calculateFee(tx, sender, block.height);
      expect(systemModuleStub.stubs.getFees.calledOnce).to.be.true;
      expect(systemModuleStub.stubs.getFees.firstCall.args[0]).to.be.equal(block.height);
    });
  });

  describe('getBytes', () => {
    const expectedBuffer = Buffer.from('');
    let sequence: any[];
    let lastBB: any;
    const toRestore      = {} as any;

    before(() => {
      toRestore.writeByte = ByteBuffer.prototype.writeByte;
      toRestore.writeInt  = ByteBuffer.prototype.writeInt;
      toRestore.writeLong = (ByteBuffer.prototype as any).writeLong;
      toRestore.toBuffer  = ByteBuffer.prototype.toBuffer;
      toRestore.flip      = ByteBuffer.prototype.flip;
    });
    beforeEach(() => {
      lastBB                                  = false;
      sequence                                = [];
      (ByteBuffer.prototype as any).writeByte = function (b) {
        sequence.push(b);
        lastBB = this;
      };
      ByteBuffer.prototype.toBuffer           = sandbox.stub().returns(expectedBuffer);
      ByteBuffer.prototype.flip               = sandbox.stub();
    });

    after(() => {
      (ByteBuffer.prototype as any).writeByte = toRestore.writeByte;
      (ByteBuffer.prototype as any).writeInt  = toRestore.writeInt;
      (ByteBuffer.prototype as any).writeLong = toRestore.writeLong;
      ByteBuffer.prototype.flip               = toRestore.flip;
      ByteBuffer.prototype.toBuffer           = toRestore.toBuffer;
    });

    it('should call Buffer.from', () => {
      const fromSpy = sandbox.spy(Buffer, 'from');
      instance.getBytes(tx, false, false);
      expect(fromSpy.calledOnce).to.be.true;
      expect(fromSpy.firstCall.args[0]).to.be.equal(tx.asset.multisignature.keysgroup.join(''));
      expect(fromSpy.firstCall.args[1]).to.be.equal('utf8');
    });

    it('should create a ByteBuffer', () => {
      instance.getBytes(tx, false, false);
      expect(lastBB).to.be.instanceof(ByteBuffer);
    });

    it('should write bytes to bytebuffer', () => {
      instance.getBytes(tx, false, false);
      expect(sequence[0]).to.be.equal(tx.asset.multisignature.min);
      expect(sequence[1]).to.be.equal(tx.asset.multisignature.lifetime);
      expect(lastBB.flip.calledOnce).to.be.true;
    });

    it('should call toBuffer and return a Buffer', () => {
      const retVal = instance.getBytes(tx, false, false);
      expect(lastBB.toBuffer.calledOnce).to.be.true;
      expect(retVal).to.be.deep.equal(expectedBuffer);
    });
  });

  describe('verify', () => {
    beforeEach(() => {
      transactionLogicStub.enqueueResponse('verifySignature', true);
      transactionLogicStub.enqueueResponse('verifySignature', true);
    });

    it('should throw when !tx.asset || !tx.asset.multisignature', async () => {
      delete tx.asset.multisignature;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
      delete tx.asset;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
    });

    it('should throw when asset.multisignature.keygroup is not an array', async () => {
      tx.asset.multisignature.keysgroup = null;
      // tslint:disable max-line-length
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid multisignature keysgroup. Must be an array');
    });

    it('should throw when asset.multisignature.keygroup is empty', async () => {
      tx.asset.multisignature.keysgroup = [];
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid multisignature keysgroup. Must not be empty');
    });

    it('should throw when min and max are incompatible with constants', async () => {
      tx.asset.multisignature.min = -1;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(/Invalid multisignature min. Must be between/);
    });

    it('should throw when min is more than keysgroup length', async () => {
      tx.asset.multisignature.min = tx.asset.multisignature.keysgroup.length + 1;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid multisignature min. Must be less than or equal to keysgroup size');
    });

    it('should throw when lifetime is incompatible with constants', async () => {
      tx.asset.multisignature.lifetime = 12312312313;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(/Invalid multisignature lifetime./);
    });

    it('should throw when account has multisig enabled', async () => {
      sender.multisignatures = ['senderSig1', 'senderSig2'];
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Account already has multisignatures enabled');
    });

    it('should throw when recipientId is invalid', async () => {
      tx.recipientId = '15256762582730568272R';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid recipient');
    });

    it('should throw when amount is invalid', async () => {
      tx.amount = 100;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should call transactionLogic.verifySignature on all signatures and keys', async () => {
      const readySpy = sandbox.spy(instance, 'ready');
      await instance.verify(tx, sender);
      expect(readySpy.calledOnce).to.be.true;
    });

    it('should call transactionLogic.verifySignature on all signatures and keys', async () => {
      await instance.verify(tx, sender);
      expect(transactionLogicStub.stubs.verifySignature.called).to.be.true;
      expect(transactionLogicStub.stubs.verifySignature.callCount).to.be.eq(2);
    });

    it('should throw if signature verification fails', async () => {
      transactionLogicStub.reset();
      transactionLogicStub.enqueueResponse('verifySignature', false);
      transactionLogicStub.enqueueResponse('verifySignature', false);
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Failed to verify signature in multisignature keysgroup');
    });

    it('should throw if keysgroup contains the sender', async () => {
      tx.asset.multisignature.keysgroup[0] = '+' + sender.publicKey.toString('hex');
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid multisignature keysgroup. Cannot contain sender');
    });

    it('should throw if keysgroup contains an invalid key', async () => {
      // We make ready() return false so that we can skip another branch where it would throw because of invalid key
      sandbox.stub(instance, 'ready').returns(false);
      tx.asset.multisignature.keysgroup[0] = {};
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid member in keysgroup');
    });

    it('should throw if wrong math operator in keysgroup', async () => {
      // We make ready() return false so that we can skip another branch where it would throw for invalid keysgroup
      sandbox.stub(instance, 'ready').returns(false);
      tx.asset.multisignature.keysgroup[0] = '-' + tx.asset.multisignature.keysgroup[0].substr(1);
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid math operator in multisignature keysgroup');
    });

    it('should call schema.validate on the pubKey', async () => {
      zSchemaStub.enqueueResponse('validate', true);
      await instance.verify(tx, sender);
      expect(zSchemaStub.stubs.validate.callCount).to.be.equal(tx.asset.multisignature.keysgroup.length);
      expect(zSchemaStub.stubs.validate.firstCall.args[0]).to.be.equal(tx.asset.multisignature.keysgroup[0].substring(1));
      expect(zSchemaStub.stubs.validate.firstCall.args[1]).to.be.deep.equal({format: 'publicKey'});
    });

    it('should throw if pubKey is invalid', async () => {
      zSchemaStub.enqueueResponse('validate', false);
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid publicKey in multisignature keysgroup');
    });

    it('should throw if duplicate pubKey is found', async () => {
      tx.asset.multisignature.keysgroup[1] = tx.asset.multisignature.keysgroup[0];
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Encountered duplicate public key in multisignature keysgroup');
    });

    it('should resolve on successful execution', async () => {
      await expect(instance.verify(tx, sender)).to.be.fulfilled;
    });
  });

  describe('apply', () => {
    beforeEach(() => {
      accountLogicStub.stubs.merge.returns([]);
      roundsLogicStub.stubs.calcRound.returns(123);
      accountLogicStub.stubs.generateAddressByPublicKey.returns('123123124125R');
      accountsModuleStub.stubs.setAccountAndGet.resolves();
    });

    it('should call accountLogic.merge', async () => {
      await instance.apply(tx, block, sender);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        blockId        : block.id,
        multilifetime  : tx.asset.multisignature.lifetime,
        multimin       : tx.asset.multisignature.min,
        multisignatures: tx.asset.multisignature.keysgroup,
        round          : 123,
      });
    });

    it('should call roundsLogic.calcRound', async () => {
      await instance.apply(tx, block, sender);
      expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(block.height);
    });

    it('should call accountLogic.generateAddressByPublicKey for each key', async () => {
      await instance.apply(tx, block, sender);
      expect(accountLogicStub.stubs.generateAddressByPublicKey.callCount).to.be.equal(tx.asset.multisignature.keysgroup.length);
      expect(accountLogicStub.stubs.generateAddressByPublicKey.firstCall.args[0]).to.be.equal(tx.asset.multisignature.keysgroup[0].substring(1));
    });
    it('should create AccountsModel upsert operations for each key', async () => {
      const res = await instance.apply(tx, block, sender);
      expect(res.length).to.be.gte(2);
      expect(res[res.length - 1].type).eq('upsert');
      expect(res[res.length - 2].type).eq('upsert');
      expect(res[res.length - 1].model).is.deep.eq(accountsModel);
      expect(res[res.length - 2].model).is.deep.eq(accountsModel);
      expect((res[res.length - 2] as DBCreateOp<any>).values).is.deep.eq({
        address  : '123123124125R',
        publicKey: Buffer.from(tx.asset.multisignature.keysgroup[0].substr(1), 'hex')
      });
      expect((res[res.length - 1] as DBCreateOp<any>).values).is.deep.eq({
        address  : '123123124125R',
        publicKey: Buffer.from(tx.asset.multisignature.keysgroup[1].substr(1), 'hex')
      });
    });
  });

  describe('undo', () => {
    let reverseSpy: SinonSpy;

    beforeEach(() => {
      accountLogicStub.stubs.merge.returns(true);
      roundsLogicStub.stubs.calcRound.returns(123);
      accountLogicStub.stubs.generateAddressByPublicKey.returns('123123124125R');
      accountsModuleStub.stubs.setAccountAndGet.resolves();
      reverseSpy = sandbox.spy(helpers.Diff, 'reverse');
    });

    afterEach(() => {
      reverseSpy.restore();
    });

    it('should call Diff.reverse', async () => {
      await instance.undo(tx, block, sender);
      expect(reverseSpy.calledOnce).to.be.true;
      expect(reverseSpy.firstCall.args[0]).to.be.equalTo(tx.asset.multisignature.keysgroup);
    });

    it('should set unconfirmedSignatures[sender.address] to true', async () => {
      await instance.undo(tx, block, sender);
      expect((instance as any).unconfirmedSignatures[sender.address]).to.be.true;
    });

    it('should call accountLogic.merge', async () => {
      await instance.undo(tx, block, sender);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        blockId        : block.id,
        multilifetime  : -tx.asset.multisignature.lifetime,
        multimin       : -tx.asset.multisignature.min,
        multisignatures: tx.asset.multisignature.keysgroup.map((a) => a.replace('+', '-')),
        round          : 123,
      });
    });

    it('should call roundsLogic.calcRound', async () => {
      await instance.undo(tx, block, sender);
      expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(block.height);
    });
  });

  describe('applyUnconfirmed', () => {
    beforeEach(() => {
      accountLogicStub.stubs.merge.returns(true);
    });

    it('should throw if signature is not confirmed yet', () => {
      (instance as any).unconfirmedSignatures[sender.address] = true;
      expect(instance.applyUnconfirmed(tx, sender)).to.be.rejectedWith('Signature on this account is pending confirmation');
    });

    it('should call accountLogic.merge', async () => {
      await instance.applyUnconfirmed(tx, sender);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        u_multilifetime  : tx.asset.multisignature.lifetime,
        u_multimin       : tx.asset.multisignature.min,
        u_multisignatures: tx.asset.multisignature.keysgroup,
      });
    });
  });

  describe('undoUnconfirmed', () => {
    let reverseSpy: SinonSpy;

    beforeEach(() => {
      accountLogicStub.stubs.merge.returns(true);
      reverseSpy = sandbox.spy(helpers.Diff, 'reverse');
    });

    afterEach(() => {
      reverseSpy.restore();
    });

    it('should call Diff.reverse', async () => {
      await instance.undoUnconfirmed(tx, sender);
      expect(reverseSpy.calledOnce).to.be.true;
      expect(reverseSpy.firstCall.args[0]).to.be.equalTo(tx.asset.multisignature.keysgroup);
    });

    it('should delete unconfirmedSignatures[sender.address]', async () => {
      await instance.undoUnconfirmed(tx, sender);
      expect((instance as any).unconfirmedSignatures[sender.address]).to.be.undefined;
    });

    it('should call accountLogic.merge', async () => {
      await instance.undoUnconfirmed(tx, sender);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        u_multilifetime  : -tx.asset.multisignature.lifetime,
        u_multimin       : -tx.asset.multisignature.min,
        u_multisignatures: tx.asset.multisignature.keysgroup.map((a) => a.replace('+', '-')),
      });
    });
  });

  describe('objectNormalize', () => {

    it('should call schema.validate', () => {
      instance.objectNormalize(tx);
      expect(zSchemaStub.stubs.validate.calledOnce).to.be.true;
      expect(zSchemaStub.stubs.validate.firstCall.args[0]).to.be.deep.equal(tx.asset.multisignature);
    });

    it('should throw if validation fails', () => {
      zSchemaStub.enqueueResponse('validate', false);
      zSchemaStub.enqueueResponse('getLastErrors', []);

      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Failed to validate multisignature schema/);
    });

    it('should throw with errors message if validation fails', () => {
      zSchemaStub.enqueueResponse('validate', false);
      zSchemaStub.enqueueResponse('getLastErrors', [{message: '1'}, {message: '2'}]);
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw('Failed to validate multisignature schema: 1, 2');
    });

    it('should return the tx', () => {
      zSchemaStub.enqueueResponse('validate', true);
      const retVal = instance.objectNormalize(tx);
      expect(retVal).to.be.deep.equal(tx);
    });
  });

  describe('dbRead', () => {
    it('should return null if !m_keysgroup', () => {
      const retVal = instance.dbRead({});
      expect(retVal).to.be.null;
    });

    it('should return the multisignature object', () => {
      const retVal = instance.dbRead({
        m_keysgroup: 'key1,key2',
        m_lifetime : 10,
        m_min      : 2,
      });
      expect(retVal).to.be.deep.equal(
        {
          multisignature: {
            keysgroup: [
              'key1',
              'key2',
            ],
            lifetime : 10,
            min      : 2,
          },
        });
    });
  });

  describe('dbSave', () => {
    it('should return the expected object', () => {
      const saveOp = instance.dbSave(tx);
      expect(saveOp.type).is.eq('create');
      expect(saveOp.values).is.deep.eq({
        keysgroup    : '+aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,+bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        lifetime     : 33,
        min          : 2,
        transactionId: '8139741256612355994',
      });
      expect(saveOp.model).is.deep.eq(multisigModel);
    });
  });

  describe('afterSave', () => {
    it('should emit on the socket and resolve', async () => {
      await instance.afterSave(tx);
      expect(socketIOStub.sockets.emit.calledOnce).to.be.true;
      expect(socketIOStub.sockets.emit.firstCall.args[0]).to.be.equal('multisignatures/change');
      expect(socketIOStub.sockets.emit.firstCall.args[1]).to.be.deep.equal(tx);
    });
  });

  describe('ready', () => {
    it('return false if tx.signatures is not an array', () => {
      tx.signatures = {};
      expect(instance.ready(tx, sender)).to.be.false;
    });

    it('return false if no sender.multisignatures and signatures arrays lengths are not the same', () => {
      sender.multisignatures = ['1', '2', '3'];
      tx.signatures          = ['1', '2'];
      expect(instance.ready(tx, sender)).to.be.false;
    });

    it('return true if no sender.multisignatures and signatures arrays lengths are the same', () => {
      // precondition is already there
      expect(instance.ready(tx, sender)).to.be.true;
    });

    it('return true if tx.signatures are more or equal to the sender.multimin', () => {
      tx.signatures   = ['1', '2', '3'];
      sender.multimin = 2;
      expect(instance.ready(tx, sender)).to.be.false;
    });
  });
});
