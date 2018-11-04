'use strict';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { IAccountsModule, ISystemModule, Symbols } from '@risevision/core-interfaces';
import { AccountsModelWith2ndSign } from '../../src/AccountsModelWith2ndSign';
import { SignaturesModel } from '../../src/SignaturesModel';
import { SecondSignatureTransaction } from '../../src/secondSignature';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { DBUpdateOp, TransactionType } from '@risevision/core-types';
import { ModelSymbols } from '@risevision/core-models';
import { SigSymbols } from '../../src/symbols';
import { TXSymbols } from '@risevision/core-transactions';

const expect = chai.expect;
chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('logic/transactions/secondSignature', () => {
  let sandbox: SinonSandbox;
  let zSchemaStub: any;
  let accountsModuleStub: IAccountsModule;
  let systemModuleStub: ISystemModule;
  let container: Container;
  let instance: SecondSignatureTransaction;
  let accountsModel: typeof AccountsModelWith2ndSign;
  let signaturesModel: typeof SignaturesModel;
  let tx: any;
  let sender: any;
  let block: any;

  before(async () => {
    container          = await createContainer(['core-secondsignature', 'core', 'core-helpers', 'core-crypto']);
  });
  beforeEach(async () => {
    sandbox            = sinon.createSandbox();

    zSchemaStub        = {
      getLastErrors: () => [],
      validate     : sandbox.stub(),
    };
    accountsModuleStub = container.get(Symbols.modules.accounts);
    systemModuleStub   = container.get(Symbols.modules.system);

    accountsModel = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    signaturesModel = container.getNamed(ModelSymbols.model, SigSymbols.model);
    tx = {
      amount         : 0,
      asset          : {
        signature: {
          publicKey: 'a2bac0a1525e9605a37e6c6588716f9c941530c74eabdf0b27b10b3817e58fe3',
        },
      },
      fee            : 10,
      id             : '8139741256612355994',
      senderId       : '1233456789012345R',
      senderPublicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
      signature      : Buffer.from('0a1525e9605a37e6c6588716f9c9a2bac41530c74e3817e58fe3abdf0b27b10b' +
        'a2bac0a1525e9605a37e6c6588716f9c7b10b3817e58fe3941530c74eabdf0b2', 'hex'),
      timestamp      : 0,
      type           : TransactionType.SIGNATURE,
    };

    sender = {
      address  : '1233456789012345R',
      balance  : 10000000,
      publicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
      isMultisignatures() {
        return false;
      },
      applyValues() {
        throw new Error('please stub applyValues');
      }
    };

    block = {
      height: 8797,
      id    : '13191140260435645922',
    };
    instance = container.getNamed(TXSymbols.transaction, SigSymbols.transaction);
    sandbox.stub(systemModuleStub, 'getFees').returns({fees: {secondsignature: 1000}});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('calculateFee', () => {
    it('should call systemModule.getFees', () => {
      const retVal = instance.calculateFee(tx, sender, block.height);
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
      tx.asset.signature.publicKey = 'invalid pubkey';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid public key');
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
        u_secondSignature: 0,
        secondSignature: 1,
        secondPublicKey: Buffer.from(tx.asset.signature.publicKey, 'hex')
      });
    });
    it('should return an update operation with proper data', async () => {
      const ops = await instance.apply(tx, block, sender);
      expect(ops.length).is.eq(1);

      const op = ops[0] as DBUpdateOp<any>;
      expect(op.type).eq('update');
      expect(op.model).deep.eq(accountsModel);
      expect(op.options).deep.eq({ where: { address: sender.address }});
      expect(op.values).deep.eq({
        secondPublicKey: Buffer.from(tx.asset.signature.publicKey, 'hex'),
        secondSignature: 1,
        u_secondSignature: 0,
      });
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
        u_secondSignature: 1,
        secondSignature: 0,
        secondPublicKey: null,
      });
    });
    it('should return an update operation with proper data', async () => {
      const ops = await instance.undo(tx, block, sender);
      expect(ops.length).is.eq(1);

      const op = ops[0] as DBUpdateOp<any>;
      expect(op.type).eq('update');
      expect(op.model).deep.eq(accountsModel);
      expect(op.options).deep.eq({ where: { address: sender.address }});
      expect(op.values).deep.eq({
        secondPublicKey: null,
        secondSignature: 0,
        u_secondSignature: 1,
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
        u_secondSignature: 1,
      });
    });
    it('should return an update operation with proper data', async () => {
      const ops = await instance.applyUnconfirmed(tx, sender);
      expect(ops.length).is.eq(1);

      const op = ops[0] as DBUpdateOp<any>;
      expect(op.type).eq('update');
      expect(op.model).deep.eq(accountsModel);
      expect(op.options).deep.eq({ where: { address: sender.address }});
      expect(op.values).deep.eq({
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
    let applyValuesStub: SinonStub;
    beforeEach(() => {
      applyValuesStub = sandbox.stub(sender, 'applyValues');
    });
    it('should call sender.applyValues with proper data', async () => {
      await instance.undoUnconfirmed(tx, sender);
      expect(applyValuesStub.called).is.true;
      expect(applyValuesStub.firstCall.args[0]).deep.eq({
        u_secondSignature: 0,
      });
    });
    it('should return an update operation with proper data', async () => {
      const ops = await instance.undoUnconfirmed(tx, sender);
      expect(ops.length).is.eq(1);

      const op = ops[0] as DBUpdateOp<any>;
      expect(op.type).eq('update');
      expect(op.model).deep.eq(accountsModel);
      expect(op.options).deep.eq({where: {address: sender.address}});
      expect(op.values).deep.eq({
        u_secondSignature: 0,
      });
    });
  });

  describe('objectNormalize', () => {
    beforeEach(() => {
      zSchemaStub.validate.returns(true);
    });

    it('should throw if validation fails', () => {
      tx.asset.signature.publicKey = 'not a valid publickey';
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/pass validation for format publicKey/);

      // missing pubkey
      delete tx.asset.signature.publicKey;
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Missing required property: publicKey/);

      // null pubkey
      tx.asset.signature.publicKey = null;
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Expected type string but found type null/);

      // empty pubkey
      tx.asset.signature.publicKey = '';
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Object didn't pass validation for format publicKey/);
    });

    it('should return the tx', () => {
      const retVal = instance.objectNormalize(tx);
      expect(retVal).to.be.deep.equal(tx);
    });
  });

  describe('dbSave', () => {
    it('should return the expected dbcreateop', () => {
      const op = instance.dbSave(tx);
      expect(op.type).eq('create');
      expect(op.model).deep.eq(signaturesModel);
      expect((op as any).values).deep.eq({
        publicKey    : Buffer.from(tx.asset.signature.publicKey, 'hex'),
        transactionId: tx.id,
      });
    });
  });

  describe('attachAssets', () => {
    let modelFindAllStub: SinonStub;
    beforeEach(() => {
      modelFindAllStub = sandbox.stub(signaturesModel, 'findAll');
    });
    it('should do do nothing if result is empty', async () => {
      modelFindAllStub.resolves([]);
      await instance.attachAssets([]);
    });
    it('should throw if a tx was provided but not returned by model.findAll', async () => {
      modelFindAllStub.resolves([]);
      await expect(instance.attachAssets([{id: 'ciao'}] as any))
        .rejectedWith('Couldn\'t restore asset for Signature tx: ciao');
    });
    it('should use model result and modify original arr', async () => {
      modelFindAllStub.resolves([
        { transactionId: 2, publicKey: Buffer.from('bb', 'hex')},
        { transactionId: 1, publicKey: Buffer.from('aa', 'hex')},
      ]);
      const txs: any = [{id: 1}, {id: 2}];

      await instance.attachAssets(txs);

      expect(txs[0]).deep.eq({
        id: 1, asset: {
          signature: {
            publicKey: 'aa',
          },
        },
      });
      expect(txs[1]).deep.eq({
        id: 2, asset: {
          signature: {
            publicKey: 'bb',
          },
        },
      });
    });
  });
});
