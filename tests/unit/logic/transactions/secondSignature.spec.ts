'use strict';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { TransactionType } from '../../../../src/helpers';
import { SecondSignatureTransaction } from '../../../../src/logic/transactions';
import secondSignatureSchema from '../../../../src/schema/logic/transactions/secondSignature';
import { AccountsModuleStub, SystemModuleStub } from '../../../stubs';

const expect = chai.expect;
chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('logic/transactions/secondSignature', () => {
  let sandbox: SinonSandbox;
  let zSchemaStub: any;
  let accountsModuleStub: AccountsModuleStub;
  let systemModuleStub: SystemModuleStub;

  let instance: SecondSignatureTransaction;
  let tx: any;
  let sender: any;
  let block: any;

  beforeEach(() => {
    sandbox            = sinon.sandbox.create();
    zSchemaStub        = {
      validate     : sandbox.stub(),
      getLastErrors: () => [],
    };
    accountsModuleStub = new AccountsModuleStub();
    systemModuleStub   = new SystemModuleStub();

    tx = {
      asset          : {
        signature: {
          publicKey: 'a2bac0a1525e9605a37e6c6588716f9c941530c74eabdf0b27b10b3817e58fe3',
        },
      },
      type           : TransactionType.SIGNATURE,
      amount         : 0,
      fee            : 10,
      timestamp      : 0,
      senderId       : '1233456789012345R',
      senderPublicKey: '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3',
      signature      : '0a1525e9605a37e6c6588716f9c9a2bac41530c74e3817e58fe3abdf0b27b10b' +
      'a2bac0a1525e9605a37e6c6588716f9c7b10b3817e58fe3941530c74eabdf0b2',
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

    instance = new SecondSignatureTransaction();

    (instance as any).schema         = zSchemaStub;
    (instance as any).accountsModule = accountsModuleStub;
    (instance as any).systemModule   = systemModuleStub;

    systemModuleStub.stubs.getFees.returns({ fees: { secondsignature: 1000 } });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('calculateFee', () => {
    it('should call systemModule.getFees', () => {
      const retVal = instance.calculateFee(tx, sender, block.height);
      expect(systemModuleStub.stubs.getFees.calledOnce).to.be.true;
      expect(systemModuleStub.stubs.getFees.firstCall.args[0]).to.be.equal(block.height);
      expect(retVal).to.be.equal(1000);
    });
  });

  describe('getBytes', () => {
    it('should call Buffer.from', () => {
      const fromSpy = sandbox.spy(Buffer, 'from');
      instance.getBytes(tx, false, false);
      expect(fromSpy.calledOnce).to.be.true;
      expect(fromSpy.firstCall.args[0]).to.be.equal(tx.asset.signature.publicKey);
      expect(fromSpy.firstCall.args[1]).to.be.equal('hex');
      fromSpy.restore();
    });

    it('should return a Buffer', () => {
      const retVal = instance.getBytes(tx, false, false);
      expect(retVal).to.be.deep.equal(Buffer.from(tx.asset.signature.publicKey, 'hex'));
    });
  });

  describe('verify', () => {
    beforeEach(() => {
      zSchemaStub.validate.returns(true);
    });

    it('should throw when no tx.asset or tx.asset.signature', async () => {
      delete tx.asset.signature;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
      delete tx.asset;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
    });

    it('should throw when tx.recipientId', async () => {
      tx.recipientId = 'recipient';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid recipient');
    });

    it('should throw when amount is not zero', async () => {
      tx.amount = 1;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should throw when no publicKey', async () => {
      delete tx.asset.signature.publicKey;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid public key');
    });

    it('should call zschema.validate and throw if it does not validate', async () => {
      zSchemaStub.validate.returns(false);
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid public key');
      expect(zSchemaStub.validate.calledOnce).to.be.true;
      expect(zSchemaStub.validate.firstCall.args[0]).to.be.equal(tx.asset.signature.publicKey);
      expect(zSchemaStub.validate.firstCall.args[1]).to.be.deep.equal({ format: 'publicKey' });
    });
  });

  describe('apply', () => {
    beforeEach(() => {
      accountsModuleStub.stubs.setAccountAndGet.resolves();
    });

    it('should call accountsModule.setAccountAndGet and return a promise', async () => {
      const retVal = instance.apply(tx, block, sender);
      expect(retVal).to.be.instanceOf(Promise);
      await retVal;
      expect(accountsModuleStub.stubs.setAccountAndGet.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.setAccountAndGet.firstCall.args[0]).to.be.deep.equal({
        address          : sender.address,
        secondPublicKey  : tx.asset.signature.publicKey,
        secondSignature  : 1,
        u_secondSignature: 0,
      });
    });
  });

  describe('undo', () => {
    beforeEach(() => {
      accountsModuleStub.stubs.setAccountAndGet.resolves();
    });

    it('should call accountsModule.setAccountAndGet and return a promise', async () => {
      const retVal = instance.undo(tx, block, sender);
      expect(retVal).to.be.instanceOf(Promise);
      await retVal;
      expect(accountsModuleStub.stubs.setAccountAndGet.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.setAccountAndGet.firstCall.args[0]).to.be.deep.equal({
        address          : sender.address,
        secondPublicKey  : null,
        secondSignature  : 0,
        u_secondSignature: 1,
      });
    });
  });

  describe('applyUnconfirmed', () => {
    beforeEach(() => {
      accountsModuleStub.stubs.setAccountAndGet.resolves();
    });

    it('should call accountsModule.setAccountAndGet and return a promise', async () => {
      const retVal = instance.applyUnconfirmed(tx, sender);
      expect(retVal).to.be.instanceOf(Promise);
      await retVal;
      expect(accountsModuleStub.stubs.setAccountAndGet.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.setAccountAndGet.firstCall.args[0]).to.be.deep.equal({
        address          : sender.address,
        u_secondSignature: 1,
      });
    });
    it('should reject if sender.u_secondSignature', async () => {
      sender.u_secondSignature = 1;
      await expect(instance.applyUnconfirmed(tx, sender)).to.be.rejectedWith('Second signature already enabled');
    });

    it('should reject if sender.secondSignature', async () => {
      sender.secondSignature = 1;
      await expect(instance.applyUnconfirmed(tx, sender)).to.be.rejectedWith('Second signature already enabled');
    });

  });

  describe('undoUnconfirmed', () => {
    beforeEach(() => {
      accountsModuleStub.stubs.setAccountAndGet.resolves();
    });

    it('should call accountsModule.setAccountAndGet and return a promise', async () => {
      const retVal = instance.undoUnconfirmed(tx, sender);
      expect(retVal).to.be.instanceOf(Promise);
      await retVal;
      expect(accountsModuleStub.stubs.setAccountAndGet.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.setAccountAndGet.firstCall.args[0]).to.be.deep.equal({
        address          : sender.address,
        u_secondSignature: 0,
      });
    });
  });

  describe('objectNormalize', () => {
    beforeEach(() => {
      zSchemaStub.validate.returns(true);
    });

    it('should call schema.validate', () => {
      instance.objectNormalize(tx);
      expect(zSchemaStub.validate.calledOnce).to.be.true;
      expect(zSchemaStub.validate.firstCall.args[0]).to.be.deep.equal(tx.asset.signature);
      expect(zSchemaStub.validate.firstCall.args[1]).to.be.deep.equal(secondSignatureSchema);
    });

    it('should throw if validation fails', () => {
      zSchemaStub.validate.returns(false);
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Failed to validate signature schema/);
    });

    it('should throw with errors message if validation fails', () => {
      (instance as any).schema.getLastErrors = () => [{message: '1'}, {message: '2'}];
      zSchemaStub.validate.returns(false);
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw('Failed to validate signature schema: 1, 2');
    });

    it('should return the tx', () => {
      const retVal = instance.objectNormalize(tx);
      expect(retVal).to.be.deep.equal(tx);
    });
  });

  describe('dbRead', () => {
    it('should return null if !d_username', () => {
      const retVal = instance.dbRead({});
      expect(retVal).to.be.null;
    });

    it('should return the signature object', () => {
      const retVal = instance.dbRead({
        s_publicKey: 's_publicKey',
      });
      expect(retVal).to.be.deep.equal({
        signature: {
          publicKey: 's_publicKey',
        },
      });
    });
  });

  describe('dbSave', () => {
    it('should return the expected object', () => {
      expect(instance.dbSave(tx)).to.be.deep.equal({
          table : 'signatures',
          fields: ['publicKey', 'transactionId'],
          values: {
            publicKey    : Buffer.from(tx.asset.signature.publicKey, 'hex'),
            transactionId: tx.id,
          },
        }
      );
    });
  });
});
