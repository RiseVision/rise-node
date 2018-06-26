'use strict';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { TransactionType } from '../../../../src/helpers';
import { Symbols } from '../../../../src/ioc/symbols';
import { SecondSignatureTransaction } from '../../../../src/logic/transactions';
import secondSignatureSchema from '../../../../src/schema/logic/transactions/secondSignature';
import { AccountsModuleStub, SystemModuleStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';
import { DBUpdateOp } from '../../../../src/types/genericTypes';
import { AccountsModel, SignaturesModel } from '../../../../src/models';

const expect = chai.expect;
chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('logic/transactions/secondSignature', () => {
  let sandbox: SinonSandbox;
  let zSchemaStub: any;
  let accountsModuleStub: AccountsModuleStub;
  let systemModuleStub: SystemModuleStub;
  let container: Container;
  let instance: SecondSignatureTransaction;
  let accountsModel: typeof AccountsModel;
  let signaturesModel: typeof SignaturesModel;
  let tx: any;
  let sender: any;
  let block: any;

  beforeEach(() => {
    sandbox            = sinon.createSandbox();
    container          = createContainer();
    zSchemaStub        = {
      getLastErrors: () => [],
      validate     : sandbox.stub(),
    };
    accountsModuleStub = container.get(Symbols.modules.accounts);
    systemModuleStub   = container.get(Symbols.modules.system);

    accountsModel = container.get(Symbols.models.accounts);
    signaturesModel = container.get(Symbols.models.signatures);
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
    container.rebind(Symbols.logic.transactions.secondSignature)
      .to(SecondSignatureTransaction).inSingletonScope();

    instance = container.get(Symbols.logic.transactions.secondSignature);
    (instance as any).schema = zSchemaStub;

    systemModuleStub.stubs.getFees.returns({fees: {secondsignature: 1000}});
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
      expect(zSchemaStub.validate.firstCall.args[1]).to.be.deep.equal({format: 'publicKey'});
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
