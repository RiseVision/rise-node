import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {Container} from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { TransactionType } from '../../../../src/helpers';
import {Symbols} from '../../../../src/ioc/symbols';
import { VoteTransaction } from '../../../../src/logic/transactions';
import voteSchema from '../../../../src/schema/logic/transactions/vote';
import { AccountLogicStub, DelegatesModuleStub, RoundsLogicStub, SystemModuleStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';
import { AccountsModel, VotesModel } from '../../../../src/models';

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
      publicKey: Buffer.from('6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3', 'hex')
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

  describe('apply', () => {
    let checkConfirmedDelegatesStub: SinonStub;
    beforeEach(() => {
      checkConfirmedDelegatesStub = sandbox.stub(instance, 'checkConfirmedDelegates').resolves();
      roundsLogicStub.stubs.calcRound.returns(111);
      accountLogicStub.stubs.merge.resolves();
    });

    it('should call checkConfirmedDelegates', async () => {
      await instance.apply(tx, block, sender);
      expect(checkConfirmedDelegatesStub.calledOnce).to.be.true;
      expect(checkConfirmedDelegatesStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should call accountLogic.merge and roundsLogic.calcRound if checkConfirmedDelegates resolves', async () => {
      checkConfirmedDelegatesStub.resolves();
      await instance.apply(tx, block, sender);
      expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(block.height);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.deep.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        blockId  : block.id,
        delegates: tx.asset.votes,
        round    : 111,
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
    beforeEach(() => {
      objectNormalizeStub = sandbox.stub(instance, 'objectNormalize').resolves();
      roundsLogicStub.stubs.calcRound.returns(111);
      accountLogicStub.stubs.merge.resolves();
    });

    it('should call objectNormalize', async () => {
      await instance.undo(tx, block, sender);
      expect(objectNormalizeStub.calledOnce).to.be.true;
      expect(objectNormalizeStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should call accountLogic.merge and roundsLogic.calcRound if objectNormalize resolves', async () => {
      objectNormalizeStub.resolves();
      await instance.undo(tx, block, sender);
      expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(block.height);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.deep.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        blockId  : block.id,
        delegates: [
          '+7e58fe36588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b381',
          '-05a37e6c6588716f9c9a2bac4bac0a1525e9605abac4153016f95a37e6c6588a',
        ],
        round    : 111,
      });
    });

    it('should NOT call accountLogic.merge and roundsLogic.calcRound if objectNormalize rejects', async () => {
      objectNormalizeStub.throws('test');
      await  expect(instance.undo(tx, block, sender)).to.be.rejected;
      expect(roundsLogicStub.stubs.calcRound.notCalled).to.be.true;
      expect(accountLogicStub.stubs.merge.notCalled).to.be.true;
    });
  });

  describe('checkConfirmedDelegates', () => {
    it('should call delegatesModule.checkConfirmedDelegates and return its result', () => {
      delegatesModuleStub.stubs.checkConfirmedDelegates.returns('test');
      const retVal = instance.checkConfirmedDelegates(tx);
      expect(delegatesModuleStub.stubs.checkConfirmedDelegates.calledOnce).to.be.true;
      expect(delegatesModuleStub.stubs.checkConfirmedDelegates.firstCall.args[0]).to.be.equal(tx.senderPublicKey);
      expect(delegatesModuleStub.stubs.checkConfirmedDelegates.firstCall.args[1]).to.be.equalTo(tx.asset.votes);
      expect(retVal).to.be.equal('test');
    });
  });

  describe('checkUnconfirmedDelegates', () => {
    it('should call delegatesModule.checkUnconfirmedDelegates and return its result', () => {
      delegatesModuleStub.stubs.checkUnconfirmedDelegates.returns('test');
      const retVal = instance.checkUnconfirmedDelegates(tx);
      expect(delegatesModuleStub.stubs.checkUnconfirmedDelegates.calledOnce).to.be.true;
      expect(delegatesModuleStub.stubs.checkUnconfirmedDelegates.firstCall.args[0]).to.be.equal(tx.senderPublicKey);
      expect(delegatesModuleStub.stubs.checkUnconfirmedDelegates.firstCall.args[1]).to.be.equalTo(tx.asset.votes);
      expect(retVal).to.be.equal('test');
    });
  });

  describe('applyUnconfirmed', () => {
    let checkUnconfirmedDelegatesStub: SinonStub;
    beforeEach(() => {
      checkUnconfirmedDelegatesStub = sandbox.stub(instance, 'checkUnconfirmedDelegates').resolves('yesItIs');
      roundsLogicStub.stubs.calcRound.returns(111);
      accountLogicStub.stubs.merge.resolves();
    });

    it('should call checkUnconfirmedDelegates', async () => {
      await instance.applyUnconfirmed(tx, sender);
      expect(checkUnconfirmedDelegatesStub.calledOnce).to.be.true;
      expect(checkUnconfirmedDelegatesStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should call accountLogic.merge if checkUnconfirmedDelegates resolves', async () => {
      checkUnconfirmedDelegatesStub.resolves();
      await instance.applyUnconfirmed(tx, sender);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.deep.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({ u_delegates: tx.asset.votes });
    });

    it('should NOT call accountLogic.merge if checkUnconfirmedDelegates resolves', async () => {
      checkUnconfirmedDelegatesStub.rejects();
      await expect(instance.applyUnconfirmed(tx, sender)).to.be.rejected;
      expect(accountLogicStub.stubs.merge.notCalled).to.be.true;
    });
  });

  describe('undoUnconfirmed', () => {
    let objectNormalizeStub: SinonStub;
    beforeEach(() => {
      objectNormalizeStub = sandbox.stub(instance, 'objectNormalize').resolves();
      roundsLogicStub.stubs.calcRound.returns(111);
      accountLogicStub.stubs.merge.resolves();
    });

    it('should call objectNormalize', async () => {
      await instance.undoUnconfirmed(tx, sender);
      expect(objectNormalizeStub.calledOnce).to.be.true;
      expect(objectNormalizeStub.firstCall.args[0]).to.be.deep.equal(tx);
    });

    it('should call accountLogic.merge if objectNormalize resolves', async () => {
      objectNormalizeStub.resolves();
      await instance.undoUnconfirmed(tx, sender);
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.firstCall.args[0]).to.be.deep.equal(sender.address);
      expect(accountLogicStub.stubs.merge.firstCall.args[1]).to.be.deep.equal({
        u_delegates: [
          '+7e58fe36588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b381',
          '-05a37e6c6588716f9c9a2bac4bac0a1525e9605abac4153016f95a37e6c6588a',
        ],
      });
    });

    it('should NOT call accountLogic.merge and roundsLogic.calcRound if objectNormalize rejects', async () => {
      objectNormalizeStub.throws('test');
      await  expect(instance.undoUnconfirmed(tx, sender)).to.be.rejected;
      expect(accountLogicStub.stubs.merge.notCalled).to.be.true;
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
      const op = instance.dbSave(tx);
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

});
