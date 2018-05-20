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
  let scope;
  let container: Container;
  let accountsModel: typeof AccountsModel;
  let roundsModel: typeof RoundsModel;
  let blocksModel: typeof BlocksModel;
  beforeEach(() => {
    sandbox       = sinon.sandbox.create();
    container     = createContainer();
    accountsModel = container.get(Symbols.models.accounts);
    roundsModel   = container.get(Symbols.models.rounds);
    blocksModel   = container.get(Symbols.models.blocks);

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
      },
      modules       : {
        accounts: {
          generateAddressByPublicKey: sandbox.stub().returns(1),
          mergeAccountAndGetOPs     : sandbox.stub().returns([]),
        },
      },
      models        : {
        AccountsModel: container.get(Symbols.models.accounts),
        BlocksModel  : container.get(Symbols.models.blocks),
        RoundsModel  : container.get(Symbols.models.rounds),
      },
      round         : 10,
      roundDelegates: [{}],
      roundFees     : {},
      roundOutsiders: ['1', '2', '3'],
      roundRewards  : {},
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
      expect(scope.modules.accounts.mergeAccountAndGetOPs.calledOnce).to.equal(true);
      expect(scope.modules.accounts.mergeAccountAndGetOPs.firstCall.args[0]).to.deep.equal({
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


  describe('updateVotes', () => {

    it('should return custom DBOp with RoundsModel SQL', () => {
      scope.round = 10;
      const ret   = instance.updateVotes();
      expect(ret.type).is.eq('custom');
      expect(ret.model).is.deep.eq(accountsModel);
      expect(ret.query).is.deep.eq(roundsModel.updateVotesSQL(10));
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
        where: { blockId: scope.block.id }
      });
      expect(res.type).to.be.eq('update');
      expect(res.values).to.be.eq({ blockId: '0' });
    });

  });

  describe('flushRound', () => {
    it('should return a remove operation over roundsModel using round as where', () => {
      const res = instance.flushRound();

      expect(res.model).to.be.deep.eq(roundsModel);
      expect(res.type).to.be.deep.eq('remove');
      expect(res.options).to.be.deep.eq({
        where: { round: scope.round }
      });
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

  describe('restoreRoundSnapshot', () => {
    it('should return custom op over roundsModel', () => {
      const res = instance.restoreRoundSnapshot();
      expect(res.model).to.be.deep.eq(roundsModel);
      expect(res.type).to.be.deep.eq('custom');
      // TODO: test query?
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

    it('should behave correctly when no delegates, backwards false, fees > 0', async () => {
      at.returns({
        feesRemaining: 10,
      });
      scope.roundDelegates = [];

      const retVal = await instance.applyRound();

      expect(at.calledOnce).to.be.true;
      expect(at.firstCall.args.length).to.equal(1);
      expect(at.firstCall.args[0]).to.equal(-1);
      expect(scope.library.logger.trace.calledTwice).to.be.true;
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
        'Fees remaining'
      );
      expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
        delegate: undefined,
        fees    : 10,
        index   : -1,
      });
      expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
        'Applying round'
      );
      expect(retVal).to.equal('none works');

    });

    it('should apply round changes to each delegate when backwards false, fees = 0', async () => {
      at.returns({
        feesRemaining: 0,
      });
      const retVal = await instance.applyRound();

      expect(at.calledTwice).to.be.true;
      expect(at.firstCall.args.length).to.equal(1);
      expect(at.firstCall.args[0]).to.equal(0);
      expect(at.secondCall.args[0]).to.equal(0);
      expect(scope.library.logger.trace.calledTwice).to.be.true;
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
        'Delegate changes'
      );
      expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
        changes : {
          feesRemaining: 0,
        },
        delegate: {},
      });
      expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
        'Applying round'
      );
      expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal(['yesSQL']);
      expect(retVal).to.equal('none works');
      expect(task.none.calledOnce).to.be.true;
      expect(task.none.firstCall.args.length).to.equal(1);
      expect(task.none.firstCall.args[0]).to.equal('yesSQL');
    });

    it('should behave correctly when no delegates, backwards false, fees = 0', async () => {
      at.returns({
        feesRemaining: 0,
      });
      scope.roundDelegates = [];

      instance = new ProxyRound.RoundLogic(scope, task);
      await instance.applyRound();

      expect(at.calledOnce).to.be.true;
      expect(at.firstCall.args.length).to.equal(1);
      expect(at.firstCall.args[0]).to.equal(-1);
      expect(scope.library.logger.trace.calledOnce).to.be.true;
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
        'Applying round'
      );
      expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal([]);
      expect(task.none.notCalled).is.true;
    });

    it('should apply round changes to each delegate when backwards true, fees > 0', async () => {
      at.returns({
        feesRemaining: 10,
      });
      scope.backwards = true;

      instance     = new ProxyRound.RoundLogic(scope, task);
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
        fees    : -10,
        index   : 0,
      });
      expect(scope.library.logger.trace.thirdCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.thirdCall.args[0]).to.be.equal(
        'Applying round'
      );
      expect(scope.library.logger.trace.thirdCall.args[1]).to.deep.equal([
        'yesSQL',
        'yesSQL',
      ]);
      expect(retVal).to.equal('none works');
      expect(task.none.calledOnce).to.be.true;
      expect(task.none.firstCall.args.length).to.equal(1);
      expect(task.none.firstCall.args[0]).to.equal('yesSQLyesSQL');
    });

    it('should behave correctly when no delegates, backwards true, fees > 0', async () => {
      at.returns({
        feesRemaining: 10,
      });
      scope.roundDelegates = [];
      scope.backwards      = true;

      instance     = new ProxyRound.RoundLogic(scope, task);
      const retVal = await instance.applyRound();

      expect(at.calledOnce).to.be.true;
      expect(at.firstCall.args.length).to.equal(1);
      expect(at.firstCall.args[0]).to.equal(0);
      expect(scope.library.logger.trace.calledTwice).to.be.true;
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
        'Fees remaining'
      );
      expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
        delegate: undefined,
        fees    : -10,
        index   : 0,
      });
      expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
        'Applying round'
      );
      expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal(['yesSQL']);
      expect(retVal).to.equal('none works');
      expect(task.none.calledOnce).to.be.true;
      expect(task.none.firstCall.args.length).to.equal(1);
      expect(task.none.firstCall.args[0]).to.equal('yesSQL');
    });

    it('should apply round changes to each delegate when backwards true, fees = 0', async () => {
      at.returns({
        feesRemaining: 0,
      });
      scope.backwards = true;

      instance     = new ProxyRound.RoundLogic(scope, task);
      const retVal = await instance.applyRound();

      expect(at.calledTwice).to.be.true;
      expect(at.firstCall.args.length).to.equal(1);
      expect(at.firstCall.args[0]).to.equal(0);
      expect(at.secondCall.args[0]).to.equal(0);
      expect(scope.library.logger.trace.calledTwice).to.be.true;
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
        'Delegate changes'
      );
      expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal({
        changes : {
          feesRemaining: 0,
        },
        delegate: {},
      });
      expect(scope.library.logger.trace.secondCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.secondCall.args[0]).to.be.equal(
        'Applying round'
      );
      expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal(['yesSQL']);
      expect(retVal).to.equal('none works');
      expect(task.none.calledOnce).to.be.true;
      expect(task.none.firstCall.args.length).to.equal(1);
      expect(task.none.firstCall.args[0]).to.equal('yesSQL');
    });

    it('should behave correctly when no delegates, backwards true, fees = 0', async () => {
      at.returns({
        feesRemaining: 0,
      });

      scope.roundDelegates = [];
      scope.backwards      = true;

      instance = new ProxyRound.RoundLogic(scope, task);
      await instance.applyRound();

      expect(at.calledOnce).to.be.true;
      expect(at.firstCall.args.length).to.equal(1);
      expect(at.firstCall.args[0]).to.equal(0);
      expect(scope.library.logger.trace.calledOnce).to.be.true;
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args.length).to.be.equal(2);
      expect(scope.library.logger.trace.firstCall.args[0]).to.be.equal(
        'Applying round'
      );
      expect(scope.library.logger.trace.firstCall.args[1]).to.deep.equal([]);
      expect(task.none.notCalled).is.true;
    });
  });

  describe('land', () => {
    it('should call correct methods', async () => {
      const updateVotes        = sandbox.stub(instance, 'updateVotes').resolves(true);
      const updateMissedBlocks = sandbox.stub(instance, 'updateMissedBlocks').resolves(true);
      const flushRound         = sandbox.stub(instance, 'flushRound').resolves(true);
      const applyRound         = sandbox.stub(instance, 'applyRound').resolves(true);

      await instance.land();

      expect(updateVotes.calledTwice).to.be.true;
      expect(updateMissedBlocks.calledOnce).to.be.true;
      expect(flushRound.calledTwice).to.be.true;
      expect(applyRound.calledOnce).to.be.true;

      updateVotes.restore();
      updateMissedBlocks.restore();
      flushRound.restore();
      applyRound.restore();
    });

    it('should call methods in the correct order', async () => {
      const order   = [];
      const stubs   = {};
      const methods = ['updateVotes', 'updateMissedBlocks', 'flushRound', 'applyRound'];
      methods.forEach((k) => {
        stubs[k] = sandbox.stub(instance, k)
          .resolves(true)
          .callsFake(() => order.push(k));
      });

      await instance.land();

      expect(order).to.be.deep.equal([
        'updateVotes',
        'updateMissedBlocks',
        'flushRound',
        'applyRound',
        'updateVotes',
        'flushRound',
      ]);

      for (const k in stubs) {
        if (stubs.hasOwnProperty(k)) {
          stubs[k].restore();
        }
      }
    });
  });

  describe('backwardLand', () => {
    it('should call correct methods', async () => {
      const updateVotes          = sandbox.stub(instance, 'updateVotes').resolves(true);
      const updateMissedBlocks   = sandbox.stub(instance, 'updateMissedBlocks').resolves(true);
      const flushRound           = sandbox.stub(instance, 'flushRound').resolves(true);
      const applyRound           = sandbox.stub(instance, 'applyRound').resolves(true);
      const restoreRoundSnapshot = sandbox.stub(instance, 'restoreRoundSnapshot').resolves(true);
      const restoreVotesSnapshot = sandbox.stub(instance, 'restoreVotesSnapshot').resolves(true);

      await instance.backwardLand();

      expect(updateVotes.calledTwice).to.be.true;
      expect(updateMissedBlocks.calledOnce).to.be.true;
      expect(flushRound.calledTwice).to.be.true;
      expect(applyRound.calledOnce).to.be.true;
      expect(restoreRoundSnapshot.calledOnce).to.be.true;
      expect(restoreVotesSnapshot.calledOnce).to.be.true;

      updateVotes.restore();
      updateMissedBlocks.restore();
      flushRound.restore();
      applyRound.restore();
      restoreRoundSnapshot.restore();
    });

    it('should call methods in the correct order', async () => {
      const order   = [];
      const stubs   = {};
      const methods = ['updateVotes', 'updateMissedBlocks', 'flushRound', 'applyRound',
        'restoreRoundSnapshot', 'restoreVotesSnapshot'];
      methods.forEach((k) => {
        stubs[k] = sandbox.stub(instance, k)
          .resolves(true)
          .callsFake(() => order.push(k));
      });

      await instance.backwardLand();

      expect(order).to.be.deep.equal([
        'updateVotes',
        'updateMissedBlocks',
        'flushRound',
        'applyRound',
        'updateVotes',
        'flushRound',
        'restoreRoundSnapshot',
        'restoreVotesSnapshot',
      ]);

      for (const k in stubs) {
        if (stubs.hasOwnProperty(k)) {
          stubs[k].restore();
        }
      }
    });
  });
});
