'use strict';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { removeEmptyObjKeys, TransactionType } from '../../../../src/helpers';
import { RegisterDelegateTransaction } from '../../../../src/logic/transactions';
import delegateSchema from '../../../../src/schema/logic/transactions/delegate';
import { AccountsModuleStub, SystemModuleStub } from '../../../stubs';

const expect = chai.expect;
chai.use(chaiAsPromised);

const rewiredRegisterDelegateTransaction = rewire('../../../../src/logic/transactions/delegate');

// tslint:disable no-unused-expression
describe('logic/transactions/delegate', () => {
  let sandbox: SinonSandbox;
  let zSchemaStub: any;
  let accountsModuleStub: AccountsModuleStub;
  let systemModuleStub: SystemModuleStub;

  let instance: RegisterDelegateTransaction;
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
        delegate: {
          username : 'topdelegate',
          publicKey: 'a2bac0a1525e9605a37e6c6588716f9c941530c74eabdf0b27b10b3817e58fe3',
          address  : '74128139741256612355994R',
        },
      },
      type           : TransactionType.DELEGATE,
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

    instance = new rewiredRegisterDelegateTransaction.RegisterDelegateTransaction();

    (instance as any).schema         = zSchemaStub;
    (instance as any).accountsModule = accountsModuleStub;
    (instance as any).systemModule   = systemModuleStub;

    systemModuleStub.stubs.getFees.returns({ fees: { delegate: 2500 } });
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
    it('should return null if no username', () => {
      delete tx.asset.delegate.username;
      const retVal = instance.getBytes(tx, false, false);
      expect(retVal).to.be.null;
    });

    it('should call Buffer.from', () => {
      const fromSpy = sandbox.spy(Buffer, 'from');
      instance.getBytes(tx, false, false);
      expect(fromSpy.calledOnce).to.be.true;
      expect(fromSpy.firstCall.args[0]).to.be.equal(tx.asset.delegate.username);
      expect(fromSpy.firstCall.args[1]).to.be.equal('utf8');
    });

    it('should return a Buffer', () => {
      const retVal = instance.getBytes(tx, false, false);
      expect(retVal).to.be.deep.equal(Buffer.from(tx.asset.delegate.username, 'utf8'));
    });
  });

  describe('verify', () => {
    beforeEach(() => {
      zSchemaStub.validate.onFirstCall().returns(false);
      zSchemaStub.validate.onSecondCall().returns(true);
      accountsModuleStub.stubs.getAccount.resolves(null);
    });

    it('should throw when tx.recipientId', async () => {
      tx.recipientId = 'recipient';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid recipient');
    });

    it('should throw when amount != 0', async () => {
      tx.amount = 100;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should throw when sender is delegate already', async () => {
      sender.isDelegate = true;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Account is already a delegate');
    });

    it('should throw when no tx.asset or tx.asset.delegate', async () => {
      delete tx.asset.delegate;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
      delete tx.asset;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
    });

    it('should throw when no username', async () => {
      delete tx.asset.delegate.username;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Username is undefined');
    });

    it('should throw when username is not lowercase', async () => {
      tx.asset.delegate.username = 'TopDelegate';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Username must be lowercase');
    });

    it('should call String.toLowercase.trim', async () => {
      const toLowercaseSpy = sandbox.spy(String.prototype, 'toLowerCase');
      const trimSpy        = sandbox.spy(String.prototype, 'trim');
      await instance.verify(tx, sender);
      expect(toLowercaseSpy.calledTwice).to.be.true;
      expect(trimSpy.calledOnce).to.be.true;
      toLowercaseSpy.restore();
      trimSpy.restore();
    });

    it('should throw when trimmed username is empty string', async () => {
      tx.asset.delegate.username = '    ';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Empty username');
    });

    it('should throw when username is more than 20 chars long', async () => {
      tx.asset.delegate.username = 'abcdefghijklmnopqrstuvwxyz';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Username is too long. Maximum is 20 characters');
    });

    it('should throw when username is a possible address', async () => {
      zSchemaStub.validate.onFirstCall().returns(true);
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Username can not be a potential address');
      expect(zSchemaStub.validate.calledOnce).to.be.true;
      expect(zSchemaStub.validate.firstCall.args[0]).to.be.equal(tx.asset.delegate.username);
      expect(zSchemaStub.validate.firstCall.args[1].format).to.be.equal('address');
    });

    it('should throw if zschema does not validate the username', async () => {
      // First call needs false to avoid throwing, second is false to force throwing
      zSchemaStub.validate.onFirstCall().returns(false);
      zSchemaStub.validate.onSecondCall().returns(false);
      await expect(instance.verify(tx, sender)).to.be.
        rejectedWith('Username can only contain alphanumeric characters with the exception of !@$&_.');
      expect(zSchemaStub.validate.secondCall.args[0]).to.be.equal(tx.asset.delegate.username);
      expect(zSchemaStub.validate.secondCall.args[1].format).to.be.equal('username');
    });

    it('should call accountsModule.getAccount and throw if account is found', async () => {
      accountsModuleStub.stubs.getAccount.resolves({ the: 'account' });
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(/Username already exists:/);
      expect(accountsModuleStub.stubs.getAccount.calledOnce).to.be.true;
      expect(accountsModuleStub.stubs.getAccount.firstCall.args[0].username).to.be.equal(tx.asset.delegate.username);
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
        address     : sender.address,
        isDelegate  : 1,
        u_isDelegate: 0,
        vote        : 0,
        u_username  : null,
        username    : tx.asset.delegate.username,
      });
    });

    it('should throw an error', () => {
      sender.isDelegate = 1;
      expect(() => instance.apply(tx, block, sender)).to.throw('Account is already a delegate');
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
        address     : sender.address,
        isDelegate  : 0,
        u_isDelegate: 1,
        vote        : 0,
        u_username  : tx.asset.delegate.username,
        username    : null,
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
        address     : sender.address,
        isDelegate  : 0,
        u_isDelegate: 1,
        username    : null,
        u_username  : tx.asset.delegate.username,
      });
    });

    it('should throw an error', () => {
      sender.u_isDelegate = 1;
      expect(() => instance.applyUnconfirmed(tx, sender)).to.throw('Account is already trying to be a delegate');

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
        address     : sender.address,
        isDelegate  : 0,
        u_isDelegate: 0,
        username    : null,
        u_username  : null,
      });
    });
  });

  describe('objectNormalize', () => {
    beforeEach(() => {
      zSchemaStub.validate.returns(true);
    });

    it('should call removeEmptyObjKeys', () => {
      const helpers               = rewiredRegisterDelegateTransaction.__get__('_1');
      const removeEmptyObjKeysSpy = sandbox.spy(helpers, 'removeEmptyObjKeys');
      instance.objectNormalize(tx);
      expect(removeEmptyObjKeysSpy.calledOnce).to.be.true;
      expect(removeEmptyObjKeysSpy.firstCall.args[0]).to.be.deep.equal(tx.asset.delegate);
      removeEmptyObjKeysSpy.restore();
    });

    it('should call schema.validate', () => {
      instance.objectNormalize(tx);
      expect(zSchemaStub.validate.calledOnce).to.be.true;
      expect(zSchemaStub.validate.firstCall.args[0]).to.be.deep.equal(tx.asset.delegate);
      expect(zSchemaStub.validate.firstCall.args[1]).to.be.deep.equal(delegateSchema);
    });

    it('should throw if validation fails', () => {
      zSchemaStub.validate.returns(false);
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Failed to validate delegate schema/);
    });

    it('should throw with errors message if validation fails', () => {
      (instance as any).schema.getLastErrors = () => [{message: '1'}, {message: '2'}];
      zSchemaStub.validate.returns(false);
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw('Failed to validate delegate schema: 1, 2');
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

    it('should return the delegate object', () => {
      const retVal = instance.dbRead({
        d_username       : 'thebestdelegate',
        t_senderPublicKey: 'pubKey',
        t_senderId       : 'address',
      });
      expect(retVal).to.be.deep.equal({
        delegate: {
          username : 'thebestdelegate',
          publicKey: 'pubKey',
          address  : 'address',
        },
      });
    });
  });

  describe('dbSave', () => {
    it('should return the expected object', () => {
      expect(instance.dbSave(tx)).to.be.deep.equal({
          table : 'delegates',
          fields: ['username', 'transactionId'],
          values: {
            username     : tx.asset.delegate.username,
            transactionId: tx.id,
          },
        }
      );
    });
  });
});
