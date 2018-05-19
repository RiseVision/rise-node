import * as chai from 'chai';
import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import * as helpers from '../../../src/helpers/';
import roundSQL from '../../../src/sql/logic/rounds';

const expect = chai.expect;

const pgpStub = { as: undefined } as any;
const ProxyRound = proxyquire('../../../src/logic/round.ts', {
  '../helpers/': helpers,
  '../sql/logic/rounds': roundSQL,
  'pg-promise': pgpStub,
});

// tslint:disable no-unused-expression
describe('logic/round', () => {
  let sandbox: SinonSandbox;
  let instance;
  let scope;
  let task;

  beforeEach(() => {
    sandbox             = sinon.sandbox.create();
    scope    = {
      backwards     : false,
      block         : {
        generatorPublicKey: '9d3058175acab969f41ad9b86f7a2926c74258670fe56b37c429c01fca9f2f0f',
        height            : '2',
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
          mergeAccountAndGet        : sandbox.stub().resolves('yes'),
          mergeAccountAndGetSQL     : sandbox.stub().returns('yesSQL'),
        },
      },
      round         : {},
      roundDelegates: [{}],
      roundFees     : {},
      roundOutsiders: ['1', '2', '3'],
      roundRewards  : {},
    };
    task     = {
      none : sandbox.stub().resolves('none works'),
      query: sandbox.stub().resolves('query works'),
    };
    instance = new ProxyRound.RoundLogic(scope, task);
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
      expect(instance.task).to.be.deep.equal(task);
    });
  });

  describe('mergeBlockGenerator', () => {
    it('should call mergeAccountAndGet', async () => {
      await instance.mergeBlockGenerator();
      expect(scope.modules.accounts.mergeAccountAndGet.calledOnce).to.equal(true);
      expect(scope.modules.accounts.mergeAccountAndGet.firstCall.args[0]).to.deep.equal({
        blockId       : scope.block.id,
        producedblocks: scope.backwards ? -1 : 1,
        publicKey     : scope.block.generatorPublicKey,
        round         : scope.round,
      });
    });
  });

  describe('updateMissedBlocks', () => {
    it('should resolve when roundOutsiders is empty', async () => {
      scope.roundOutsiders = [];
      const instanceTest   = new ProxyRound.RoundLogic(scope, task);
      const ar             = await instanceTest.updateMissedBlocks();
      expect(ar).to.be.undefined;
      expect(task.none.notCalled).to.equal(true);
    });

    it('should return result from updateMissedBlocks', async () => {
      const updateMissedBlocks = sandbox.stub(roundSQL, 'updateMissedBlocks').returns(true);
      const retVal             = await instance.updateMissedBlocks();

      expect(task.none.calledOnce).to.equal(true);
      expect(task.none.firstCall.args.length).to.equal(2);
      expect(task.none.firstCall.args[0]).to.equal(true);
      expect(task.none.firstCall.args[1]).to.deep.equal([scope.roundOutsiders]);
      expect(updateMissedBlocks.calledOnce).to.equal(true);
      expect(updateMissedBlocks.firstCall.args.length).to.equal(1);
      expect(updateMissedBlocks.firstCall.args[0]).to.deep.equal(scope.backwards);
      expect(retVal).to.equal('none works');

      updateMissedBlocks.restore();
    });
  });

  describe('getVotes', () => {
    it('should call task.query', async () => {
      const retVal = await instance.getVotes();

      expect(task.query.calledOnce).to.equal(true);
      expect(task.query.firstCall.args.length).to.equal(2);
      expect(task.query.firstCall.args[0]).to.equal(
        'SELECT d."delegate", d."amount" FROM (SELECT m."delegate", SUM(m."amount") AS "amount", "round" FROM ' +
        'mem_round m GROUP BY m."delegate", m."round") AS d WHERE "round" = (${round})::bigint'
      );
      expect(task.query.firstCall.args[1]).to.deep.equal({ round: scope.round });
      expect(retVal).to.equal('query works');
    });
  });

  describe('updateVotes', () => {
    let getVotesStub: SinonStub;

    beforeEach(() => {
      pgpStub.as = {
        format: sandbox.stub(),
      };
      getVotesStub = sandbox.stub(instance, 'getVotes');
    });

    afterEach(() => {
      getVotesStub.restore();
    });

    it('should call the expected methods and this.task.none when votes is not empty', async () => {
      // emulate getVotes returning array of one element
      getVotesStub.resolves([
        {
          amount  : '10',
          delegate: 'delegateName',
        },
      ]);
      const updateVotes = 'UPDATE mem_accounts SET "vote" = "vote" + (${amount})::bigint WHERE "address" = ${address};';
      pgpStub.as.format.returns([updateVotes]);
      const expectedParam = {
        address: 1,
        amount : 10,
      };
      const retVal        = await instance.updateVotes();
      expect(getVotesStub.calledOnce).to.equal(true);

      expect(scope.modules.accounts.generateAddressByPublicKey.calledOnce).to.be.true;
      expect(scope.modules.accounts.generateAddressByPublicKey.firstCall.args[0]).to.be.equal('delegateName');

      expect(pgpStub.as.format.calledOnce).to.equal(true);
      expect(pgpStub.as.format.firstCall.args.length).to.equal(2);
      expect(pgpStub.as.format.firstCall.args[0]).to.equal(updateVotes);
      expect(pgpStub.as.format.firstCall.args[1]).to.deep.equal(expectedParam);

      expect(task.none.calledOnce).to.equal(true);
      expect(task.none.firstCall.args.length).to.equal(1);
      expect(task.none.firstCall.args[0]).to.equal(updateVotes);
      expect(retVal).to.deep.equal('none works');
    });

    it('should NOT call this.task.none when votes is empty', async () => {
      // emulate getVotes returning empty array
      getVotesStub.resolves([]);
      await instance.updateVotes();
      expect(getVotesStub.calledOnce).to.equal(true);
      expect(scope.modules.accounts.generateAddressByPublicKey.notCalled).to.be.true;
      expect(pgpStub.as.format.notCalled).to.be.true;
      expect(task.none.notCalled).to.be.true;
    });
  });

  describe('markBlockId', () => {
    it('should call task.none if scope.backwards is true', async () => {
      const updateBlockId = 'UPDATE mem_accounts SET "blockId" = ${newId} WHERE "blockId" = ${oldId};';
      scope.backwards     = true;

      const instanceTest = new ProxyRound.RoundLogic(scope, task);
      const retVal       = await instanceTest.markBlockId();

      expect(task.none.calledOnce).to.be.true;
      expect(task.none.firstCall.args.length).to.equal(2);
      expect(task.none.firstCall.args[0]).to.equal(updateBlockId);
      expect(task.none.firstCall.args[1]).to.deep.equal({
        newId: '0',
        oldId: scope.block.id,
      });
      expect(retVal).to.equal('none works');
    });

    it('should not call task.none, then resolve, if scope.backwards is false', async () => {
      scope.backwards = false;
      await instance.markBlockId();
      expect(task.none.notCalled).to.be.true;
    });
  });

  describe('flushRound', () => {
    it('should call task.none', async () => {
      await instance.flushRound();
      expect(task.none.calledOnce).to.be.true;
      const flushQuery = 'DELETE FROM mem_round WHERE "round" = (${round})::bigint;';
      expect(task.none.firstCall.args[0]).to.be.equal(flushQuery);
      expect(task.none.firstCall.args[1]).to.be.deep.equal({ round: scope.round });
    });
  });

  describe('truncateBlocks', () => {
    it('should calls task.none and return the result', async () => {
      const truncateBlocks = 'DELETE FROM blocks WHERE "height" > (${height})::bigint;';
      scope.backwards      = true;

      const instanceTest = new ProxyRound.RoundLogic(scope, task);
      const retVal       = await instanceTest.truncateBlocks();

      expect(task.none.calledOnce).to.be.true;
      expect(task.none.firstCall.args.length).to.equal(2);
      expect(task.none.firstCall.args[0]).to.equal(truncateBlocks);
      expect(task.none.firstCall.args[1]).to.deep.equal({
        height: scope.block.height,
      });
      expect(retVal).to.equal('none works');
    });
  });

  describe('restoreRoundSnapshot', () => {
    it('should call task.none', async () => {
      const restoreRoundSnapshot = 'INSERT INTO mem_round SELECT * FROM mem_round_snapshot';
      scope.backwards            = true;

      const instanceTest = new ProxyRound.RoundLogic(scope, task);
      const retVal       = await instanceTest.restoreRoundSnapshot();

      expect(scope.library.logger.debug.calledOnce).to.be.true;
      expect(scope.library.logger.debug.firstCall.args.length).to.equal(1);
      expect(scope.library.logger.debug.firstCall.args[0]).to.equal('Restoring mem_round snapshot...');

      expect(task.none.calledOnce).to.be.true;
      expect(task.none.firstCall.args.length).to.equal(1);
      expect(task.none.firstCall.args[0]).to.equal(restoreRoundSnapshot);
      expect(retVal).to.equal('none works');
    });
  });

  describe('restoreVotesSnapshot', () => {
    it('should call task.none', async () => {
      const restoreVotesSnapshot = 'UPDATE mem_accounts m SET vote = b.vote FROM mem_votes_snapshot b ' +
        'WHERE m.address = b.address';
      scope.backwards            = true;

      const instanceTest = new ProxyRound.RoundLogic(scope, task);
      const retVal       = await instanceTest.restoreVotesSnapshot();

      expect(scope.library.logger.debug.calledOnce).to.be.true;
      expect(scope.library.logger.debug.firstCall.args.length).to.equal(1);
      expect(scope.library.logger.debug.firstCall.args[0]).to.equal(
        'Restoring mem_accounts.vote snapshot...'
      );

      expect(task.none.calledOnce).to.be.true;
      expect(task.none.firstCall.args.length).to.equal(1);
      expect(task.none.firstCall.args[0]).to.equal(restoreVotesSnapshot);
      expect(retVal).to.equal('none works');
    });
  });

  describe('applyRound', () => {
    let roundChangesOriginal;
    let at: SinonStub;
    let RoundChanges;

    beforeEach(() => {
      roundChangesOriginal = helpers.RoundChanges;
      at                   = sandbox.stub();
      RoundChanges         = function RoundChangesFake() {
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
      expect(scope.library.logger.trace.thirdCall.args[1]).to.deep.equal([
        'yesSQL',
        'yesSQL',
      ]);
      expect(retVal).to.equal('none works');
      expect(task.none.calledOnce).to.be.true;
      expect(task.none.firstCall.args.length).to.equal(1);
      expect(task.none.firstCall.args[0]).to.equal('yesSQLyesSQL');
    });

    it('should behave correctly when no delegates, backwards false, fees > 0', async () => {
      at.returns({
        feesRemaining: 10,
      });
      scope.roundDelegates = [];

      instance     = new ProxyRound.RoundLogic(scope, task);
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
      expect(scope.library.logger.trace.secondCall.args[1]).to.deep.equal(['yesSQL']);
      expect(retVal).to.equal('none works');
      expect(task.none.calledOnce).to.be.true;
      expect(task.none.firstCall.args.length).to.equal(1);
      expect(task.none.firstCall.args[0]).to.equal('yesSQL');
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
