import * as chai from 'chai';
import * as fs from 'fs';
import { Op } from 'sequelize';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { Container } from 'inversify';
import { IAccountsModel, IBlocksModel } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { Symbols } from '@risevision/core-interfaces';
import { dPoSSymbols, RoundChanges } from '../../../src/helpers';
import { RoundLogic } from '../../../src/logic/round';
import { ModelSymbols } from '@risevision/core-models';

const expect = chai.expect;

const pgpStub    = { as: undefined } as any;

// tslint:disable no-unused-expression
describe('logic/round', () => {
  let sandbox: SinonSandbox;
  let instance;
  let scope;
  let container: Container;
  let accountsModel: typeof IAccountsModel;
  let blocksModel: typeof IBlocksModel;
  let roundLogic: typeof RoundLogic;
  beforeEach(async () => {
    sandbox       = sinon.createSandbox();
    container     = await createContainer(['core-consensus-dpos', 'core-helpers']);
    accountsModel = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    blocksModel   = container.getNamed(ModelSymbols.model, Symbols.models.blocks);
    roundLogic    = container.get(dPoSSymbols.logic.round);

    scope    = {
      backwards     : false,
      block         : {
        generatorPublicKey: Buffer.from('9d3058175acab969f41ad9b86f7a2926c74258670fe56b37c429c01fca9f2f0f', 'hex'),
        height            : 2,
        id                : '1',
      },
      library       : {
        logger: {
          debug: sandbox.stub(),
          trace: sandbox.stub(),
        },
        RoundChanges: container.get(dPoSSymbols.helpers.roundChanges),
      },
      modules       : {
        accounts: {
          generateAddressByPublicKey: sandbox.stub().returns(1),
          mergeAccountAndGetOPs     : sandbox.stub().returns([]),
        },
      },
      models        : {
        AccountsModel: accountsModel,
        BlocksModel  : blocksModel
      },
      round         : 10,
      roundDelegates: [{}],
      roundFees     : {},
      roundOutsiders: ['1', '2', '3'],
      roundRewards  : {},
    };
    instance = new roundLogic(scope, container.get(dPoSSymbols.helpers.slots));
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should throw an error when a property is missing', () => {
      const scopeOriginal      = Object.assign({}, scope);
      const requiredProperties = [
        'library',
        'modules',
        'block',
        'round',
        'backwards',
      ];

      requiredProperties.forEach((prop) => {
        scope = Object.assign({}, scopeOriginal);

        delete scope[prop];
        const throwError = () => {
          new roundLogic(scope, container.get(dPoSSymbols.helpers.slots));
        };
        expect(throwError).to.throw();
      });
    });

    it('should throw error if finishRound and missing requiredProperty', () => {
      scope.finishRound        = true;
      const scopeOriginal      = Object.assign({}, scope);
      const requiredProperties = [
        'library',
        'modules',
        'block',
        'round',
        'backwards',
        'roundFees',
        'roundRewards',
        'roundDelegates',
        'roundOutsiders',
      ];

      requiredProperties.forEach((prop) => {
        scope = Object.assign({}, scopeOriginal);

        delete scope[prop];
        const throwError = () => {
          new roundLogic(scope, container.get(dPoSSymbols.helpers.slots));
        };
        expect(throwError).to.throw();
      });
    });

    it('success', () => {
      expect(instance.scope).to.be.deep.equal(scope);
      // expect(instance.task).to.be.deep.equal(task);
    });
  });

  // describe('mergeBlockGenerator', () => {
  //   it('should call mergeAccountAndGetOPs', async () => {
  //     await instance.mergeBlockGenerator();
  //     expect(scope.modules.accounts.mergeAccountAndGetOPs.calledOnce).to.equal(true);
  //     expect(scope.modules.accounts.mergeAccountAndGetOPs.firstCall.args[0]).to.deep.equal({
  //       blockId       : scope.block.id,
  //       producedblocks: scope.backwards ? -1 : 1,
  //       publicKey     : scope.block.generatorPublicKey,
  //       // round         : scope.round,
  //     });
  //   });
  // });

  describe('updateMissedBlocks', () => {
    it('should return null roundOutsiders is empty', async () => {
      scope.roundOutsiders = [];
      const ar             = await instance.updateMissedBlocks();
      expect(ar).to.be.null;
    });

    it('should return result from updateMissedBlocks', async () => {
      const retVal             = await instance.updateMissedBlocks();
      expect(retVal.model).to.be.deep.eq(accountsModel);
      delete retVal.model; // causes memory issue
      expect(retVal).to.be.deep.eq({
        options: { where: { address: { [Op.in]: scope.roundOutsiders } } },
        type   : 'update',
        values : { missedblocks: { val: 'missedblocks + 1' } },
      });

      // chai does not support deep eq on obj with symbols
      expect(retVal.options.where.address[Op.in]).to.be.deep.eq(scope.roundOutsiders);
    });
  });

  describe('updateVotes', () => {

    it('should return custom DBOp with RoundsModel SQL', () => {
      scope.round = 10;
      const ret   = instance.updateVotes();
      expect(ret.type).is.eq('custom');
      expect(ret.model).is.deep.eq(accountsModel);
      expect(ret.query).is.deep.eq(fs.readFileSync(`${__dirname}/../../../sql/recalcVotes.sql`, {encoding: 'utf8'}));
    });
  });

  describe('markBlockId', () => {
    it('should return null if backwards is true', () => {
      scope.backwards = false;
      expect(instance.markBlockId()).is.null;
    });
    it('should return update dbop if is not backward setting blockId to "0"', () => {
      scope.backwards = true;
      const res = instance.markBlockId();
      expect(res.model).to.be.deep.eq(accountsModel);
      expect(res.options).to.be.deep.eq({
        where: { blockId: scope.block.id },
      });
      expect(res.type).to.be.eq('update');
      expect(res.values).to.be.deep.eq({ blockId: '0' });
    });

  });


  describe('restoreVotesSnapshot', () => {
    it('should return custom op over accountsModel', () => {
      const res = instance.restoreVotesSnapshot();
      expect(res.model).to.be.deep.eq(accountsModel);
      expect(res.type).to.be.deep.eq('custom');
      // TODO: test query?
    });
  });

  describe('applyRound', () => {
    let at: SinonStub;
    beforeEach(() => {
      const rc = container.get<typeof RoundChanges>(dPoSSymbols.helpers.roundChanges);
      at = sandbox.stub(rc.prototype, 'at');
    })

    it('should apply round changes to each delegate, with backwards false and fees > 0', async () => {
      at.returns({
        feesRemaining: 10,
      });

      const retVal = await instance.applyRound();

      expect(at.calledTwice).to.be.true;
      expect(at.firstCall.args.length).to.equal(1);
      expect(at.firstCall.args[0]).to.equal(0);
      expect(at.secondCall.args[0]).to.equal(0);
      expect(scope.library.logger.trace.calledThrice).to.be.true;
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
        'Delegate changes'
      );
      expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
        changes : {
          feesRemaining: 10,
        },
        delegate: {},
      });
      expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
        'Fees remaining'
      );
      expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal({
        delegate: {},
        fees    : 10,
        index   : 0,
      });
      expect(scope.library.logger.trace.thirdCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.thirdCall.args[0]).to.be.equal(
        'Applying round'
      );
      // TODO: Check this ->
      expect(retVal).to.deep.equal([]);
    });

    it('should behave correctly when backwards false, fees > 0 && feesRemaining > 0', async () => {
      at.returns({
        feesRemaining: 1,
        balance: 10,
        fees: 5,
        rewards: 4,
      });
      scope.roundDelegates = [Buffer.from('aa', 'hex'), Buffer.from('bb', 'hex')];

      const retVal = await instance.applyRound();

      expect(at.calledThrice).to.be.true;
      expect(at.firstCall.args[0]).to.equal(0);
      expect(at.secondCall.args[0]).to.equal(1);
      expect(at.thirdCall.args[0]).to.equal(1);

      expect(scope.modules.accounts.mergeAccountAndGetOPs.calledThrice).is.true;
      expect(scope.modules.accounts.mergeAccountAndGetOPs.firstCall.args[0]).is.deep.eq({
        balance: 10,
        blockId: '1',
        fees: 5,
        producedblocks: 1,
        publicKey: Buffer.from('aa', 'hex'),
        rewards: 4,
        u_balance: 10,
        round: 10
      });
      expect(scope.modules.accounts.mergeAccountAndGetOPs.secondCall.args[0]).is.deep.eq({
        balance: 10,
        blockId: '1',
        fees: 5,
        producedblocks: 1,
        publicKey: Buffer.from('bb', 'hex'),
        rewards: 4,
        u_balance: 10,
        round: 10
      });
      // Remainder of 1 feesRemaining
      expect(scope.modules.accounts.mergeAccountAndGetOPs.thirdCall.args[0]).is.deep.eq({
        balance: 1,
        blockId: '1',
        fees: 1,
        publicKey: Buffer.from('bb', 'hex'),
        u_balance: 1,
        round: 10
      });

      expect(retVal).to.be.deep.eq([]);

    });
  });

  describe('land', () => {
    it('should call correct methods', async () => {
      const updateVotes        = sandbox.stub(instance, 'updateVotes').returns({updateVote: true});
      const updateMissedBlocks = sandbox.stub(instance, 'updateMissedBlocks').returns({updateMissed: true});
      const performVotesSnapshot = sandbox.stub(instance, 'performVotesSnapshot').returns({performVotesSnapshot: true});
      const applyRound         = sandbox.stub(instance, 'applyRound').returns([{apply: 1}, {apply: 2}]);

      const res = instance.land();

      expect(performVotesSnapshot.calledOnce).to.be.true;
      expect(updateVotes.calledOnce).to.be.true;
      expect(updateMissedBlocks.calledOnce).to.be.true;
      expect(applyRound.calledOnce).to.be.true;

      updateVotes.restore();
      updateMissedBlocks.restore();
      applyRound.restore();

      expect(res).to.be.deep.eq([
        { updateMissed: true},
        { apply: 1},
        { apply: 2},
        { performVotesSnapshot: true},
        { updateVote: true},
      ]);
    });

  });

  describe('backwardLand', () => {
    it('should call correct methods', async () => {
      const updateMissedBlocks = sandbox.stub(instance, 'updateMissedBlocks').returns({updateMissed: true});
      const applyRound         = sandbox.stub(instance, 'applyRound').returns([{apply: 1}, {apply: 2}]);
      const restoreVotesSnapshot = sandbox.stub(instance, 'restoreVotesSnapshot').returns({restorevotes: true});

      const res = instance.backwardLand();

      expect(updateMissedBlocks.calledOnce).to.be.true;
      expect(applyRound.calledOnce).to.be.true;
      expect(restoreVotesSnapshot.calledOnce).to.be.true;

      updateMissedBlocks.restore();
      applyRound.restore();
      restoreVotesSnapshot.restore();

      expect(res).to.be.deep.eq([
        { updateMissed: true},
        { apply: 1},
        { apply: 2},
        { restorevotes: true},
      ]);
    });

  });

});
