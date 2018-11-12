import * as chai from 'chai';
import * as proxyquire from 'proxyquire';
import { Op } from 'sequelize';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import * as helpers from '../../../src/helpers/';
import roundSQL from '../../../src/sql/logic/rounds';
import { createContainer } from '../../utils/containerCreator';
import { Container } from 'inversify';
import { Symbols } from '../../../src/ioc/symbols';
import { AccountsModel, BlocksModel, RoundsModel } from '../../../src/models';
import { RoundLogicScope } from '../../../src/logic';
import { createFakeBlock } from '../../utils/blockCrafter';

const expect = chai.expect;

const pgpStub    = { as: undefined } as any;
const ProxyRound = proxyquire('../../../src/logic/round.ts', {
  '../helpers/'        : helpers,
  '../sql/logic/rounds': roundSQL,
  'pg-promise'         : pgpStub,
});

// tslint:disable no-unused-expression
describe('logic/round', () => {
  let sandbox: SinonSandbox;
  let instance;
  let scope: RoundLogicScope;
  let container: Container;
  let accountsModel: typeof AccountsModel;
  let roundsModel: typeof RoundsModel;
  let blocksModel: typeof BlocksModel;
  beforeEach(() => {
    sandbox       = sinon.createSandbox();
    container     = createContainer();
    accountsModel = container.get(Symbols.models.accounts);
    roundsModel   = container.get(Symbols.models.rounds);
    blocksModel   = container.get(Symbols.models.blocks);

    scope   = {
      backwards     : false,
      dposV2: false,
      finishRound: false,
      block         : createFakeBlock(),
      library       : {
        logger: {
          debug: sandbox.stub(),
          trace: sandbox.stub(),
        } as any,
      },
      modules       : {
        accounts: {
          generateAddressByPublicKey: sandbox.stub().returns(1),
          mergeAccountAndGetOPs     : sandbox.stub().returns([]),
        } as any,
      },
      models        : {
        AccountsModel: container.get(Symbols.models.accounts),
        BlocksModel  : container.get(Symbols.models.blocks),
        RoundsModel  : container.get(Symbols.models.rounds),
      },
      round         : 10,
      roundDelegates: [Buffer.from('aa', 'hex'), Buffer.from('bb', 'hex')],
      roundFees     : {},
      roundOutsiders: ['1', '2', '3'],
      roundRewards  : [],
    };
    instance = new ProxyRound.RoundLogic(scope, container.get(Symbols.helpers.slots));
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
          new ProxyRound.RoundLogic(scope);
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
          new ProxyRound.RoundLogic(scope);
        };
        expect(throwError).to.throw();
      });
    });

    it('success', () => {
      expect(instance.scope).to.be.deep.equal(scope);
      // expect(instance.task).to.be.deep.equal(task);
    });
  });

  describe('mergeBlockGenerator', () => {
    it('should call mergeAccountAndGetOPs', async () => {
      await instance.mergeBlockGenerator();
      expect((scope.modules.accounts.mergeAccountAndGetOPs as any).calledOnce).to.equal(true);
      expect((scope.modules.accounts.mergeAccountAndGetOPs as any).firstCall.args[0]).to.deep.equal({
        blockId       : scope.block.id,
        producedblocks: scope.backwards ? -1 : 1,
        publicKey     : scope.block.generatorPublicKey,
        round         : scope.round,
      });
    });
  });

  describe('updateMissedBlocks', () => {
    it('should return null roundOutsiders is empty', async () => {
      scope.roundOutsiders = [];
      const instanceTest   = new ProxyRound.RoundLogic(scope, container.get(Symbols.helpers.slots));
      const ar             = await instanceTest.updateMissedBlocks();
      expect(ar).to.be.null;
    });

    it('should return result from updateMissedBlocks', async () => {
      const updateMissedBlocks = sandbox.stub(roundSQL, 'updateMissedBlocks').returns(true);
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
      updateMissedBlocks.restore();
    });
  });

  describe('reCalcVotes', () => {

    it('should return custom DBOp with reCalcVotes SQL', () => {
      const ret   = instance.reCalcVotes();
      expect(ret.type).is.eq('custom');
      expect(ret.model).is.deep.eq(roundsModel);
      expect(ret.query).is.deep.eq(roundSQL.reCalcVotes);
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


  describe('truncateBlocks', () => {
    it('should return a remove operation over blocksModel for heights > than given block height', () => {
      const res = instance.truncateBlocks();
      expect(res.model).to.be.deep.eq(blocksModel);
      expect(res.type).to.be.deep.eq('remove');
      expect(res.options).to.be.deep.eq({where: { height: { [Op.gt]: scope.block.height }}});
      expect(res.options.where.height[Op.gt]).to.be.deep.eq(scope.block.height);
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
    let roundChangesOriginal;
    let at: SinonStub;
    let RoundChanges;

    beforeEach(() => {
      roundChangesOriginal          = helpers.RoundChanges;
      at                            = sandbox.stub();
      RoundChanges                  = function RoundChangesFake() {
        return { at };
      };
      (helpers.RoundChanges as any) = RoundChanges;
    });

    afterEach(() => {
      (helpers.RoundChanges as any) = roundChangesOriginal;
    });

    it('should apply round changes to each delegate, with backwards false and fees > 0', async () => {
      at.returns({
        feesRemaining: 10,
      });

      scope.roundDelegates = [Buffer.from('aa', 'hex')];
      const retVal = await instance.applyRound();

      expect(at.calledTwice).to.be.true;
      expect(at.firstCall.args.length).to.equal(1);
      expect(at.firstCall.args[0]).to.equal(0);
      expect(at.secondCall.args[0]).to.equal(0);
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

      expect((scope.modules.accounts.mergeAccountAndGetOPs as SinonStub).calledThrice).is.true;
      expect((scope.modules.accounts.mergeAccountAndGetOPs as SinonStub).firstCall.args[0]).is.deep.eq({
        balance: 10,
        blockId: scope.block.id,
        fees: 5,
        publicKey: Buffer.from('aa', 'hex'),
        rewards: 4,
        u_balance: 10,
        round: 10
      });
      expect((scope.modules.accounts.mergeAccountAndGetOPs as SinonStub).secondCall.args[0]).is.deep.eq({
        balance: 10,
        blockId: scope.block.id,
        fees: 5,
        publicKey: Buffer.from('bb', 'hex'),
        rewards: 4,
        u_balance: 10,
        round: 10
      });
      // Remainder of 1 feesRemaining
      expect((scope.modules.accounts.mergeAccountAndGetOPs as SinonStub).thirdCall.args[0]).is.deep.eq({
        balance: 1,
        blockId: scope.block.id,
        fees: 1,
        publicKey: Buffer.from('bb', 'hex'),
        u_balance: 1,
        round: 10
      });

      expect(retVal).to.be.deep.eq([]);

    });
  });

  describe('land', () => {
    let updateMissedBlocks: SinonStub;
    let applyRound: SinonStub;
    let reCalcVotes: SinonStub;
    beforeEach(() => {
      updateMissedBlocks = sandbox.stub(instance, 'updateMissedBlocks').returns({updateMissed: true});
      applyRound         = sandbox.stub(instance, 'applyRound').returns([{apply: 1}, {apply: 2}]);
      reCalcVotes        = sandbox.stub(instance, 'reCalcVotes');
      reCalcVotes.onCall(0).returns({reCalcVotes: 1});
      reCalcVotes.onCall(1).returns({reCalcVotes: 2});

    });
    it('should call correct methods for finishRound v1', async () => {
      scope.finishRound = true;
      scope.dposV2 = false;
      const res = instance.apply();

      expect(updateMissedBlocks.calledOnce).to.be.true;
      expect(applyRound.calledOnce).to.be.true;
      expect(reCalcVotes.calledOnce).to.be.true;

      updateMissedBlocks.restore();
      applyRound.restore();

      expect(res).to.be.deep.eq([
        { updateMissed: true },
        { apply: 1 },
        { apply: 2 },
        { type: 'custom', query: roundSQL.performVotesSnapshot, model: scope.models.AccountsModel },
        { reCalcVotes: 1 },
      ]);
    });

  });

  describe('backwardLand', () => {
    let updateMissedBlocks: SinonStub;
    let applyRound: SinonStub;
    let restoreVotesSnapshot: SinonStub;
    let reCalcVotes: SinonStub;
    beforeEach(() => {
      updateMissedBlocks = sandbox.stub(instance, 'updateMissedBlocks').returns({updateMissed: true});
      applyRound         = sandbox.stub(instance, 'applyRound').returns([{apply: 1}, {apply: 2}]);
      restoreVotesSnapshot = sandbox.stub(instance, 'restoreVotesSnapshot').returns({restorevotes: true});
      reCalcVotes        = sandbox.stub(instance, 'reCalcVotes');
      reCalcVotes.onCall(0).returns({reCalcVotes: 1});
      reCalcVotes.onCall(1).returns({reCalcVotes: 2});
    })
    it('should call correct methods and return proper data for v1 finishRound', async () => {
      scope.dposV2 = false;
      scope.finishRound = true;
      const res = instance.undo();

      expect(updateMissedBlocks.calledOnce).to.be.true;
      expect(applyRound.calledOnce).to.be.true;
      expect(restoreVotesSnapshot.calledOnce).to.be.true;

      updateMissedBlocks.restore();
      applyRound.restore();

      expect(res).to.be.deep.eq([
        { updateMissed: true},
        { apply: 1},
        { apply: 2},
        { restorevotes: true},
      ]);
    });

  });

});
