import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { TransactionType } from '../../../../src/helpers';
import { Symbols } from '../../../../src/ioc/symbols';
import { VoteTransaction } from '../../../../src/logic/transactions';
import voteSchema from '../../../../src/schema/logic/transactions/vote';
import { AccountLogicStub, DelegatesModuleStub, RoundsLogicStub, SystemModuleStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';
import {
  Accounts2DelegatesModel,
  Accounts2U_DelegatesModel,
  AccountsModel,
  RoundsModel,
  VotesModel
} from '../../../../src/models';
import { DBBulkCreateOp, DBCreateOp, DBCustomOp, DBRemoveOp, DBUpdateOp } from '../../../../src/types/genericTypes';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');

const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('logic/transactions/vote', () => {
  let sandbox: SinonSandbox;
  let zSchemaStub: any;
  let accountLogicStub: AccountLogicStub;
  let roundsLogicStub: RoundsLogicStub;
  let delegatesModuleStub: DelegatesModuleStub;
  let systemModuleStub: SystemModuleStub;
  let container: Container;
  let instance: VoteTransaction;
  let tx: any;
  let sender: any;
  let block: any;

  let accountsModel: typeof AccountsModel;
  let votesModel: typeof VotesModel;

  const genRandHexStr = (bytes: number) => {
    const buf = new Buffer(bytes);
    for (let i = 0; i < bytes; i++) {
      buf.writeUInt8((Math.floor(Math.random() * 256)), i);
    }
    return buf.toString('hex');
  };

  beforeEach(() => {
    sandbox             = sinon.createSandbox();
    container          = createContainer();
    zSchemaStub         = {
      getLastErrors: () => [],
      validate     : sandbox.stub(),
    };
    accountLogicStub    = container.get(Symbols.logic.account);
    roundsLogicStub     = container.get(Symbols.logic.rounds);
    delegatesModuleStub = container.get(Symbols.modules.delegates);
    systemModuleStub    = container.get(Symbols.modules.system);

    accountsModel = container.get(Symbols.models.accounts);
    votesModel = container.get(Symbols.models.votes);

    tx = {
      amount         : 0,
      asset          : {
        votes: [
          '-7e58fe36588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b381',
          '+05a37e6c6588716f9c9a2bac4bac0a1525e9605abac4153016f95a37e6c6588a',
        ],
      },
      fee            : 10,
      id             : '8139741256612355994',
      recipientId    : '1233456789012345R',
      senderId       : '1233456789012345R',
      senderPublicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
      signature      : Buffer.from('0a1525e9605a37e6c6588716f9c9a2bac41530c74e3817e58fe3abdf0b27b10b' +
      'a2bac0a1525e9605a37e6c6588716f9c7b10b3817e58fe3941530c74eabdf0b2', 'hex'),
      timestamp      : 0,
      type           : TransactionType.VOTE,
    };

    sender = {
      address  : '1233456789012345R',
      balance  : 10000000,
      publicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
      applyDiffArray() {
        throw new Error('please stub applyDiffArray');
      },
    };

    block = {
      height: 8797,
      id    : '13191140260435645922',
    };

    container.rebind(Symbols.logic.transactions.vote).to(VoteTransaction).inSingletonScope();
    instance = container.get(Symbols.logic.transactions.vote);

    (instance as any).schema          = zSchemaStub;

    systemModuleStub.stubs.getFees.returns({ fees: { vote: 1 } });
    delegatesModuleStub.stubs.checkConfirmedDelegates.resolves();
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

  describe('verify', () => {
    let assertValidVoteStub: SinonStub;
    beforeEach(() => {
      assertValidVoteStub = sandbox.stub(instance as any, 'assertValidVote').returns(true);
    });

    it('should throw when tx.recipientId !== tx.senderId', async () => {
      tx.recipientId = 'otherRecipient';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Missing recipient');
    });

    it('should throw when !tx.asset || !tx.asset.votes', async () => {
      delete tx.asset.votes;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
      delete tx.asset;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
    });

    it('should throw when votes is not an array', async () => {
      tx.asset.votes = 'votes!';
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid votes. Must be an array');
    });

    it('should throw when no tx.asset or tx.asset.votes', async () => {
      delete tx.asset.votes;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
      delete tx.asset;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction asset');
    });

    it('should throw when votes is empty', async () => {
      tx.asset.votes = [];
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid votes. Must not be empty');
    });

    it('should throw when number of votes is > constants.maxVotesPerTransaction', async () => {
      tx.asset.votes = ['+1', '-1', '+3'];
      await expect(instance.verify(tx, sender)).to.be.rejectedWith(/Voting limit exceeded. Maximum is/);
    });

    it('should call assertValidVote for each vote', async () => {
      await instance.verify(tx, sender);
      expect(assertValidVoteStub.callCount).to.be.equal(tx.asset.votes.length);
      tx.asset.votes.forEach((el, key) => {
        expect(assertValidVoteStub.getCall(key).args[0]).to.be.equal(el);
      });
    });

    it('should throw if duplicate votes found', async () => {
      tx.asset.votes[1] = tx.asset.votes[0];
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Multiple votes for same delegate are not allowed');
    });

    it('should call checkConfirmedDelegates and return its result', async () => {
      const checkConfirmedDelegatesStub = sandbox.stub(instance, 'checkConfirmedDelegates').returns('yesItIs');
      const retVal                      = await instance.verify(tx, sender);
      expect(checkConfirmedDelegatesStub.calledOnce).to.be.true;
      expect(checkConfirmedDelegatesStub.firstCall.args[0]).to.be.deep.equal(tx);
      expect(retVal).to.be.equal('yesItIs');
    });
  });

  describe('getBytes', () => {
    it('should return null if no votes', () => {
      delete tx.asset.votes;
      const retVal = instance.getBytes(tx, false, false);
      expect(retVal).to.be.null;
    });

    it('should call Buffer.from', () => {
      const fromSpy = sandbox.spy(Buffer, 'from');
      instance.getBytes(tx, false, false);
      expect(fromSpy.calledOnce).to.be.true;
      expect(fromSpy.firstCall.args[0]).to.be.equal(tx.asset.votes.join(''));
      expect(fromSpy.firstCall.args[1]).to.be.equal('utf8');
    });

    it('should return a Buffer', () => {
      const retVal = instance.getBytes(tx, false, false);
      expect(retVal).to.be.deep.equal(Buffer.from(tx.asset.votes.join(''), 'utf8'));
    });
  });

  describe('getBytes(), unstubbed', () => {
    it('should return an expected value', () => {
      const expected = '2d376535386665333635383837313666396339343135333063373465616264663062323762316132626163306131' +
        '353235653936303561333765366330623338312b3035613337653663363538383731366639633961326261633462616330613135323' +
        '5653936303561626163343135333031366639356133376536633635383861';
      const buf = instance.getBytes(tx, false, false);
      expect(buf.toString('hex')).to.be.equal(expected);
    });
  });

  describe('fromBytes(), unstubbed', () => {
    it('should return the original tx asset', () => {
      const bytes = '2d376535386665333635383837313666396339343135333063373465616264663062323762316132626163306131' +
        '353235653936303561333765366330623338312b3035613337653663363538383731366639633961326261633462616330613135323' +
        '5653936303561626163343135333031366639356133376536633635383861';;
      const asset = instance.fromBytes(Buffer.from(bytes, 'hex'), tx);
      expect(asset).to.be.deep.equal(tx.asset);
    });
    it('getBytes() -> fromBytes() -> getBytes() -> fromBytes() should be fine', () => {
      const votes = ['+' + genRandHexStr(32), '-' + genRandHexStr(32)];
      const randTX = {
        amount         : 0,
        asset          : {
          votes,
        },
        fee            : 10,
        id             : '8139741256612355994',
        recipientId    : '1233456789012345R',
        senderId       : '1233456789012345R',
        senderPublicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex'),
        signature      : Buffer.from('sig0', 'utf8'),
        signatures     : ['sig1', 'sig2'],
        timestamp      : 0,
        type           : TransactionType.MULTI,
      };
      const bytes1 = instance.getBytes(randTX, false, false);
      const asset1 = instance.fromBytes(bytes1, randTX);
      const randTX2 = {
        ...randTX,
        asset: asset1,
      };
      const bytes2 = instance.getBytes(randTX2, false, false);
      const asset2 = instance.fromBytes(bytes2, randTX2);
      expect(bytes1).to.be.deep.equal(bytes2);
      expect(asset1).to.be.deep.equal(asset2);
      expect(randTX).to.be.deep.equal(randTX2);
    });
  });


  describe('apply', () => {
    let checkConfirmedDelegatesStub: SinonStub;
    let applyDiffArrayStub: SinonStub;
    beforeEach(() => {
      checkConfirmedDelegatesStub = sandbox.stub(instance, 'checkConfirmedDelegates').resolves();
      roundsLogicStub.stubs.calcRound.returns(111);
      accountLogicStub.stubs.merge.resolves();
      applyDiffArrayStub = sandbox.stub(sender, 'applyDiffArray');
    });

    it('should call applyDiffArray with proper values', async () => {
      await instance.apply(tx, block, sender);
      expect(applyDiffArrayStub.called).is.true;
      expect(applyDiffArrayStub.firstCall.args[0]).deep.eq('delegates');
      expect(applyDiffArrayStub.firstCall.args[1]).deep.eq(tx.asset.votes);
    });

    it('should call checkConfirmedDelegates', async () => {
      await instance.apply(tx, block, sender);
      expect(checkConfirmedDelegatesStub.calledOnce).to.be.true;
      expect(checkConfirmedDelegatesStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should return proper ops', async () => {
      checkConfirmedDelegatesStub.resolves();
      const ops = await instance.apply(tx, block, sender);
      expect(ops.length).eq(3 );
      const first: DBRemoveOp<any> = ops[0] as any;
      const second: DBBulkCreateOp<any> = ops[1] as any;
      const third: DBUpdateOp<any> = ops[2] as any;
      const fourth: DBCustomOp<any> = ops[3] as any;
      const fifth: DBCustomOp<any> = ops[4] as any;

      expect({ ... first, model: first.model.getTableName()}).deep.eq({
        type: 'remove',
        model: Accounts2DelegatesModel.getTableName(),
        options: {
          limit: 1,
          where: {
            accountId: tx.senderId,
            dependentId: [
              tx.asset.votes.filter((v) => v[0] === '-')[0].substr(1)
            ],
          },
        },
      });

      expect({ ... second, model: second.model.getTableName()}).deep.eq({
        type: 'bulkCreate',
        model: Accounts2DelegatesModel.getTableName(),
        values: [
          { dependentId: tx.asset.votes[1].substr(1), accountId: tx.senderId}
        ],
      });

      expect({ ... third, model: third.model.getTableName()}).deep.eq({
        type: 'update',
        model: AccountsModel.getTableName(),
        options: { where: { address: tx.senderId }},
        values: { blockId: block.id },
      });

    });

    it('should NOT call accountLogic.merge and roundsLogic.calcRound if checkConfirmedDelegates resolves', async () => {
      checkConfirmedDelegatesStub.rejects();
      await expect(instance.apply(tx, block, sender)).to.be.rejected;
      expect(roundsLogicStub.stubs.calcRound.notCalled).to.be.true;
      expect(accountLogicStub.stubs.merge.notCalled).to.be.true;
    });
  });

  describe('undo', () => {
    let objectNormalizeStub: SinonStub;
    let applyDiffArrayStub: SinonStub;
    beforeEach(() => {
      objectNormalizeStub = sandbox.stub(instance, 'objectNormalize').resolves();
      roundsLogicStub.stubs.calcRound.returns(111);
      accountLogicStub.stubs.merge.resolves();
      applyDiffArrayStub = sandbox.stub(sender, 'applyDiffArray');
    });
    it('should call applyDiffArray with proper values', async () => {
      await instance.undo(tx, block, sender);
      expect(applyDiffArrayStub.called).is.true;
      expect(applyDiffArrayStub.firstCall.args[0]).deep.eq('delegates');
      expect(applyDiffArrayStub.firstCall.args[1]).deep.eq([
        '+7e58fe36588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b381',
        '-05a37e6c6588716f9c9a2bac4bac0a1525e9605abac4153016f95a37e6c6588a',
      ]);
    });

    it('should call objectNormalize', async () => {
      await instance.undo(tx, block, sender);
      expect(objectNormalizeStub.calledOnce).to.be.true;
      expect(objectNormalizeStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should return proper ops', async () => {
      objectNormalizeStub.resolves();
      const ops = await instance.undo(tx, block, sender);
      expect(ops.length).eq(3);
      const first: DBRemoveOp<any> = ops[0] as any;
      const second: DBBulkCreateOp<any> = ops[1] as any;
      const third: DBUpdateOp<any> = ops[2] as any;
      expect({ ... first, model: first.model.getTableName()}).deep.eq({
        type: 'remove',
        model: Accounts2DelegatesModel.getTableName(),
        options: {
          limit: 1,
          where: {
            accountId: tx.senderId,
            dependentId: [
              '05a37e6c6588716f9c9a2bac4bac0a1525e9605abac4153016f95a37e6c6588a'
            ],
          },
        },
      });

      expect({ ... second, model: second.model.getTableName()}).deep.eq({
        type: 'bulkCreate',
        model: Accounts2DelegatesModel.getTableName(),
        values: [
          {
            dependentId: '7e58fe36588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b381',
            accountId: tx.senderId,
          },
        ],
      });

      expect({ ... third, model: third.model.getTableName()}).deep.eq({
        type: 'update',
        model: AccountsModel.getTableName(),
        options: { where: { address: tx.senderId }},
        values: { blockId: block.id },
      });

    });

  });

  describe('checkConfirmedDelegates', () => {
    it('should call delegatesModule.checkConfirmedDelegates and return its result', () => {
      delegatesModuleStub.stubs.checkConfirmedDelegates.returns('test');
      const accountsModel1 = new AccountsModel();
      const retVal = instance.checkConfirmedDelegates(tx, accountsModel1);
      expect(delegatesModuleStub.stubs.checkConfirmedDelegates.calledOnce).to.be.true;
      expect(delegatesModuleStub.stubs.checkConfirmedDelegates.firstCall.args[0]).to.be.deep.equal(accountsModel1);
      expect(delegatesModuleStub.stubs.checkConfirmedDelegates.firstCall.args[1]).to.be.equalTo(tx.asset.votes);
      expect(retVal).to.be.equal('test');
    });
  });

  describe('checkUnconfirmedDelegates', () => {
    it('should call delegatesModule.checkUnconfirmedDelegates and return its result', () => {
      delegatesModuleStub.stubs.checkUnconfirmedDelegates.returns('test');
      const accountsModel1 = new AccountsModel();
      const retVal = instance.checkUnconfirmedDelegates(tx, accountsModel1);
      expect(delegatesModuleStub.stubs.checkUnconfirmedDelegates.calledOnce).to.be.true;
      expect(delegatesModuleStub.stubs.checkUnconfirmedDelegates.firstCall.args[0]).to.be.deep.equal(accountsModel1);
      expect(delegatesModuleStub.stubs.checkUnconfirmedDelegates.firstCall.args[1]).to.be.equalTo(tx.asset.votes);
      expect(retVal).to.be.equal('test');
    });
  });

  describe('applyUnconfirmed', () => {
    let checkUnconfirmedDelegatesStub: SinonStub;
    let applyDiffArrayStub: SinonStub;
    beforeEach(() => {
      checkUnconfirmedDelegatesStub = sandbox.stub(instance, 'checkUnconfirmedDelegates').resolves('yesItIs');
      roundsLogicStub.stubs.calcRound.returns(111);
      accountLogicStub.stubs.merge.resolves();
      applyDiffArrayStub = sandbox.stub(sender, 'applyDiffArray');
    });

    it('should call applyDiffArray with proper values', async () => {
      await instance.applyUnconfirmed(tx, sender);
      expect(applyDiffArrayStub.called).is.true;
      expect(applyDiffArrayStub.firstCall.args[0]).deep.eq('u_delegates');
      expect(applyDiffArrayStub.firstCall.args[1]).deep.eq(tx.asset.votes);
    });

    it('should call checkUnconfirmedDelegates', async () => {
      await instance.applyUnconfirmed(tx, sender);
      expect(checkUnconfirmedDelegatesStub.calledOnce).to.be.true;
      expect(checkUnconfirmedDelegatesStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should return proper ops', async () => {
      checkUnconfirmedDelegatesStub.resolves();
      const ops = await instance.applyUnconfirmed(tx, sender);
      expect(ops.length).eq(2);
      const first: DBRemoveOp<any> = ops[0] as any;
      const second: DBBulkCreateOp<any> = ops[1] as any;

      expect({ ... first, model: first.model.getTableName()}).deep.eq({
        type: 'remove',
        model: Accounts2U_DelegatesModel.getTableName(),
        options: {
          limit: 1,
          where: {
            accountId: tx.senderId,
            dependentId: [
              '7e58fe36588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b381'
            ],
          },
        },
      });

      expect({ ... second, model: second.model.getTableName()}).deep.eq({
        type: 'bulkCreate',
        model: Accounts2U_DelegatesModel.getTableName(),
        values: [
          {
            dependentId: '05a37e6c6588716f9c9a2bac4bac0a1525e9605abac4153016f95a37e6c6588a',
            accountId: tx.senderId,
          },
        ],
      });
    });

    it('should NOT call accountLogic.merge if checkUnconfirmedDelegates resolves', async () => {
      checkUnconfirmedDelegatesStub.rejects();
      await expect(instance.applyUnconfirmed(tx, sender)).to.be.rejected;
      expect(accountLogicStub.stubs.merge.notCalled).to.be.true;
    });
  });

  describe('undoUnconfirmed', () => {
    let objectNormalizeStub: SinonStub;
    let applyDiffArrayStub: SinonStub;

    beforeEach(() => {
      objectNormalizeStub = sandbox.stub(instance, 'objectNormalize').resolves();
      roundsLogicStub.stubs.calcRound.returns(111);
      accountLogicStub.stubs.merge.resolves();
      applyDiffArrayStub = sandbox.stub(sender, 'applyDiffArray');
    });
    it('should call applyDiffArray with proper values', async () => {
      await instance.undoUnconfirmed(tx, sender);
      expect(applyDiffArrayStub.called).is.true;
      expect(applyDiffArrayStub.firstCall.args[0]).deep.eq('u_delegates');
      expect(applyDiffArrayStub.firstCall.args[1]).deep.eq([
        '+7e58fe36588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b381',
        '-05a37e6c6588716f9c9a2bac4bac0a1525e9605abac4153016f95a37e6c6588a',
      ]);
    });

    it('should call objectNormalize', async () => {
      await instance.undoUnconfirmed(tx, sender);
      expect(objectNormalizeStub.calledOnce).to.be.true;
      expect(objectNormalizeStub.firstCall.args[0]).to.be.deep.equal(tx);
    });


    it('should call accountLogic.merge if objectNormalize resolves', async () => {
      objectNormalizeStub.resolves();
      const ops = await instance.undoUnconfirmed(tx, sender);
      expect(ops.length).eq(2);
      const first: DBRemoveOp<any> = ops[0] as any;
      const second: DBBulkCreateOp<any> = ops[1] as any;

      expect({ ... first, model: first.model.getTableName()}).deep.eq({
        type: 'remove',
        model: Accounts2U_DelegatesModel.getTableName(),
        options: {
          limit: 1,
          where: {
            accountId: tx.senderId,
            dependentId: [
              '05a37e6c6588716f9c9a2bac4bac0a1525e9605abac4153016f95a37e6c6588a'
            ],
          },
        },
      });

      expect({ ... second, model: second.model.getTableName()}).deep.eq({
        type: 'bulkCreate',
        model: Accounts2U_DelegatesModel.getTableName(),
        values: [
          {
            dependentId: '7e58fe36588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b381',
            accountId: tx.senderId,
          },
        ],
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
      expect(zSchemaStub.validate.firstCall.args[0]).to.be.deep.equal(tx.asset);
      expect(zSchemaStub.validate.firstCall.args[1]).to.be.deep.equal(voteSchema);
    });

    it('should throw if validation fails', () => {
      zSchemaStub.validate.returns(false);
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw(/Failed to validate vote schema/);
    });

    it('should throw with errors message if validation fails', () => {
      (instance as any).schema.getLastErrors = () => [{message: '1'}, {message: '2'}];
      zSchemaStub.validate.returns(false);
      expect(() => {
        instance.objectNormalize(tx);
      }).to.throw('Failed to validate vote schema: 1, 2');
    });

    it('should return the tx', () => {
      const retVal = instance.objectNormalize(tx);
      expect(retVal).to.be.deep.equal(tx);
    });
  });

  describe('dbRead', () => {
    it('should return null if !v_votes', () => {
      const retVal = instance.dbRead({});
      expect(retVal).to.be.null;
    });

    it('should return the votes object', () => {
      const retVal = instance.dbRead({
        v_votes: tx.asset.votes.join(','),
      });
      expect(retVal).to.be.deep.equal({
        votes: tx.asset.votes,
      });
    });
  });

  describe('dbSave', () => {
    it('should return the expecteddb object', () => {
      const op: DBCreateOp<any> = instance.dbSave(tx) as any;
      expect(op.type).eq('create');
      expect(op.model).deep.eq(votesModel);
      expect(op.values).deep.eq({
        transactionId: tx.id,
        votes        : tx.asset.votes.join(','),
      });
    });
  });

  describe('assertValidVote', () => {
    it('should throw if vote is not a string', () => {
      expect(() => {
        (instance as any).assertValidVote(1111);
      }).to.throw('Invalid vote type');
    });

    it('should throw if vote does not start with + or -', () => {
      expect(() => {
        (instance as any).assertValidVote('#vote');
      }).to.throw('Invalid vote format');
    });

    it('should call schema.validate', () => {
      zSchemaStub.validate.returns(true);
      (instance as any).assertValidVote(tx.asset.votes[0]);
      expect(zSchemaStub.validate.calledOnce).to.be.true;
      expect(zSchemaStub.validate.firstCall.args[0]).to.be.equal(tx.asset.votes[0].substring(1));
      expect(zSchemaStub.validate.firstCall.args[1]).to.be.deep.equal({ format: 'publicKey' });
    });

    it('should throw if schema.validate fails', () => {
      zSchemaStub.validate.returns(false);
      expect(() => {
        (instance as any).assertValidVote(tx.asset.votes[1]);
      }).to.throw('Invalid vote publicKey');
    });
  });

  describe('attachAssets', () => {
    let modelFindAllStub: SinonStub;
    beforeEach(() => {
      modelFindAllStub = sandbox.stub(votesModel, 'findAll');
    });
    it('should do do nothing if result is empty', async () => {
      modelFindAllStub.resolves([]);
      await instance.attachAssets([]);
    });
    it('should throw if a tx was provided but not returned by model.findAll', async () => {
      modelFindAllStub.resolves([]);
      await expect(instance.attachAssets([{id: 'ciao'}] as any))
        .rejectedWith('Couldn\'t restore asset for Vote tx: ciao');
    });
    it('should use model result and modify original arr', async () => {
      modelFindAllStub.resolves([
        { transactionId: 2, votes: '+cc,-dd'},
        { transactionId: 1, votes: '+aa,-bb'},
      ]);
      const txs: any = [{id: 1}, {id: 2}];

      await instance.attachAssets(txs);

      expect(txs[0]).deep.eq({
        id: 1, asset: {
          votes: [
            '+aa',
            '-bb',
          ],
        },
      });
      expect(txs[1]).deep.eq({
        id: 2, asset: {
          votes: [
            '+cc',
            '-dd',
          ],
        },
      });
    });
  });
});
