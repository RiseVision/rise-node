'use strict';
import {
  IAccountsModule,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { TXSymbols } from '@risevision/core-transactions';
import { DBUpdateOp, TransactionType } from '@risevision/core-types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { dPoSSymbols } from '../../../../src/helpers';
import { RegisterDelegateTransaction } from '../../../../src/logic/delegateTransaction';
import { AccountsModelForDPOS, DelegatesModel } from '../../../../src/models';

const expect = chai.expect;
chai.use(chaiAsPromised);

// tslint:disable no-unused-expression no-big-function object-literal-sort-keys no-identical-functions
describe('logic/transactions/delegate', () => {
  let sandbox: SinonSandbox;
  let accountsModuleStub: IAccountsModule;
  let systemModuleStub: ISystemModule;
  let container: Container;
  let instance: RegisterDelegateTransaction;
  let accountsModel: typeof AccountsModelForDPOS;
  let delegatesModel: typeof DelegatesModel;
  let tx: any;
  let sender: any;
  let block: any;

  let getFeesStub: SinonStub;

  before(async () => {
    container = await createContainer([
      'core-consensus-dpos',
      'core-helpers',
      'core-crypto',
      'core',
    ]);
  });

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    accountsModel = container.getNamed(
      ModelSymbols.model,
      Symbols.models.accounts
    );
    delegatesModel = container.getNamed(
      ModelSymbols.model,
      dPoSSymbols.models.delegates
    );
    accountsModuleStub = container.get(Symbols.modules.accounts);
    systemModuleStub = container.get(Symbols.modules.system);
    tx = {
      amount: 0,
      asset: {
        delegate: {
          address: '74128139741256612355994R',
          publicKey: Buffer.from(
            'a2bac0a1525e9605a37e6c6588716f9c941530c74eabdf0b27b10b3817e58fe3',
            'hex'
          ),
          username: 'topdelegate',
        },
      },
      fee: 10,
      id: '8139741256612355994',
      senderId: '1233456789012345R',
      senderPublicKey: Buffer.from(
        '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3',
        'hex'
      ),
      signature: Buffer.from(
        '0a1525e9605a37e6c6588716f9c9a2bac41530c74e3817e58fe3abdf0b27b10b' +
          'a2bac0a1525e9605a37e6c6588716f9c7b10b3817e58fe3941530c74eabdf0b2',
        'hex'
      ),
      timestamp: 0,
      type: TransactionType.DELEGATE,
    };

    sender = {
      address: '1233456789012345R',
      balance: 10000000,
      publicKey: Buffer.from(
        '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3',
        'hex'
      ),
      isMultisignature() {
        return false;
      },
      applyValues() {
        throw new Error('please stub me :)');
      },
    };

    block = {
      height: 8797,
      id: '13191140260435645922',
    };
    instance = container.getNamed(
      TXSymbols.transaction,
      dPoSSymbols.logic.delegateTransaction
    );
    getFeesStub = sandbox
      .stub(systemModuleStub, 'getFees')
      .returns({ fees: { delegate: 2500 } });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('calculateFee', () => {
    it('should call systemModule.getFees', () => {
      instance.calculateFee(tx, sender, block.height);
      expect(getFeesStub.calledOnce).to.be.true;
      expect(getFeesStub.firstCall.args[0]).to.be.equal(block.height);
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
      expect(retVal).to.be.deep.equal(
        Buffer.from(tx.asset.delegate.username, 'utf8')
      );
    });
  });

  describe('verify', () => {
    let getAccountStub: SinonStub;
    beforeEach(() => {
      getAccountStub = sandbox
        .stub(accountsModuleStub, 'getAccount')
        .resolves(null);
    });

    it('should throw when tx.recipientId', async () => {
      tx.recipientId = 'recipient';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Invalid recipient'
      );
    });

    it('should throw when amount != 0', async () => {
      tx.amount = 100;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Invalid transaction amount'
      );
    });

    it('should throw when sender is delegate already', async () => {
      sender.isDelegate = true;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Account is already a delegate'
      );
    });

    it('should throw when no tx.asset or tx.asset.delegate', async () => {
      delete tx.asset.delegate;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Invalid transaction asset'
      );
      delete tx.asset;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Invalid transaction asset'
      );
    });

    it('should throw when no username', async () => {
      delete tx.asset.delegate.username;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Username is undefined'
      );
    });

    it('should throw when username is not lowercase', async () => {
      tx.asset.delegate.username = 'TopDelegate';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Username must be lowercase'
      );
    });

    it('should call String.toLowercase.trim', async () => {
      const toLowercaseSpy = sandbox.spy(String.prototype, 'toLowerCase');
      const trimSpy = sandbox.spy(String.prototype, 'trim');
      await instance.verify(tx, sender);
      expect(toLowercaseSpy.calledTwice).to.be.true;
      expect(trimSpy.calledOnce).to.be.true;
      toLowercaseSpy.restore();
      trimSpy.restore();
    });

    it('should throw when trimmed username is empty string', async () => {
      tx.asset.delegate.username = '    ';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Empty username'
      );
    });

    it('should throw when username is more than 20 chars long', async () => {
      tx.asset.delegate.username = 'abcdefghijklmnopqrstuvwxyz';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Username is too long. Maximum is 20 characters'
      );
    });

    it('should throw when username is a possible address - given param should be uppercased', async () => {
      tx.asset.delegate.username = '1r';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Username can not be a potential address'
      );
    });

    it('should throw if zschema does not validate the username', async () => {
      // First call needs false to avoid throwing, second is false to force throwing
      tx.asset.delegate.username = '1r - --òaùàà-ù##';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        'Username can only contain alphanumeric characters with the exception of !@$&_.'
      );
    });

    it('should call accountsModule.getAccount and throw if account is found', async () => {
      getAccountStub.resolves({ the: 'account' });
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(
        /Username already exists:/
      );
      expect(getAccountStub.calledOnce).to.be.true;
      expect(getAccountStub.firstCall.args[0].username).to.be.equal(
        tx.asset.delegate.username
      );
    });
  });

  describe('apply', () => {
    let applyValuesStub: SinonStub;
    beforeEach(() => {
      applyValuesStub = sandbox.stub(sender, 'applyValues');
    });

    it('should call sender.applyValues with proper data', async () => {
      await instance.apply(tx, block, sender);
      expect(applyValuesStub.called).is.true;
      expect(applyValuesStub.firstCall.args[0]).deep.eq({
        u_isDelegate: 1,
        isDelegate: 1,
        username: 'topdelegate',
        u_username: 'topdelegate',
        vote: 0n,
      });
    });

    it('should return a DBUpdateOp', async () => {
      const retVal = await instance.apply(tx, block, sender);
      expect(retVal.length).is.eq(1);
      const op: DBUpdateOp<any> = retVal[0] as any;
      expect(op.type).is.eq('update');
      expect(op.model).is.deep.eq(accountsModel);
      expect(op.values).is.deep.eq({
        isDelegate: 1,
        u_isDelegate: 1,
        vote: 0n,
        username: tx.asset.delegate.username,
        u_username: tx.asset.delegate.username,
      });
      expect(op.options).to.be.deep.eq({
        where: {
          address: sender.address,
        },
      });
    });

    it('should throw an error', async () => {
      sender.isDelegate = 1;
      expect(instance.apply(tx, block, sender)).to.be.rejectedWith(
        'Account is already a delegate'
      );
    });
  });

  describe('undo', () => {
    let applyValuesStub: SinonStub;
    beforeEach(() => {
      applyValuesStub = sandbox.stub(sender, 'applyValues');
    });
    it('should call sender.applyValues with proper data', async () => {
      await instance.undo(tx, block, sender);
      expect(applyValuesStub.called).is.true;
      expect(applyValuesStub.firstCall.args[0]).deep.eq({
        u_isDelegate: 1,
        isDelegate: 0,
        username: null,
        u_username: 'topdelegate',
        vote: 0n,
      });
    });
    it('should return a DBUpdateOp', async () => {
      const retVal = await instance.undo(tx, block, sender);
      expect(retVal.length).is.eq(1);
      const op: DBUpdateOp<any> = retVal[0] as any;
      expect(op.type).is.eq('update');
      expect(op.model).is.deep.eq(accountsModel);
      expect(op.values).is.deep.eq({
        isDelegate: 0,
        u_isDelegate: 1,
        vote: 0n,
        username: null,
        u_username: tx.asset.delegate.username,
      });

      expect(op.options).to.be.deep.eq({
        where: {
          address: sender.address,
        },
      });
    });
  });

  describe('applyUnconfirmed', () => {
    let applyValuesStub: SinonStub;
    beforeEach(() => {
      applyValuesStub = sandbox.stub(sender, 'applyValues');
    });
    it('should call sender.applyValues with proper data', async () => {
      await instance.applyUnconfirmed(tx, sender);
      expect(applyValuesStub.called).is.true;
      expect(applyValuesStub.firstCall.args[0]).deep.eq({
        isDelegate: 0,
        u_isDelegate: 1,
        u_username: 'topdelegate',
        username: null,
      });
    });

    it('should return a DBUpdateOp', async () => {
      const retVal = await instance.applyUnconfirmed(tx, sender);
      expect(retVal.length).is.eq(1);
      const op: DBUpdateOp<any> = retVal[0] as any;
      expect(op.type).is.eq('update');
      expect(op.model).is.deep.eq(accountsModel);
      expect(op.values).is.deep.eq({
        isDelegate: 0,
        u_isDelegate: 1,
        u_username: tx.asset.delegate.username,
        username: null,
      });

      expect(op.options).to.be.deep.eq({
        where: {
          address: sender.address,
        },
      });
    });

    it('should throw an error', async () => {
      sender.u_isDelegate = 1;
      await expect(instance.applyUnconfirmed(tx, sender)).to.rejectedWith(
        'Account is already trying to be a delegate'
      );
    });
  });

  describe('undoUnconfirmed', () => {
    let applyValuesStub: SinonStub;
    beforeEach(() => {
      applyValuesStub = sandbox.stub(sender, 'applyValues');
    });
    it('should call sender.applyValues with proper data', async () => {
      await instance.undoUnconfirmed(tx, sender);
      expect(applyValuesStub.called).is.true;
      expect(applyValuesStub.firstCall.args[0]).deep.eq({
        isDelegate: 0,
        u_isDelegate: 0,
        u_username: null,
        username: null,
      });
    });

    it('should return a DBUpdateOp', async () => {
      const retVal = await instance.undoUnconfirmed(tx, sender);
      expect(retVal.length).is.eq(1);
      const op: DBUpdateOp<any> = retVal[0] as any;
      expect(op.type).is.eq('update');
      expect(op.model).is.deep.eq(accountsModel);
      expect(op.values).is.deep.eq({
        isDelegate: 0,
        u_isDelegate: 0,
        u_username: null,
        username: null,
      });

      expect(op.options).to.be.deep.eq({
        where: {
          address: sender.address,
        },
      });
    });
  });

  describe('objectNormalize', () => {
    it('should remove empty keys from asset', () => {
      const oldAsset = { ...tx.asset };
      tx.asset.delegate.meow = null;
      tx.asset.delegate.haha = '';
      instance.objectNormalize(tx);
      expect(tx.asset).deep.eq(oldAsset);
    });

    it('should throw if validation fails', () => {
      tx.asset.delegate.username = '###';
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Failed to validate delegate schema/);
    });
  });

  describe('dbRead', () => {
    it('should return null if !d_username', () => {
      const retVal = instance.dbRead({});
      expect(retVal).to.be.null;
    });

    it('should return the delegate object', () => {
      const retVal = instance.dbRead({
        d_username: 'thebestdelegate',
      });
      expect(retVal).to.be.deep.equal({
        delegate: {
          username: 'thebestdelegate',
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

  describe('attachAssets', () => {
    let modelFindAllStub: SinonStub;
    beforeEach(() => {
      modelFindAllStub = sandbox.stub(delegatesModel, 'findAll');
    });
    it('should do do nothing if result is empty', async () => {
      modelFindAllStub.resolves([]);
      await instance.attachAssets([]);
    });
    it('should throw if a tx was provided but not returned by model.findAll', async () => {
      modelFindAllStub.resolves([]);
      await expect(instance.attachAssets([{ id: 'ciao' }] as any)).rejectedWith(
        "Couldn't restore asset for Delegate tx: ciao"
      );
    });
    it('should use model result and modify original arr', async () => {
      modelFindAllStub.resolves([
        { transactionId: 2, username: 'second' },
        { transactionId: 1, username: 'first' },
      ]);
      const txs: any = [{ id: 1 }, { id: 2 }];

      await instance.attachAssets(txs);

      expect(txs[0]).deep.eq({
        id: 1,
        asset: {
          delegate: {
            username: 'first',
          },
        },
      });
      expect(txs[1]).deep.eq({
        id: 2,
        asset: {
          delegate: {
            username: 'second',
          },
        },
      });
    });
  });
});
