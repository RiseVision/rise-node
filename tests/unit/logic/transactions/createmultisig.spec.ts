'use strict';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy } from 'sinon';
import { TransactionType } from '../../../../src/helpers';
import { MultiSignatureTransaction } from '../../../../src/logic/transactions';
import {
  AccountLogicStub, AccountsModuleStub, ByteBufferStub, RoundsLogicStub, SystemModuleStub,
  TransactionLogicStub, ZSchemaStub
} from '../../../stubs';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');

const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

const rewiredMultiSignatureTransaction = rewire('../../../../src/logic/transactions/createmultisig');

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

  let instance: MultiSignatureTransaction;
  let tx: any;
  let sender: any;
  let block: any;

  beforeEach(() => {
    sandbox              = sinon.sandbox.create();
    socketIOStub         = {
      sockets: {
        emit: sandbox.stub(),
      },
    };
    zSchemaStub          = new ZSchemaStub();
    accountLogicStub     = new AccountLogicStub();
    transactionLogicStub = new TransactionLogicStub();
    accountsModuleStub   = new AccountsModuleStub();
    systemModuleStub     = new SystemModuleStub();
    roundsLogicStub      = new RoundsLogicStub();

    tx = {
      asset          : {
        multisignature: {
          min      : 2,
          lifetime : 33,
          keysgroup: ['+key1', '+key2'],
        },
      },
      type           : TransactionType.MULTI,
      amount         : 0,
      fee            : 10,
      timestamp      : 0,
      recipientId    : '15256762582730568272R',
      senderId       : '1233456789012345R',
      senderPublicKey: '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3',
      signatures     : ['sig1', 'sig2'],
      id             : '8139741256612355994',
    };

    sender = {
      balance  : 10000000,
      address  : '1233456789012345R',
      publicKey: '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3',
    };

    block = {
      height: 8797,
      id    : '13191140260435645922',
    };

    instance = new rewiredMultiSignatureTransaction.MultiSignatureTransaction();

    (instance as any).io               = socketIOStub;
    (instance as any).schema           = zSchemaStub;
    (instance as any).accountLogic     = accountLogicStub;
    (instance as any).transactionLogic = transactionLogicStub;
    (instance as any).roundsLogic      = roundsLogicStub;
    (instance as any).accountsModule   = accountsModuleStub;
    (instance as any).systemModule     = systemModuleStub;

    return systemModuleStub.stubs.getFees.returns({ fees: { multisignature: 123 } });
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.reset();
  });

  describe('calculateFee', () => {
    it('should call systemModule.getFees', () => {
      instance.calculateFee(tx, sender, block.height);
      expect(systemModuleStub.stubs.getFees.calledOnce).to.be.true;
      expect(systemModuleStub.stubs.getFees.firstCall.args[0]).to.be.equal(block.height);
    });
  });

  describe('getBytes', () => {
    const originalByteBuffer = rewiredMultiSignatureTransaction.__get__('ByteBuffer');
    const expectedBuffer     = Buffer.from('');
    let byteBufferStub: ByteBufferStub;
    let bbStubCreator;

    beforeEach(() => {
      byteBufferStub = new ByteBufferStub();
      byteBufferStub.stubs.toBuffer.returns(expectedBuffer);
      const creatorFn = (capacity?: number, littleEndian?: boolean, noAssert?: boolean) => {
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
      };
      bbStubCreator   = sandbox.spy(creatorFn);
      rewiredMultiSignatureTransaction.__set__('ByteBuffer', bbStubCreator);
    });

    afterEach(() => {
      rewiredMultiSignatureTransaction.__set__('ByteBuffer', originalByteBuffer);
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
      expect(bbStubCreator.calledOnce).to.be.true;
      expect(bbStubCreator.firstCall.args[0]).to.be.at.least(2);
      expect(bbStubCreator.firstCall.args[1]).to.be.true;
    });

    it('should write bytes to bytebuffer', () => {
      instance.getBytes(tx, false, false);
      expect(byteBufferStub.spies.writeByte.called).to.be.true;
      expect(byteBufferStub.sequence[0]).to.be.equal(tx.asset.multisignature.min);
      expect(byteBufferStub.sequence[1]).to.be.equal(tx.asset.multisignature.lifetime);
      expect(byteBufferStub.spies.flip.calledOnce).to.be.true;
    });

    it('should call toBuffer and return a Buffer', () => {
      const retVal = instance.getBytes(tx, false, false);
      expect(byteBufferStub.stubs.toBuffer.calledOnce).to.be.true;
      expect(retVal).to.be.deep.equal(expectedBuffer);
    });
  });

  describe('verify', () => {
    beforeEach(() => {
      transactionLogicStub.stubConfig.verifySignature.return = true;
    });

    it('should throw when !tx.asset || !tx.asset.multisignature', async () => {
      delete tx.asset.multisignature;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
      delete tx.asset;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
    });

    it('should throw when asset.multisignature.keygroup is not an array', async () => {
      tx.asset.multisignature.keysgroup = null;
      await expect(instance.verify(tx, sender)).to.be.
      rejectedWith('Invalid multisignature keysgroup. Must be an array');
    });

    it('should throw when asset.multisignature.keygroup is empty', async () => {
      tx.asset.multisignature.keysgroup = [];
      await expect(instance.verify(tx, sender)).to.be.
      rejectedWith('Invalid multisignature keysgroup. Must not be empty');
    });

    it('should throw when min and max are incompatible with constants', async () => {
      tx.asset.multisignature.min = -1;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(/Invalid multisignature min. Must be between/);
    });

    it('should throw when min is more than keysgroup length', async () => {
      tx.asset.multisignature.min = tx.asset.multisignature.keysgroup.length + 1;
      await expect(instance.verify(tx, sender)).to.be.
      rejectedWith('Invalid multisignature min. Must be less than or equal to keysgroup size');
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
      delete tx.recipientId;
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
    });

    it('should throw if signature verification fails', async () => {
      transactionLogicStub.stubConfig.verifySignature.return = false;
      await expect(instance.verify(tx, sender)).to.be.
      rejectedWith('Failed to verify signature in multisignature keysgroup');
    });

    it('should throw if keysgroup contains the sender', async () => {
      tx.asset.multisignature.keysgroup[0] = '+' + sender.publicKey;
      await expect(instance.verify(tx, sender)).to.be.
      rejectedWith('Invalid multisignature keysgroup. Cannot contain sender');
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
      tx.asset.multisignature.keysgroup[0] = '-key1';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid math operator in multisignature keysgroup');
    });

    it('should call schema.validate on the pubKey', async () => {
      zSchemaStub.stubConfig.validate.return = true;
      await instance.verify(tx, sender);
      expect(zSchemaStub.stubs.validate.callCount).to.be.equal(tx.asset.multisignature.keysgroup.length);
      expect(zSchemaStub.stubs.validate.firstCall.args[0]).to.be.
      equal(tx.asset.multisignature.keysgroup[0].substring(1));
      expect(zSchemaStub.stubs.validate.firstCall.args[1]).to.be.deep.equal({ format: 'publicKey' });
    });

    it('should throw if pubKey is invalid', async () => {
      zSchemaStub.stubConfig.validate.return = false;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid publicKey in multisignature keysgroup');
    });

    it('should throw if duplicate pubKey is found', async () => {
      tx.asset.multisignature.keysgroup[1] = tx.asset.multisignature.keysgroup[0];
      await expect(instance.verify(tx, sender)).to.be.
      rejectedWith('Encountered duplicate public key in multisignature keysgroup');
    });

    it('should resolve on successful execution', async () => {
      await expect(instance.verify(tx, sender)).to.be.fulfilled;
    });
  });

  describe('apply', () => {
    beforeEach(() => {
      accountLogicStub.stubs.merge.resolves();
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
      expect(accountLogicStub.stubs.generateAddressByPublicKey.callCount).to.be.
      equal(tx.asset.multisignature.keysgroup.length);
      expect(accountLogicStub.stubs.generateAddressByPublicKey.firstCall.args[0]).to.be.
      equal(tx.asset.multisignature.keysgroup[0].substring(1));
    });

    it('should call accountsModule.setAccountAndGet for each key', async () => {
      await instance.apply(tx, block, sender);
      expect(accountsModuleStub.stubs.setAccountAndGet.callCount).to.be.equal(tx.asset.multisignature.keysgroup.length);
      expect(accountsModuleStub.stubs.setAccountAndGet.firstCall.args[0]).to.be.deep.equal({
        address  : '123123124125R',
        publicKey: tx.asset.multisignature.keysgroup[0].substring(1),
      });
    });
  });

  describe('undo', () => {
    let rewiredHelpers;
    let reverseSpy: SinonSpy;

    beforeEach(() => {
      accountLogicStub.stubs.merge.returns(true);
      roundsLogicStub.stubs.calcRound.returns(123);
      accountLogicStub.stubs.generateAddressByPublicKey.returns('123123124125R');
      accountsModuleStub.stubs.setAccountAndGet.resolves();
      rewiredHelpers = rewiredMultiSignatureTransaction.__get__('_1');
      reverseSpy     = sandbox.spy(rewiredHelpers.Diff, 'reverse');
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
      expect(() => {
        instance.applyUnconfirmed(tx, sender);
      }).to.throw('Signature on this account is pending confirmation');
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
    let rewiredHelpers;
    let reverseSpy: SinonSpy;

    beforeEach(() => {
      accountLogicStub.stubs.merge.returns(true);
      rewiredHelpers = rewiredMultiSignatureTransaction.__get__('_1');
      reverseSpy     = sandbox.spy(rewiredHelpers.Diff, 'reverse');
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
    beforeEach(() => {
      zSchemaStub.stubConfig.validate.return = true;
    });

    it('should call schema.validate', () => {
      instance.objectNormalize(tx);
      expect(zSchemaStub.stubs.validate.calledOnce).to.be.true;
      expect(zSchemaStub.stubs.validate.firstCall.args[0]).to.be.deep.equal(tx.asset.multisignature);
    });

    it('should throw if validation fails', () => {
      zSchemaStub.stubConfig.validate.return = false;
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Failed to validate multisignature schema/);
    });

    it('should return the tx', () => {
      zSchemaStub.stubConfig.validate.return = true;
      const retVal                           = instance.objectNormalize(tx);
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
      expect(instance.dbSave(tx)).to.be.deep.equal({ table: 'multisignatures',
        fields: [ 'min', 'lifetime', 'keysgroup', 'transactionId' ],
        values:
          { min: 2,
            lifetime: 33,
            keysgroup: '+key1,+key2',
            transactionId: '8139741256612355994' } }
      );
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
      tx.signatures = [];
      expect(instance.ready(tx, sender)).to.be.false;
    });

    it('return false if no sender.multisignatures and signatures arrays lengths are not the same', () => {
      sender.multisignatures = ['1', '2', '3'];
      tx.signatures = ['1', '2'];
      expect(instance.ready(tx, sender)).to.be.false;
    });

    it('return true if no sender.multisignatures and signatures arrays lengths are the same', () => {
      // precondition is already there
      expect(instance.ready(tx, sender)).to.be.true;
    });

    it('return true if tx.signatures are more or equal to the sender.multimin', () => {
      tx.signatures = ['1', '2', '3'];
      sender.multimin = 2;
      expect(instance.ready(tx, sender)).to.be.false;
    });
  });
});
