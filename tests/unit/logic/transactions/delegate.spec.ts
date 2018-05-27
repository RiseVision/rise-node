'use strict';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {Container} from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import * as helpers from '../../../../src/helpers';
import { TransactionType } from '../../../../src/helpers';
import {Symbols} from '../../../../src/ioc/symbols';
import { RegisterDelegateTransaction } from '../../../../src/logic/transactions';
import delegateSchema from '../../../../src/schema/logic/transactions/delegate';
import { AccountsModuleStub, SystemModuleStub, ZSchemaStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';
import { DBUpdateOp } from '../../../../src/types/genericTypes';
import { AccountsModel, DelegatesModel } from '../../../../src/models/';

const expect = chai.expect;
chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('logic/transactions/delegate', () => {
  let sandbox: SinonSandbox;
  let zSchemaStub: ZSchemaStub;
  let accountsModuleStub: AccountsModuleStub;
  let systemModuleStub: SystemModuleStub;
  let container: Container;
  let instance: RegisterDelegateTransaction;
  let accountsModel: typeof AccountsModel;
  let delegatesModel: typeof DelegatesModel;
  let tx: any;
  let sender: any;
  let block: any;

  beforeEach(() => {
    sandbox            = sinon.createSandbox();
    container          = createContainer();
    accountsModel      = container.get(Symbols.models.accounts);
    delegatesModel      = container.get(Symbols.models.delegates);
    zSchemaStub        = container.get(Symbols.generic.zschema);
    accountsModuleStub = container.get(Symbols.modules.accounts);
    systemModuleStub   = container.get(Symbols.modules.system);
    zSchemaStub.enqueueResponse('getLastErrors', []);
    tx = {
      amount         : 0,
      asset          : {
        delegate: {
          address  : '74128139741256612355994R',
          publicKey: Buffer.from('a2bac0a1525e9605a37e6c6588716f9c941530c74eabdf0b27b10b3817e58fe3', 'hex'),
          username : 'topdelegate',
        },
      },
      fee            : 10,
      id             : '8139741256612355994',
      senderId       : '1233456789012345R',
      senderPublicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
      signature      : Buffer.from('0a1525e9605a37e6c6588716f9c9a2bac41530c74e3817e58fe3abdf0b27b10b' +
      'a2bac0a1525e9605a37e6c6588716f9c7b10b3817e58fe3941530c74eabdf0b2', 'hex'),
      timestamp      : 0,
      type           : TransactionType.DELEGATE,
    };

    sender = {
      address  : '1233456789012345R',
      balance  : 10000000,
      publicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
      isMultisignature() {
        return false;
      }
    };

    block = {
      height: 8797,
      id    : '13191140260435645922',
    };

    container.rebind(Symbols.logic.transactions.delegate).to(RegisterDelegateTransaction).inSingletonScope();
    instance = container.get(Symbols.logic.transactions.delegate);

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
      zSchemaStub.stubs.validate.onFirstCall().returns(false);
      zSchemaStub.stubs.validate.onSecondCall().returns(true);
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

    it('should throw when username is a possible address - given param should be uppercased', async () => {
      zSchemaStub.stubs.validate.onFirstCall().returns(true);
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Username can not be a potential address');
      expect(zSchemaStub.stubs.validate.calledOnce).to.be.true;
      expect(zSchemaStub.stubs.validate.firstCall.args[0]).to.be.equal(tx.asset.delegate.username.toUpperCase());
      expect(zSchemaStub.stubs.validate.firstCall.args[1].format).to.be.equal('address');
    });

    it('should throw if zschema does not validate the username', async () => {
      // First call needs false to avoid throwing, second is false to force throwing
      zSchemaStub.stubs.validate.onFirstCall().returns(false);
      zSchemaStub.stubs.validate.onSecondCall().returns(false);
      await expect(instance.verify(tx, sender)).to.be.
        rejectedWith('Username can only contain alphanumeric characters with the exception of !@$&_.');
      expect(zSchemaStub.stubs.validate.secondCall.args[0]).to.be.equal(tx.asset.delegate.username);
      expect(zSchemaStub.stubs.validate.secondCall.args[1].format).to.be.equal('username');
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

    it('should return a DBUpdateOp', async () => {
      const retVal = await instance.apply(tx, block, sender);
      expect(retVal.length).is.eq(1);
      const op: DBUpdateOp<any> = retVal[0] as any;
      expect(op.type).is.eq('update');
      expect(op.model).is.deep.eq(accountsModel);
      expect(op.values).is.deep.eq({
        isDelegate  : 1,
        u_isDelegate: 0,
        vote        : 0,
        username    : tx.asset.delegate.username,
        u_username  : null,
      });
      expect(op.options).to.be.deep.eq({
        where: {
          address: sender.address
        }
      });
    });

    it('should throw an error', async () => {
      sender.isDelegate = 1;
      expect(instance.apply(tx, block, sender)).to.be.rejectedWith('Account is already a delegate');
    });
  });

  describe('undo', () => {
    beforeEach(() => {
      accountsModuleStub.stubs.setAccountAndGet.resolves();
    });

    it('should return a DBUpdateOp', async () => {
      const retVal = await instance.undo(tx, block, sender);
      expect(retVal.length).is.eq(1);
      const op: DBUpdateOp<any> = retVal[0] as any;
      expect(op.type).is.eq('update');
      expect(op.model).is.deep.eq(accountsModel);
      expect(op.values).is.deep.eq({
        isDelegate  : 0,
        u_isDelegate: 1,
        vote        : 0,
        username    : null,
        u_username  : tx.asset.delegate.username,
      });

      expect(op.options).to.be.deep.eq({
        where: {
          address: sender.address
        }
      });
    });
  });

  describe('applyUnconfirmed', () => {
    beforeEach(() => {
      accountsModuleStub.stubs.setAccountAndGet.resolves();
    });

    it('should return a DBUpdateOp', async () => {
      const retVal = await instance.applyUnconfirmed(tx, sender);
      expect(retVal.length).is.eq(1);
      const op: DBUpdateOp<any> = retVal[0] as any;
      expect(op.type).is.eq('update');
      expect(op.model).is.deep.eq(accountsModel);
      expect(op.values).is.deep.eq({
        isDelegate  : 0,
        u_isDelegate: 1,
        u_username    : tx.asset.delegate.username,
        username  : null,
      });

      expect(op.options).to.be.deep.eq({
        where: {
          address: sender.address
        }
      });
    });

    it('should throw an error', async () => {
      sender.u_isDelegate = 1;
      await expect(instance.applyUnconfirmed(tx, sender)).to.rejectedWith('Account is already trying to be a delegate');

    });
  });

  describe('undoUnconfirmed', () => {
    beforeEach(() => {
      accountsModuleStub.stubs.setAccountAndGet.resolves();
    });

    it('should return a DBUpdateOp', async () => {
      const retVal = await instance.undoUnconfirmed(tx, sender);
      expect(retVal.length).is.eq(1);
      const op: DBUpdateOp<any> = retVal[0] as any;
      expect(op.type).is.eq('update');
      expect(op.model).is.deep.eq(accountsModel);
      expect(op.values).is.deep.eq({
        isDelegate  : 0,
        u_isDelegate: 0,
        u_username  : null,
        username    : null,
      });

      expect(op.options).to.be.deep.eq({
        where: {
          address: sender.address,
        },
      });
    });
  });

  describe('objectNormalize', () => {
    beforeEach(() => {
      zSchemaStub.stubs.validate.returns(true);
    });

    it('should call removeEmptyObjKeys', () => {
      const removeEmptyObjKeysSpy = sandbox.spy(helpers, 'removeEmptyObjKeys');
      instance.objectNormalize(tx);
      expect(removeEmptyObjKeysSpy.calledOnce).to.be.true;
      expect(removeEmptyObjKeysSpy.firstCall.args[0]).to.be.deep.equal(tx.asset.delegate);
      removeEmptyObjKeysSpy.restore();
    });

    it('should call schema.validate', () => {
      instance.objectNormalize(tx);
      expect(zSchemaStub.stubs.validate.calledOnce).to.be.true;
      expect(zSchemaStub.stubs.validate.firstCall.args[0]).to.be.deep.equal(tx.asset.delegate);
      expect(zSchemaStub.stubs.validate.firstCall.args[1]).to.be.deep.equal(delegateSchema);
    });

    it('should throw if validation fails', () => {
      zSchemaStub.stubs.validate.returns(false);
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Failed to validate delegate schema/);
    });

    it('should throw with errors message if validation fails', () => {
      (instance as any).schema.getLastErrors = () => [{message: '1'}, {message: '2'}];
      zSchemaStub.stubs.validate.returns(false);
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
        t_senderId       : 'address',
        t_senderPublicKey: 'pubKey',
      });
      expect(retVal).to.be.deep.equal({
        delegate: {
          address  : 'address',
          publicKey: 'pubKey',
          username : 'thebestdelegate',
        },
      });
    });
  });

  describe('dbSave', () => {
    it('should return the Createop object', async () => {
      const createOp = await instance.dbSave(tx);
      expect(createOp.type).is.eq('create');
      expect(createOp.model).is.deep.eq(delegatesModel);
      expect(createOp.values).is.deep.eq({
        transactionId: tx.id,
        username: tx.asset.delegate.username,
      });
    });
  });
});
