import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import constants from '../../../src/helpers';
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
  let afterTxPromise: (task: any) => () => Promise<any>;
  let afterTxPromiseScoped: () => Promise<any>;
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
      txGenerator = txGen;
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
        it('should call roundLogic.land', async () => {
          roundLogicScope.finishRound = true;
          await doCall();
          expect(roundLogicStub.stubs.land.calledOnce).to.be.true;
        });
        it('should then call bus.message');
        it('should then call roundLogic.truncateBlocks if snapshotRound is true');
      });
      describe(' else', () => {
        it('should return null');
      });
      it('should then call roundLogic.markBlockId');
    });
    describe('in scoped afterTxPromise', () => {
      const doCall = async () => {
        await instance.backwardTick(block, previousBlock);
        afterTxPromiseScoped = afterTxPromise('task');
        return txGeneratorScoped('task');
      };

      it('should not call anything if (block.height + 1) % this.slots.delegates !== 0');
      it('should logger.debug');
      it('should call db.tx');
      it('should call tx.batch');
      it('should call tx.none 4 times');
      it('should call logger.error if round tx fails');
      it('should reject if round tx fails');
      it('should call logger.trace');
    });
  });

  describe('getSnapshotRounds', () => {
    it('should call appStateLogic.get and return it');
  });

  describe('innerTick', () => {
    it('should call roundsLogic.calcRound twice');
    it('should call appStateLogic.set');
    it('should call sumRound if finishRound');
    it('should set roundFees: 0, roundRewards: [0], roundDelegates: [block.generatorPublicKey] if block.height = 1');
    it('should call getOutsiders if finishRound');
    it('should build roundLogicScope as expected');
    it('should call txGenerator');
    it('should call db.tx');
    it('should call afterTxPromise');
    it('should call appStateLogic.set');
    describe('anything trows in main try block', () => {
      it('should call logger.warn');
      it('should call appStateLogic.set');
      it('should throw the catched error');
    });
  });

  describe('getOutsiders', () => {
    it('should call roundsLogic.lastInRound');
    it('should remove roundDelegates');
    it('should call accountsModule.generateAddressByPublicKey for each of the outsiders');
    it('should return an array of addresses');
  });

  describe('sumRound', () => {
    it('should call logger.debug');
    it('should call db.query');
    it('should call logger.error twice and reject if db.query rejects');
    it('should floor rewards');
    it('should floor fees');
    it('should return an object with rewards, fees and delegates');
  });

});
