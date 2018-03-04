import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { constants } from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { RoundLogicScope, SignedBlockType } from '../../../src/logic';
import { RoundsModule } from '../../../src/modules';
import sql from '../../../src/sql/logic/rounds';
import {
  AccountsModuleStub,
  AppStateStub,
  BusStub,
  DbStub,
  DelegatesModuleStub,
  LoggerStub,
  RoundLogicStub,
  RoundsLogicStub,
  SlotsStub,
  SocketIOStub
} from '../../stubs';

import { createFakeBlock } from '../../utils/blockCrafter';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/rounds', () => {

  let instance: RoundsModule;
  let container: Container;
  let sandbox: SinonSandbox;
  let block: SignedBlockType;
  let previousBlock: SignedBlockType;
  let delegatesModuleStub: DelegatesModuleStub;
  let accountsModuleStub: AccountsModuleStub;
  let loggerStub: LoggerStub;
  let slotsStub: SlotsStub;
  let dbStub: DbStub;
  let busStub: BusStub;
  let socketIOStub: SocketIOStub;
  let appStateStub: AppStateStub;
  let roundsLogicStub: RoundsLogicStub;
  let roundLogicStub: RoundLogicStub;
  let roundLogicStubConstructor: () => RoundLogicStub;
  let roundLogicStubConstructorSpy: SinonSpy;
  const roundLogicSymbol = Symbol('roundLogic');

  // Utility variables
  let roundLogicScope: RoundLogicScope;
  let txGenerator: (scope: RoundLogicScope) => (task: any) => Promise<any>;
  let txGeneratorScoped: (task: any) => Promise<any>;
  let afterTxPromise: () => () => Promise<any>;
  let innerTickStub: SinonStub;

  before(() => {
    roundLogicStubConstructor = () => {
      return roundLogicStub;
    };
    container                 = new Container();

    // Generic
    container.bind(Symbols.generic.db).to(DbStub).inSingletonScope();
    container.bind(Symbols.generic.socketIO).to(SocketIOStub).inSingletonScope();

    // Helpers
    container.bind(Symbols.helpers.logger).to(LoggerStub).inSingletonScope();
    container.bind(Symbols.helpers.slots).to(SlotsStub).inSingletonScope();
    container.bind(Symbols.helpers.constants).toConstantValue(constants);
    container.bind(Symbols.helpers.bus).to(BusStub).inSingletonScope();

    // Logic
    container.bind(Symbols.logic.appState).to(AppStateStub).inSingletonScope();
    container.bind(Symbols.logic.rounds).to(RoundsLogicStub).inSingletonScope();
    container.bind(Symbols.logic.round).to(RoundLogicStub).inSingletonScope();
    container.bind(roundLogicSymbol).to(RoundLogicStub).inSingletonScope();

    // Modules
    container.bind(Symbols.modules.delegates).to(DelegatesModuleStub).inSingletonScope();
    container.bind(Symbols.modules.accounts).to(AccountsModuleStub).inSingletonScope();
    container.bind(Symbols.modules.rounds).to(RoundsModule).inSingletonScope();
    block         = createFakeBlock();
    previousBlock = createFakeBlock();
  });

  beforeEach(() => {
    sandbox             = sinon.sandbox.create();
    instance            = container.get(Symbols.modules.rounds);
    delegatesModuleStub = container.get(Symbols.modules.delegates);
    accountsModuleStub  = container.get(Symbols.modules.accounts);
    loggerStub          = container.get(Symbols.helpers.logger);
    slotsStub           = container.get(Symbols.helpers.slots);
    dbStub              = container.get(Symbols.generic.db);
    busStub             = container.get(Symbols.helpers.bus);
    socketIOStub        = container.get(Symbols.generic.socketIO);
    appStateStub        = container.get(Symbols.logic.appState);
    roundsLogicStub     = container.get(Symbols.logic.rounds);
    roundLogicStub      = container.get(roundLogicSymbol);
    // Reset all stubs
    [delegatesModuleStub, accountsModuleStub, loggerStub, slotsStub, dbStub, busStub, socketIOStub, appStateStub,
      roundsLogicStub, roundLogicStub].forEach((stub: any) => {
      if (typeof stub.reset !== 'undefined') {
        stub.reset();
      }
      if (typeof stub.stubReset !== 'undefined') {
        stub.stubReset();
      }
    });
    roundLogicStubConstructorSpy = sandbox.spy(roundLogicStubConstructor);

    // TODO check if there is a way to achieve this with inversify...
    (instance as any).RoundLogic = roundLogicStubConstructorSpy;

    roundLogicScope = {
      backwards     : false,
      round         : 12,
      roundOutsiders: [],
      roundDelegates: [],
      roundFees     : 10.1,
      roundRewards  : [100],
      finishRound   : false,
      library       : {
        logger: {} as any,
      },
      modules       : {
        accounts: {} as any,
      },
      block         : {
        generatorPublicKey: block.generatorPublicKey,
        id                : block.id,
        height            : block.height,
      },
    };
    innerTickStub   = sandbox.stub(instance as any, 'innerTick');
    // Expose the passed txGenerator so we can test it
    innerTickStub.callsFake((blk, backwards, txGen, afterTx = () => Promise.resolve(null)) => {
      txGenerator    = txGen;
      afterTxPromise = afterTx;
      return Promise.resolve('innerTick DONE');
    });
    roundLogicStub.stubs.mergeBlockGenerator.resolves();
    roundLogicStub.stubs.backwardLand.resolves();
    roundLogicStub.stubs.markBlockId.resolves();
    roundLogicStub.stubs.truncateBlocks.resolves();
    roundLogicStub.stubs.land.resolves();
    busStub.stubs.message.returns(void 0);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('onFinishRound', () => {
    it('should call socketIO.emit', () => {
      instance.onFinishRound(99);
      expect(socketIOStub.sockets.emit.calledOnce).to.be.true;
      expect(socketIOStub.sockets.emit.firstCall.args[0]).to.be.equal('rounds/change');
      expect(socketIOStub.sockets.emit.firstCall.args[1]).to.be.deep.equal({ number: 99 });
    });
  });

  describe('onBlockchainReady', () => {
    it('should call appStateLogic.set', () => {
      appStateStub.enqueueResponse('set', true);
      instance.onBlockchainReady();
      expect(appStateStub.stubs.set.calledOnce).to.be.true;
      expect(appStateStub.stubs.set.firstCall.args[0]).to.be.equal('rounds.isLoaded');
      expect(appStateStub.stubs.set.firstCall.args[1]).to.be.equal(true);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      appStateStub.enqueueResponse('set', true);
    });

    it('should call appStateLogic.set', async () => {
      await instance.cleanup();
      expect(appStateStub.stubs.set.calledOnce).to.be.true;
      expect(appStateStub.stubs.set.firstCall.args[0]).to.be.equal('rounds.isLoaded');
      expect(appStateStub.stubs.set.firstCall.args[1]).to.be.equal(false);
    });

    it('should resolve', async () => {
      await expect(instance.cleanup()).to.be.fulfilled;
    });
  });

  describe('flush', () => {
    it('should call db.none', async () => {
      dbStub.stubs.none.resolves();
      await instance.flush(99);
      expect(dbStub.stubs.none.calledOnce).to.be.true;
      expect(dbStub.stubs.none.firstCall.args[0]).to.be.deep.equal(sql.flush);
      expect(dbStub.stubs.none.firstCall.args[1]).to.be.deep.equal({ round: 99 });
    });

    it('should return from db.none', async () => {
      dbStub.stubs.none.resolves('expectedRetVal');
      const retVal = await instance.flush(99);
      expect(retVal).to.be.equal('expectedRetVal');
    });

    it('should call logger.error if db.none throws', async () => {
      const expectedError = new Error('test');
      dbStub.stubs.none.rejects(expectedError);
      await expect(instance.flush(99)).to.be.rejected;
      expect(loggerStub.stubs.error.calledOnce).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.deep.equal(expectedError.stack);
    });

    it('should reject if db.none throws', async () => {
      dbStub.stubs.none.rejects(new Error('test'));
      await expect(instance.flush(99)).to.be.rejectedWith('Rounds#flush error');
    });
  });

  describe('backwardTick', () => {
    it('should call innerTick', async () => {
      await instance.backwardTick(block, previousBlock);
      expect(innerTickStub.calledOnce).to.be.true;
      expect(innerTickStub.firstCall.args[0]).to.be.deep.equal(block);
      expect(innerTickStub.firstCall.args[1]).to.be.true;
      expect(innerTickStub.firstCall.args[2]).to.be.a('function');
    });

    it('should return from innerTick', async () => {
      const retVal = await instance.backwardTick(block, previousBlock);
      expect(retVal).to.be.equal('innerTick DONE');
    });

    describe('in scoped txGenerator', () => {
      const doCall = async () => {
        await instance.backwardTick(block, previousBlock);
        txGeneratorScoped = txGenerator(roundLogicScope);
        return txGeneratorScoped('task');
      };

      it('should call logger.debug', async () => {
        await doCall();
        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Performing backward tick');
      });

      it('should instantiate a new RoundLogic', async () => {
        await doCall();
        expect(roundLogicStubConstructorSpy.calledOnce).to.be.true;
        expect(roundLogicStubConstructorSpy.firstCall.args[0]).to.be.deep.equal(roundLogicScope);
        expect(roundLogicStubConstructorSpy.firstCall.args[1]).to.be.equal('task');
        expect(roundLogicStubConstructorSpy.firstCall.args[2]).to.be.deep.equal((instance as any).slots);
      });

      it('should call roundLogic.mergeBlockGenerator', async () => {
        await doCall();
        expect(roundLogicStub.stubs.mergeBlockGenerator.calledOnce).to.be.true;
      });

      it('should then call backwardLand if passed scope.finishRound is true', async () => {
        roundLogicScope.finishRound = true;
        await doCall();
        expect(roundLogicStub.stubs.backwardLand.calledOnce).to.be.true;
      });

      it('should then not call backwardLand if passed scope.finishRound is false', async () => {
        roundLogicScope.finishRound = false;
        await doCall();
        expect(roundLogicStub.stubs.backwardLand.notCalled).to.be.true;
      });

      it('should then call markBlockId', async () => {
        await doCall();
        expect(roundLogicStub.stubs.markBlockId.calledOnce).to.be.true;
      });
    });
  });

  describe('tick', () => {
    it('should call innerTick', async () => {
      await instance.tick(block);
      expect(innerTickStub.calledOnce).to.be.true;
      expect(innerTickStub.firstCall.args[0]).to.be.deep.equal(block);
      expect(innerTickStub.firstCall.args[1]).to.be.false;
      expect(innerTickStub.firstCall.args[2]).to.be.a('function');
    });

    it('should return from innerTick', async () => {
      const retVal = await instance.tick(block);
      expect(retVal).to.be.equal('innerTick DONE');
    });

    describe('in scoped txGenerator', () => {
      let getSnapshotRoundsStub: SinonStub;
      const doCall = async () => {
        await instance.tick(block);
        txGeneratorScoped = txGenerator(roundLogicScope);
        return txGeneratorScoped('task');
      };

      beforeEach(() => {
        getSnapshotRoundsStub = sandbox.stub(instance as any, 'getSnapshotRounds').returns(0);
      });

      it('should call logger.debug', async () => {
        await doCall();
        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Performing forward tick');
      });

      it('should instantiate a new RoundLogic', async () => {
        await doCall();
        expect(roundLogicStubConstructorSpy.calledOnce).to.be.true;
        expect(roundLogicStubConstructorSpy.firstCall.args[0]).to.be.deep.equal(roundLogicScope);
        expect(roundLogicStubConstructorSpy.firstCall.args[1]).to.be.equal('task');
        expect(roundLogicStubConstructorSpy.firstCall.args[2]).to.be.deep.equal((instance as any).slots);
      });

      it('should call getSnapshotRounds once or twice', async () => {
        getSnapshotRoundsStub.returns(0);
        await doCall();
        expect(getSnapshotRoundsStub.calledOnce).to.be.true;
        getSnapshotRoundsStub.reset();
        getSnapshotRoundsStub.returns(12);
        await doCall();
        expect(getSnapshotRoundsStub.calledTwice).to.be.true;
      });

      it('should call mergeBlockGenerator', async () => {
        await doCall();
        expect(roundLogicStubConstructorSpy.calledOnce).to.be.true;
        expect(roundLogicStubConstructorSpy.firstCall.args[0]).to.be.deep.equal(roundLogicScope);
        expect(roundLogicStubConstructorSpy.firstCall.args[1]).to.be.equal('task');
        expect(roundLogicStubConstructorSpy.firstCall.args[2]).to.be.deep.equal((instance as any).slots);
      });

      it('should return from mergeBlockGenerator', async () => {
        const expectedPromise = Promise.resolve('mergeBlockGenerator done');
        roundLogicStub.stubs.mergeBlockGenerator.returns(expectedPromise);
        const retVal = doCall();
        expect(retVal).to.be.deep.equal(expectedPromise);
      });

      describe('then, if this was the last block in round', () => {
        beforeEach(() => {
          roundLogicScope.finishRound = true;
        });

        it('should call roundLogic.land', async () => {
          await doCall();
          expect(roundLogicStub.stubs.land.calledOnce).to.be.true;
        });

        it('should then call bus.message', async () => {
          await doCall();
          expect(busStub.stubs.message.calledOnce).to.be.true;
          expect(busStub.stubs.message.firstCall.args[0]).to.be.equal('finishRound');
          expect(busStub.stubs.message.firstCall.args[1]).to.be.equal(roundLogicScope.round);
          expect(roundLogicStub.stubs.land.calledBefore(busStub.stubs.message)).to.be.true;
        });

        it('should then call roundLogic.truncateBlocks if snapshotRound is true', async () => {
          getSnapshotRoundsStub.returns(roundLogicScope.round);
          await doCall();
          expect(roundLogicStub.stubs.truncateBlocks.calledOnce).to.be.true;
          expect(busStub.stubs.message.calledBefore(roundLogicStub.stubs.truncateBlocks));
          expect(roundLogicStub.stubs.land.calledBefore(roundLogicStub.stubs.truncateBlocks));
        });
      });

      describe(' else', () => {
        beforeEach(() => {
          roundLogicScope.finishRound = false;
        });

        it('should not call roundLogic.land, bus.message, roundLogic.truncateBlocks', async () => {
          await doCall();
          expect(roundLogicStub.stubs.land.notCalled).to.be.true;
          expect(busStub.stubs.message.notCalled).to.be.true;
          expect(roundLogicStub.stubs.truncateBlocks.notCalled).to.be.true;
        });
      });

      it('should then call roundLogic.markBlockId', async () => {
        await doCall();
        expect(roundLogicStub.stubs.markBlockId.calledOnce).to.be.true;
        expect(roundLogicStub.stubs.mergeBlockGenerator.calledBefore(roundLogicStub.stubs.markBlockId)).to.be.true;
      });
    });

    describe('in afterTxPromise', () => {
      let taskStub: { batch: SinonStub, none: SinonStub };

      const doCall = async () => {
        await instance.tick(block);
        return afterTxPromise();
      };

      beforeEach(() => {
        // (block.height + 1) % this.slots.delegates === 0
        block.height = 100;
        taskStub     = {
          batch: sandbox.stub(),
          none : sandbox.stub(),
        };
        dbStub.stubs.tx.callsArgWith(0, taskStub);
        dbStub.stubs.tx.resolves('TX DONE');
      });

      it('should not call anything if (block.height + 1) % this.slots.delegates !== 0', async () => {
        block.height = 1;
        await doCall();
        expect(loggerStub.stubs.debug.notCalled).to.be.true;
        expect(dbStub.stubs.tx.notCalled).to.be.true;
        expect(taskStub.batch.notCalled).to.be.true;
        expect(loggerStub.stubs.error.notCalled).to.be.true;
        expect(loggerStub.stubs.trace.notCalled).to.be.true;
      });

      it('should call logger.debug', async () => {
        await doCall();
        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Performing round snapshot...');
      });

      it('should call db.tx', async () => {
        await doCall();
        expect(dbStub.stubs.tx.calledOnce).to.be.true;
        expect(dbStub.stubs.tx.firstCall.args[0]).to.be.a('function');
      });

      describe('in db.tx callback', () => {
        beforeEach(() => {
          taskStub.none.onCall(0).returns(0);
          taskStub.none.onCall(1).returns(1);
          taskStub.none.onCall(2).returns(2);
          taskStub.none.onCall(3).returns(3);
        });

        it('should call task.batch', async () => {
          await doCall();
          expect(taskStub.batch.calledOnce).to.be.true;
          expect(taskStub.batch.firstCall.args[0]).to.be.deep.equal([0, 1, 2, 3]);
        });

        it('should call task.none 4 times', async () => {
          await doCall();
          expect(taskStub.none.callCount).to.be.equal(4);
          expect(taskStub.none.getCall(0).args[0]).to.be.deep.equal(sql.clearRoundSnapshot);
          expect(taskStub.none.getCall(1).args[0]).to.be.deep.equal(sql.performRoundSnapshot);
          expect(taskStub.none.getCall(2).args[0]).to.be.deep.equal(sql.clearVotesSnapshot);
          expect(taskStub.none.getCall(3).args[0]).to.be.deep.equal(sql.performVotesSnapshot);
        });
      });

      it('should reject and call logger.error if round tx fails', async () => {
        const theError = new Error('test');
        dbStub.stubs.tx.rejects(theError);
        await expect(doCall()).to.be.rejectedWith(theError);
        expect(loggerStub.stubs.error.calledOnce).to.be.true;
        expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal('Round snapshot failed');
        expect(loggerStub.stubs.error.firstCall.args[1]).to.be.deep.equal(theError);
      });

      it('should call logger.trace after db.tx', async () => {
        await doCall();
        expect(loggerStub.stubs.trace.calledOnce).to.be.true;
        expect(loggerStub.stubs.trace.firstCall.args[0]).to.be.equal('Round snapshot done');
        expect(dbStub.stubs.tx.calledBefore(loggerStub.stubs.trace)).to.be.true;
      });
    });
  });

  describe('getSnapshotRounds', () => {
    it('should call appStateLogic.get and return it if not false/undefined', () => {
      appStateStub.stubs.get.returns(1);
      const retVal = (instance as any).getSnapshotRounds();
      expect(appStateStub.stubs.get.calledOnce).to.be.true;
      expect(appStateStub.stubs.get.firstCall.args[0]).to.be.equal('rounds.snapshot');
      expect(retVal).to.be.equal(1);
    });

    it('should  return 0 if appStateLogic.get returns false/undefined', () => {
      appStateStub.stubs.get.returns(false);
      const retVal = (instance as any).getSnapshotRounds();
      expect(retVal).to.be.equal(0);
      appStateStub.stubs.get.returns(undefined);
      const retVal2 = (instance as any).getSnapshotRounds();
      expect(retVal2).to.be.equal(0);
    });
  });

  describe('innerTick', () => {
    let txGeneratorStub: SinonStub;
    let afterTxPromiseStub: SinonStub;
    let sumRoundStub: SinonStub;
    let getOutsidersStub: SinonStub;
    let roundSums;

    beforeEach(() => {
      txGeneratorStub    = sandbox.stub();
      afterTxPromiseStub = sandbox.stub();
      sumRoundStub       = sandbox.stub(instance as any, 'sumRound');
      roundSums          = {
        roundFees     : 0,
        roundRewards  : [0],
        roundDelegates: ['delegate1', 'delegate2'],
      };
      sumRoundStub.returns(roundSums);
      getOutsidersStub = sandbox.stub(instance as any, 'getOutsiders');
      getOutsidersStub.resolves([]);
      innerTickStub.restore();
      appStateStub.stubs.set.returns(void 0);
      roundsLogicStub.stubs.calcRound.returns(1);
      dbStub.stubs.tx.resolves();
      block.height = 98;
    });

    it('should call roundsLogic.calcRound twice', async () => {
      await (instance as any).innerTick(block, true, txGeneratorStub, afterTxPromiseStub);
      expect(roundsLogicStub.stubs.calcRound.calledTwice).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(block.height);
      expect(roundsLogicStub.stubs.calcRound.secondCall.args[0]).to.be.equal(block.height + 1);
    });

    it('should call appStateLogic.set twice if all OK', async () => {
      await (instance as any).innerTick(block, true, txGeneratorStub, afterTxPromiseStub);
      expect(appStateStub.stubs.set.calledTwice).to.be.true;
      expect(appStateStub.stubs.set.firstCall.args[0]).to.be.equal('rounds.isTicking');
      expect(appStateStub.stubs.set.firstCall.args[1]).to.be.true;
      expect(appStateStub.stubs.set.secondCall.args[0]).to.be.equal('rounds.isTicking');
      expect(appStateStub.stubs.set.secondCall.args[1]).to.be.false;
    });

    it('should call sumRound if block.height is 1', async () => {
      block.height = 1;
      await (instance as any).innerTick(block, true, txGeneratorStub, afterTxPromiseStub);
      expect(sumRoundStub.calledOnce).to.be.true;
      expect(sumRoundStub.firstCall.args[0]).to.be.equal(1);
    });

    it('should call sumRound if nextRound !== round', async () => {
      roundsLogicStub.stubs.calcRound.onCall(0).returns(1);
      roundsLogicStub.stubs.calcRound.onCall(1).returns(2);
      await (instance as any).innerTick(block, true, txGeneratorStub, afterTxPromiseStub);
      expect(sumRoundStub.calledOnce).to.be.true;
      expect(sumRoundStub.firstCall.args[0]).to.be.equal(1);
    });

    it('should call txGenerator', async () => {
      await (instance as any).innerTick(block, true, txGeneratorStub, afterTxPromiseStub);
      expect(txGeneratorStub.calledOnce).to.be.true;
      expect(txGeneratorStub.firstCall.args[0]).to.be.deep.equal({
        backwards     : true,
        block,
        finishRound   : false,
        library       : {
          logger: loggerStub,
        },
        modules       : {
          accounts: accountsModuleStub,
        },
        round         : 1,
        roundOutsiders: null,
      });
    });

    it('should set roundFees: 0, roundRewards: [0], roundDelegates: [generatorPublicKey] if height = 1', async () => {
      block.height = 1;
      await (instance as any).innerTick(block, true, txGeneratorStub, afterTxPromiseStub);
      const generatedRoundLogicScope = txGeneratorStub.firstCall.args[0];
      expect(generatedRoundLogicScope.roundFees).to.be.equal(0);
      expect(generatedRoundLogicScope.roundRewards).to.be.deep.equal([0]);
      expect(generatedRoundLogicScope.roundDelegates).to.be.deep.equal([block.generatorPublicKey]);
    });

    it('should call getOutsiders if finishRound', async () => {
      // force finishRound
      roundsLogicStub.stubs.calcRound.onCall(0).returns(1);
      roundsLogicStub.stubs.calcRound.onCall(1).returns(2);
      await (instance as any).innerTick(block, true, txGeneratorStub, afterTxPromiseStub);
      expect(getOutsidersStub.calledOnce).to.be.true;
      expect(getOutsidersStub.firstCall.args[0]).to.be.equal(1);
      expect(getOutsidersStub.firstCall.args[1]).to.be.deep.equal(roundSums.roundDelegates);
    });

    it('should build roundLogicScope as expected', async () => {
      // block height != 1, finishRound = false
      const backwards = true;
      await (instance as any).innerTick(block, backwards, txGeneratorStub, afterTxPromiseStub);
      let generatedRoundLogicScope = txGeneratorStub.firstCall.args[0];
      expect(generatedRoundLogicScope).to.be.deep.equal({
        backwards,
        block,
        finishRound   : false,
        library       : {
          logger: loggerStub,
        },
        modules       : {
          accounts: accountsModuleStub,
        },
        round         : 1,
        roundOutsiders: null,
      });

      // block height != 1, finishRound = true
      roundsLogicStub.reset();
      txGeneratorStub.reset();
      roundsLogicStub.stubs.calcRound.onCall(0).returns(1);
      roundsLogicStub.stubs.calcRound.onCall(1).returns(2);
      await (instance as any).innerTick(block, backwards, txGeneratorStub, afterTxPromiseStub);
      generatedRoundLogicScope = txGeneratorStub.firstCall.args[0];
      expect(generatedRoundLogicScope).to.be.deep.equal({
        backwards,
        block,
        finishRound   : true,
        library       : {
          logger: loggerStub,
        },
        modules       : {
          accounts: accountsModuleStub,
        },
        round         : 1,
        roundOutsiders: [],
        ...roundSums,
      });

      // block height = 1
      roundsLogicStub.reset();
      txGeneratorStub.reset();
      roundsLogicStub.stubs.calcRound.returns(1);
      block.height = 1;
      await (instance as any).innerTick(block, backwards, txGeneratorStub, afterTxPromiseStub);
      generatedRoundLogicScope = txGeneratorStub.firstCall.args[0];
      expect(generatedRoundLogicScope).to.be.deep.equal({
        backwards,
        block,
        finishRound   : true,
        library       : {
          logger: loggerStub,
        },
        modules       : {
          accounts: accountsModuleStub,
        },
        round         : 1,
        roundOutsiders: [],
        roundFees     : 0,
        roundRewards  : [0],
        roundDelegates: [block.generatorPublicKey],
      });

    });

    it('should call db.tx', async () => {
      txGeneratorStub.returns('tx');
      await (instance as any).innerTick(block, true, txGeneratorStub, afterTxPromiseStub);
      expect(dbStub.stubs.tx.calledOnce).to.be.true;
      expect(dbStub.stubs.tx.firstCall.args[0]).to.be.equal('tx');
    });

    it('should call afterTxPromise', async () => {
      await (instance as any).innerTick(block, true, txGeneratorStub, afterTxPromiseStub);
      expect(afterTxPromiseStub.calledOnce).to.be.true;
      expect(dbStub.stubs.tx.calledBefore(afterTxPromiseStub)).to.be.true;
    });

    describe('anything trows in main try block', () => {
      it('should call logger.warn, call appStateLogic.set and throw the catched error', async () => {
        const theError  = new Error('test');
        const backwards = true;
        dbStub.stubs.tx.rejects(theError);
        await expect((instance as any).innerTick(block, backwards, txGeneratorStub, afterTxPromiseStub)).to.be
          .rejectedWith(theError);
        expect(loggerStub.stubs.warn.calledOnce).to.be.true;
        expect(loggerStub.stubs.warn.firstCall.args[0]).to.be
          .equal(`Error while doing modules.innerTick [backwards=${backwards}]`);
        expect(loggerStub.stubs.warn.firstCall.args[1]).to.be.equal(theError.message);
        expect(appStateStub.stubs.set.calledTwice).to.be.true;
        expect(appStateStub.stubs.set.secondCall.args[0]).to.be.equal('rounds.isTicking');
        expect(appStateStub.stubs.set.secondCall.args[1]).to.be.false;
      });
    });
  });

  describe('getOutsiders', () => {
    let round: number;
    let roundDelegates: string[];

    beforeEach(() => {
      round          = 99;
      roundDelegates = ['key1', 'key2'];
      roundsLogicStub.stubs.lastInRound.returns(19532);
      delegatesModuleStub.stubs.generateDelegateList.returns(['outsider1', 'outsider2', ...roundDelegates]);
      accountsModuleStub.stubs.generateAddressByPublicKey.callsFake((pk) => {
        return 'addr_' + pk;
      });
    });

    it('should call roundsLogic.lastInRound', async () => {
      await (instance as any).getOutsiders(round, roundDelegates);
      expect(roundsLogicStub.stubs.lastInRound.calledOnce).to.be.true;
      expect(roundsLogicStub.stubs.lastInRound.firstCall.args[0]).to.be.equal(round);
    });

    it('should remove roundDelegates', async () => {
      // Let's leave our array intact after filter.
      accountsModuleStub.stubs.generateAddressByPublicKey.callsFake((pk) => {
        return pk;
      });
      const retVal = await (instance as any).getOutsiders(round, roundDelegates);
      expect(retVal).to.be.deep.equal(['outsider1', 'outsider2']);
    });
    it('should call accountsModule.generateAddressByPublicKey for each of the outsiders', async () => {
      await (instance as any).getOutsiders(round, roundDelegates);
      expect(accountsModuleStub.stubs.generateAddressByPublicKey.callCount).to.be.equal(2);
      expect(accountsModuleStub.stubs.generateAddressByPublicKey.firstCall.args[0]).to.be.equal('outsider1');
      expect(accountsModuleStub.stubs.generateAddressByPublicKey.secondCall.args[0]).to.be.equal('outsider2');
    });

    it('should return an array of addresses', async () => {
      const retVal = await (instance as any).getOutsiders(round, roundDelegates);
      expect(Array.isArray(retVal)).to.be.true;
      expect(retVal).to.be.deep.equal(['addr_outsider1', 'addr_outsider2']);
    });
  });

  describe('sumRound', () => {
    let summedRound;
    let round;

    beforeEach(() => {
      round       = 99;
      summedRound = [
        {
          rewards  : [1, 0.5, 3.99],
          fees     : 12.33,
          delegates: ['d1', 'd2', 'd3'],
        },
      ];
      dbStub.stubs.query.resolves(summedRound);
    });

    it('should call logger.debug', async () => {
      await (instance as any).sumRound(round);
      expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Summing round');
      expect(loggerStub.stubs.debug.firstCall.args[1]).to.be.equal(round);
    });

    it('should call db.query', async () => {
      await (instance as any).sumRound(round);
      expect(dbStub.stubs.query.calledOnce).to.be.true;
      expect(dbStub.stubs.query.firstCall.args[0]).to.be.deep.equal(sql.summedRound);
      expect(dbStub.stubs.query.firstCall.args[1]).to.be.deep.equal({
        activeDelegates: constants.activeDelegates,
        round,
      });
    });

    it('should call logger.error twice and reject if db.query rejects', async () => {
      const theError = new Error('test');
      dbStub.stubs.query.rejects(theError);
      await expect((instance as any).sumRound(round)).to.be.rejectedWith(theError);
      expect(loggerStub.stubs.error.calledTwice).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal('Failed to sum round');
      expect(loggerStub.stubs.error.firstCall.args[1]).to.be.equal(round);
      expect(loggerStub.stubs.error.secondCall.args[0]).to.be.deep.equal(theError.stack);
    });

    it('should return an object with floored rewards, floored fees and delegates', async () => {
      const retVal = await (instance as any).sumRound(round);
      expect(retVal.roundRewards).not.to.be.undefined;
      expect(retVal.roundFees).not.to.be.undefined;
      expect(retVal.roundDelegates).not.to.be.undefined;
      expect(retVal).to.be.deep.equal({
        roundRewards  : [1, 0, 3],
        roundFees     : 12,
        roundDelegates: ['d1', 'd2', 'd3'],
      });
    });
  });

});
