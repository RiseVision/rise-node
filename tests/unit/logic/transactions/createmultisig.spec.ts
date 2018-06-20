'use strict';
import * as ByteBuffer from 'bytebuffer';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { TransactionType } from '../../../../src/helpers';
import { Symbols } from '../../../../src/ioc/symbols';
import { MultiSignatureTransaction } from '../../../../src/logic/transactions';
import {
  AccountLogicStub,
  AccountsModuleStub,
  RoundsLogicStub,
  SystemModuleStub,
  TransactionLogicStub,
  ZSchemaStub
} from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';
import {
  Accounts2MultisignaturesModel,
  Accounts2U_MultisignaturesModel,
  AccountsModel,
  MultiSignaturesModel,
  TransactionsModel
} from '../../../../src/models';
import { DBCreateOp, DBRemoveOp, DBUpdateOp, DBUpsertOp } from '../../../../src/types/genericTypes';

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
  let accounts2MultisigModel: typeof Accounts2MultisignaturesModel;
  let accounts2UMultisigModel: typeof Accounts2U_MultisignaturesModel;
  let txModel: typeof TransactionsModel;
  let tx: any;
  let sender: any;
  let block: any;
  let container: Container;

  beforeEach(() => {
    sandbox                 = sinon.createSandbox();
    container               = createContainer();
    accountsModel           = container.get(Symbols.models.accounts);
    accounts2MultisigModel  = container.get(Symbols.models.accounts2Multisignatures);
    accounts2UMultisigModel = container.get(Symbols.models.accounts2U_Multisignatures);
    multisigModel           = container.get(Symbols.models.multisignatures);
    txModel                 = container.get(Symbols.models.transactions);

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

    sender = new accountsModel({
      address  : '1233456789012345R',
      balance  : 10000000,
      publicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
    });

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

    it('should not throw when account has multisig enabled', async () => {
      sender.multisignatures = ['senderSig1', 'senderSig2'];
      await instance.verify(tx, sender);
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
    let applyDiffArrayStub: SinonStub;
    beforeEach(() => {
      accountLogicStub.stubs.merge.returns([]);
      roundsLogicStub.stubs.calcRound.returns(123);
      accountLogicStub.stubs.generateAddressByPublicKey.returns('123123124125R');
      accountsModuleStub.stubs.setAccountAndGet.resolves();
      applyDiffArrayStub = sandbox.stub(sender, 'applyDiffArray');
      sandbox.stub(sender, 'applyValues');
    });

    it('should return correct ops', async () => {
      const ops = await instance.apply(tx, block, sender);

      // first op is about account
      expect(ops[0].type).eq('update');
      expect(ops[0].model).deep.eq(accountsModel);
      expect((ops[0] as any).values).deep.eq({ blockId: block.id, multilifetime: 33, multimin: 2 });
      expect((ops[0] as any).options).deep.eq({ where: { address: sender.address } });

      // second op is about removing currently stored memaccounts2_multisignatures table entries
      expect(ops[1].type).eq('remove');
      expect(ops[1].model).deep.eq(accounts2MultisigModel);
      expect((ops[1] as any).options).deep.eq({ where: { accountId: sender.address } });

      for (let i = 0; i < tx.asset.multisignature.keysgroup.length; i++) {
        const key             = tx.asset.multisignature.keysgroup[i].substr(1);
        const [first, second] = ops.slice(2 + i * 2, 2 + i * 2 + 2);
        expect(first.type).eq('upsert');
        expect((first as any).values).deep.eq({ address: '123123124125R', publicKey: Buffer.from(key, 'hex') });

        expect(second.type).eq('create');
        expect(second.model).deep.eq(accounts2MultisigModel);
        expect((second as any).values).deep.eq({ accountId: sender.address, dependentId: key });

      }
    });

    it('should call accountLogic.generateAddressByPublicKey for each key', async () => {
      await instance.apply(tx, block, sender);
      expect(accountLogicStub.stubs.generateAddressByPublicKey.callCount).to.be.equal(tx.asset.multisignature.keysgroup.length);
      expect(accountLogicStub.stubs.generateAddressByPublicKey.firstCall.args[0]).to.be.equal(tx.asset.multisignature.keysgroup[0].substring(1));
    });

    it('should manipulate sender and apply values properly', async () => {
      sender = new accountsModel(sender);
      await instance.apply(tx, block, sender);
      expect(sender.multisignatures).deep.eq([
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      ]);
      expect(sender.multimin).deep.eq(2);
      expect(sender.multilifetime).deep.eq(33);
    });
  });

  describe('undo', () => {
    let applyDiffArrayStub: SinonStub;
    let txFindOneStub: SinonStub;
    beforeEach(() => {
      accountLogicStub.stubs.merge.returns(true);
      roundsLogicStub.stubs.calcRound.returns(123);
      accountLogicStub.stubs.generateAddressByPublicKey.returns('123123124125R');
      accountsModuleStub.stubs.setAccountAndGet.resolves();
      applyDiffArrayStub = sandbox.stub(sender, 'applyDiffArray');
      txFindOneStub = sandbox.stub(txModel, 'findOne').resolves(null);
    });

    it('should set unconfirmedSignatures[sender.address] to true', async () => {
      await instance.undo(tx, block, sender);
      expect((instance as any).unconfirmedSignatures[sender.address]).to.be.true;
    });

    describe('returned ops', () => {

      it('should return proper ops when account was not previously multisig (no prev tx)', async () => {
        txFindOneStub.resolves(null);
        const ops = await instance.undo(tx, block, sender);
        expect(ops.length).eq(2);

        const firstOp: DBUpdateOp<any> = ops[0] as any;
        const secondOp: DBRemoveOp<any> = ops[1] as any;
        expect(firstOp.type).eq('update');
        expect(firstOp.model).deep.eq(accountsModel);
        expect(firstOp.options).deep.eq({where: { address: sender.address }});
        expect(firstOp.values).deep.eq({blockId: '0', multimin: 0, multilifetime: 0 });

        expect(secondOp.type).eq('remove');
        expect(secondOp.model).deep.eq(accounts2MultisigModel);
        expect(secondOp.options).deep.eq({where: { accountId: sender.address }});
      });
      it('should return proper ops when account was previously multisig (prevtx)', async () => {
        txFindOneStub.resolves({ asset: { multisignature: { min: 10, lifetime: 20, keysgroup: ['+aaaa', '+bbbb'] } } });
        const ops = await instance.undo(tx, block, sender);
        expect(ops.length).eq(2 + 2 * 2);

        const firstOp: DBUpdateOp<any> = ops[0] as any;

        expect(firstOp.type).eq('update');
        expect(firstOp.model).deep.eq(accountsModel);
        expect(firstOp.options).deep.eq({where: { address: sender.address }});
        expect(firstOp.values).deep.eq({blockId: '0', multimin: 10, multilifetime: 20 });

        const secondOp: DBRemoveOp<any> = ops[1] as any;
        expect(secondOp.type).eq('remove');
        expect(secondOp.model).deep.eq(accounts2MultisigModel);
        expect(secondOp.options).deep.eq({where: { accountId: sender.address }});

        for (let i = 0; i < 2; i++) {
          const op1: DBUpsertOp<any> = ops[2 + 2 * i] as any;
          const op2: DBCreateOp<any> = ops[2 + 2 * i + 1] as any;
          const pk                   = i === 0 ? 'aaaa' : 'bbbb';
          expect(op1.type).eq('upsert');
          expect(op1.model).deep.eq(accountsModel);
          expect(op1.values).deep.eq({ address: '123123124125R', publicKey: Buffer.from(pk, 'hex') });

          expect(op2.type).eq('create');
          expect(op2.model).deep.eq(accounts2MultisigModel);
          expect(op2.values).deep.eq({ accountId: sender.address, dependentId: pk });
        }
      });
    });

    it('should update sender object properly', async () => {
      sender = new AccountsModel(sender);
      await instance.undo(tx, block, sender);
      expect(sender.isMultisignature()).false;
      expect(sender.multisignatures).deep.eq([]);
      expect(sender.multimin).deep.eq(0);
      expect(sender.multilifetime).deep.eq(0);
    });
    it('should update sender obj properly if rollback to prev multisig state', async () => {
      sender = new AccountsModel(sender);
      txFindOneStub.resolves({ asset: { multisignature: { min: 10, lifetime: 20, keysgroup: ['+aaaa', '+bbbb'] } } });
      await instance.undo(tx, block, sender);
      expect(sender.isMultisignature()).true;
      expect(sender.multisignatures).deep.eq(['aaaa', 'bbbb']);
      expect(sender.multimin).deep.eq(10);
      expect(sender.multilifetime).deep.eq(20);
    });
  });

  describe('applyUnconfirmed', () => {
    beforeEach(() => {
      accountLogicStub.stubs.merge.returns(true);
      accountLogicStub.stubs.generateAddressByPublicKey.returns('12345R');
    });

    it('should throw if signature is not confirmed yet', () => {
      (instance as any).unconfirmedSignatures[sender.address] = true;
      expect(instance.applyUnconfirmed(tx, sender)).to.be.rejectedWith('Signature on this account is pending confirmation');
    });

    it('should update sender object properly', async () => {
      await instance.applyUnconfirmed(tx, sender);
      expect(sender.u_multisignatures).deep.eq([
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      ]);
      expect(sender.u_multimin).deep.eq(2);
      expect(sender.u_multilifetime).deep.eq(33);
    });
    it('should return proper ops', async () => {
      const ops = await instance.applyUnconfirmed(tx, sender);

      // first op is about account
      expect(ops[0].type).eq('update');
      expect(ops[0].model).deep.eq(accountsModel);
      expect((ops[0] as any).values).deep.eq({u_multilifetime: 33, u_multimin: 2});
      expect((ops[0] as any).options).deep.eq({where: { address: sender.address }});

      // second op is about removing currently stored memaccounts2_multisignatures table entries
      expect(ops[1].type).eq('remove');
      expect(ops[1].model).deep.eq(accounts2UMultisigModel);
      expect((ops[1] as any).options).deep.eq({ where: { accountId: sender.address } });

      for (let i = 0; i < tx.asset.multisignature.keysgroup.length; i++) {
        const key             = tx.asset.multisignature.keysgroup[i].substr(1);
        const [first, second] = ops.slice(2 + i * 2, 2 + i * 2 + 2);
        expect(first.type).eq('upsert');
        expect((first as any).values).deep.eq({ address: '12345R', publicKey: Buffer.from(key, 'hex') });

        expect(second.type).eq('create');
        expect(second.model).deep.eq(accounts2UMultisigModel);
        expect((second as any).values).deep.eq({ accountId: sender.address, dependentId: key });

      }

    });
  });

  describe('undoUnconfirmed', () => {

    it('should update sender object properly', async () => {
      sender.multimin      = 0;
      sender.multilifetime = 0;
      await instance.undoUnconfirmed(tx, sender);
      expect(sender.isMultisignature()).false;
      expect(sender.u_multimin).eq(0);
      expect(sender.u_multilifetime).eq(0);
      expect(sender.u_multisignatures).deep.eq([]);

      // if confirmed is multi
      sender.multisignatures = ['aaaa', 'bbbb'];
      sender.multimin        = 2;
      sender.multilifetime   = 3;
      await instance.undoUnconfirmed(tx, sender);
      expect(sender.isMultisignature()).true;
      expect(sender.u_multimin).eq(2);
      expect(sender.u_multilifetime).eq(3);
      expect(sender.u_multisignatures).deep.eq(['aaaa', 'bbbb']);
    });

    it('should delete unconfirmedSignatures[sender.address]', async () => {
      await instance.undoUnconfirmed(tx, sender);
      expect((instance as any).unconfirmedSignatures[sender.address]).to.be.undefined;
    });

    it('should return correct data if prev state was no multisig', async () => {
      const ops = await instance.undoUnconfirmed(tx, sender);
      expect(ops[0].type).eq('remove');
      expect((ops[0] as any).options).deep.eq({where: {accountId: sender.address}});

      expect(ops[1].type).eq('update');
      expect((ops[1] as any).options).deep.eq({where: { address: sender.address }});
      expect((ops[1] as any).values).deep.eq({
        u_multilifetime: { col: 'multilifetime'},
        u_multimin: { col: 'multimin'},
      });

      expect(ops.length).eq(2);
    });

    it('should return correct ops if account was multisig', async () => {
      sender.multisignatures = ['aa', 'bb'];
      const ops = await instance.undoUnconfirmed(tx, sender);
      expect(ops[0].type).eq('remove');
      expect((ops[0] as any).options).deep.eq({where: {accountId: sender.address}});

      expect(ops[1].type).eq('upsert');
      expect((ops[1] as any).values).deep.eq( {accountId: sender.address, dependentId: 'aa'});
      expect(ops[2].type).eq('upsert');
      expect((ops[2] as any).values).deep.eq( {accountId: sender.address, dependentId: 'bb'});

      expect(ops[3].type).eq('update');
      expect((ops[3] as any).options).deep.eq({where: { address: sender.address }});
      expect((ops[3] as any).values).deep.eq({
        u_multilifetime: { col: 'multilifetime'},
        u_multimin: { col: 'multimin'},
      });

      expect(ops.length).eq(4);
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
    describe('account already multisig', () => {
      beforeEach(() => {
        sender = new AccountsModel(sender);
        sender.multisignatures = ['aaaa','bbbb'];
        sender.multilifetime = 72;
        sender.multimin = 2;

        tx.asset.multisignature.keysgroup = ['+cc','+dd','+ee'];
      });
      it('should false if no 5 sigs provided', () => {
        tx.signatures = new Array(4).fill('a');
        expect(instance.ready(tx, sender)).false;
        tx.signatures = new Array(5).fill('a');
        expect(instance.ready(tx, sender)).true;
      });
      it('should return true if 3 sigs when keysgroup overlap', () => {
        sender.multisignatures = ['cc', 'ee'];
        tx.asset.multisignature.keysgroup = ['+cc', '+dd', '+ee'];
        tx.signatures = [];
        expect(instance.ready(tx, sender)).false;
        tx.signatures.push('a');
        expect(instance.ready(tx, sender)).false;
        tx.signatures.push('a');
        expect(instance.ready(tx, sender)).false;
        tx.signatures.push('a');
        expect(instance.ready(tx, sender)).true;
      });
    });
    describe('account not being multisig', () => {
      beforeEach(() => {
        sender = new AccountsModel(sender);
        tx.asset.multisignature.keysgroup = ['+cc','+dd','+ee'];
      });
      it('should require account 3 sigs', () => {
        tx.signatures = ['1','2','3'];
        expect(instance.ready(tx, sender)).true;
      })
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
