import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { DelegatesModule, RoundsModule } from '../../src/modules';
import { LoggerStub } from '../../../core-utils/tests/stubs';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { SignedBlockType } from '@risevision/core-types';
import { RoundLogic, RoundLogicScope } from '../../src/logic/round';
import { IAccountsModule, IAppState, IBlocksModel, IDBHelper, Symbols } from '@risevision/core-interfaces';
import { createFakeBlock } from '../../../core-blocks/tests/utils/createFakeBlocks';
import { RoundsModel } from '../../src/models';
import { dPoSSymbols, Slots } from '../../src/helpers';
import { RoundsLogic } from '../../src/logic/rounds';
import { ModelSymbols } from '@risevision/core-models';
import { BlocksSymbols } from '@risevision/core-blocks';
chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/rounds', () => {

  let instance: RoundsModule;
  let container: Container;
  let sandbox: SinonSandbox;
  let block: IBlocksModel;
  let previousBlock: SignedBlockType;
  let delegatesModuleStub: DelegatesModule;
  let accountsModuleStub: IAccountsModule;
  let loggerStub: LoggerStub;
  let slotsStub: Slots;
  let socketIOStub: SocketIO.Server;
  let appStateStub: IAppState;
  let roundsLogicStub: RoundsLogic;
  let roundLogicStub: RoundLogic;
  let roundLogicStubConstructor: () => RoundLogic;

  // Utility variables
  let roundLogicScope: RoundLogicScope;
  let txGenerator: (scope: RoundLogicScope) => (task: any) => Promise<any>;
  let txGeneratorScoped: (task: any) => Promise<any>;
  let afterTxPromise: () => () => Promise<any>;
  let innerTickStub: SinonStub;

  beforeEach(async () => {
    roundLogicStubConstructor = () => {
      return roundLogicStub;
    };
    sandbox                   = sinon.createSandbox();
    container                 = await createContainer(['core-consensus-dpos', 'core-helpers', 'core']);
    const BlocksModel  = container.getNamed<typeof IBlocksModel>(ModelSymbols.model, BlocksSymbols.model);
    block                        = new BlocksModel(createFakeBlock(container ));
    previousBlock                = new BlocksModel(createFakeBlock(container));
    instance                     = container.get(dPoSSymbols.modules.rounds);
    delegatesModuleStub          = container.get(dPoSSymbols.modules.delegates);
    accountsModuleStub           = container.get(Symbols.modules.accounts);
    loggerStub                   = container.get(Symbols.helpers.logger);
    slotsStub                    = container.get(dPoSSymbols.helpers.slots);
    socketIOStub                 = container.get(Symbols.generic.socketIO);
    appStateStub                 = container.get(Symbols.logic.appState);
    roundsLogicStub              = container.get(dPoSSymbols.logic.rounds);
    roundLogicStub               = container.get(dPoSSymbols.logic.round);


    roundLogicScope = {
      backwards     : false,
      block         : {
        generatorPublicKey: block.generatorPublicKey,
        height            : block.height,
        id                : block.id,
      } as any,
      finishRound   : false,
      library       : {
        logger: {} as any,
        RoundChanges: {} as any
      },
      modules       : {
        accounts: container.get(Symbols.modules.accounts),
      },
      models        : {
        AccountsModel: container.getNamed(ModelSymbols.model, Symbols.models.accounts),
        BlocksModel  : container.getNamed(ModelSymbols.model, Symbols.models.blocks),
        RoundsModel  : container.getNamed(ModelSymbols.model, dPoSSymbols.models.rounds),
      },
      round         : 12,
      roundDelegates: [],
      roundFees     : 10.1,
      roundOutsiders: [],
      roundRewards  : [100],
    };
    innerTickStub   = sandbox.stub(instance as any, 'innerTick');
    // Expose the passed txGenerator so we can test it
    innerTickStub.callsFake((blk, transaction, backwards, txGen, afterTx = () => Promise.resolve(null)) => {
      txGenerator    = txGen;
      afterTxPromise = afterTx;
      return Promise.resolve('innerTick DONE');
    });
    // roundLogicStub.stubs.mergeBlockGenerator.resolves();
    // roundLogicStub.stubs.backwardLand.resolves();
    // roundLogicStub.stubs.markBlockId.resolves();
    // roundLogicStub.stubs.truncateBlocks.resolves();
    // roundLogicStub.stubs.land.resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  // describe('onFinishRound', () => {
  //   it('should call socketIO.emit', () => {
  //     instance.onFinishRound(99);
  //     expect(socketIOStub.sockets.emit.calledOnce).to.be.true;
  //     expect(socketIOStub.sockets.emit.firstCall.args[0]).to.be.equal('rounds/change');
  //     expect(socketIOStub.sockets.emit.firstCall.args[1]).to.be.deep.equal({number: 99});
  //   });
  // });


  describe('backwardTick', () => {
    it('should call innerTick', async () => {
      await instance.backwardTick(block as any, previousBlock, { transaction: 'tx' } as any);
      expect(innerTickStub.calledOnce).to.be.true;
      expect(innerTickStub.firstCall.args[0]).to.be.deep.equal(block);
      expect(innerTickStub.firstCall.args[1]).to.be.deep.eq({ transaction: 'tx' });
      expect(innerTickStub.firstCall.args[2]).is.true;
      expect(innerTickStub.firstCall.args[3]).to.be.a('function');
    });

    it('should return from innerTick', async () => {
      const retVal = await instance.backwardTick(block as any,
        previousBlock,
        { transaction: 'tx' } as any);
      expect(retVal).to.be.equal('innerTick DONE');
    });

    describe('in scoped txGenerator', () => {
      let dbHelpersStub: IDBHelper;
      let performOPsStub: SinonStub;
      beforeEach(() => {
        // roundLogicStub.stubs.mergeBlockGenerator.returns(['mergeBlockOp1', 'mergeBlockOp2']);
        // roundLogicStub.stubs.backwardLand.returns(['backwardLandOp1', 'backwardLandOp2']);
        // roundLogicStub.stubs.markBlockId.returns('markBlockIdOp');
        dbHelpersStub  = container.get(Symbols.helpers.db);
        performOPsStub = sandbox.stub(dbHelpersStub, 'performOps').resolves();
      });
      async function doCallBackwardTick() {
        await instance.backwardTick(block, previousBlock, 'tx' as any);
        return txGenerator(roundLogicScope);
      }

      it('should call logger.debug', async () => {
        loggerStub.stubReset();
        await doCallBackwardTick();
        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Performing backward tick');
      });

      it('should instantiate a new RoundLogic', async () => {
        const res = await doCallBackwardTick();
        // expect(roundLogicStubConstructorSpy.calledOnce).to.be.true;
        // expect(roundLogicStubConstructorSpy.firstCall.args[0]).to.be.deep.equal(roundLogicScope);
        // expect(roundLogicStubConstructorSpy.firstCall.args[1]).to.be.deep.equal((instance as any).slots);
      });

      //     it('should call roundLogic.mergeBlockGenerator', async () => {
      //       await doCallBackwardTick();
      //       expect(roundLogicStub.stubs.mergeBlockGenerator.calledOnce).to.be.true;
      //     });
      //
      //     it('should then call backwardLand if passed scope.finishRound is true', async () => {
      //       roundLogicScope.finishRound = true;
      //       await doCallBackwardTick();
      //       expect(roundLogicStub.stubs.backwardLand.calledOnce).to.be.true;
      //
      //       expect(dbHelpersStub.stubs.performOps.firstCall.args).to.be.deep.eq([
      //         [
      //           'mergeBlockOp1',
      //           'mergeBlockOp2',
      //           'backwardLandOp1',
      //           'backwardLandOp2',
      //           'markBlockIdOp',
      //         ],
      //         'tx',
      //       ]);
      //     });
      //
      //     it('should then not call backwardLand if passed scope.finishRound is false', async () => {
      //       roundLogicScope.finishRound = false;
      //       await doCallBackwardTick();
      //       expect(roundLogicStub.stubs.backwardLand.notCalled).to.be.true;
      //     });
      //
      //     it('should then call markBlockId', async () => {
      //       await doCallBackwardTick();
      //       expect(roundLogicStub.stubs.markBlockId.calledOnce).to.be.true;
      //     });
      //
      //     it('should call performOps with correct data', async () => {
      //       await doCallBackwardTick();
      //       expect(dbHelpersStub.stubs.performOps.firstCall.args).to.be.deep.eq([
      //         [
      //           'mergeBlockOp1',
      //           'mergeBlockOp2',
      //           'markBlockIdOp',
      //         ],
      //         'tx',
      //       ]);
      //     });
      //   });
      // });
      //
      // describe('tick', () => {
      //   it('should call innerTick', async () => {
      //     await instance.tick(block, 'tx' as any);
      //     expect(innerTickStub.calledOnce).to.be.true;
      //     expect(innerTickStub.firstCall.args[0]).to.be.deep.equal(block);
      //     expect(innerTickStub.firstCall.args[1]).to.be.eq('tx');
      //     expect(innerTickStub.firstCall.args[2]).to.be.eq(false);
      //     expect(innerTickStub.firstCall.args[3]).to.be.a('function');
      //   });
      //
      //   it('should return from innerTick', async () => {
      //     const retVal = await instance.tick(block, 'tx' as any);
      //     expect(retVal).to.be.equal('innerTick DONE');
      //   });
      //
      //   describe('in scoped txGenerator', () => {
      //     let getSnapshotRoundsStub: SinonStub;
      //     const doCallBackwardTick = async () => {
      //       await instance.tick(block, 'tx' as any);
      //       return txGenerator(roundLogicScope);
      //     };
      //     let dbHelpersStub: DbStub;
      //     beforeEach(() => {
      //       getSnapshotRoundsStub = sandbox.stub(instance as any, 'getSnapshotRounds').returns(0);
      //       roundLogicStub.stubs.mergeBlockGenerator.returns(['mergeBlockOp1', 'mergeBlockOp2']);
      //       roundLogicStub.stubs.backwardLand.returns(['backwardLandOp1', 'backwardLandOp2']);
      //       roundLogicStub.stubs.markBlockId.returns('markBlockIdOp');
      //       dbHelpersStub = container.get(Symbols.helpers.db);
      //       dbHelpersStub.enqueueResponse('performOps', Promise.resolve());
      //     });
      //     it('should call logger.debug', async () => {
      //       await doCallBackwardTick();
      //       expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      //       expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Performing forward tick');
      //     });
      //
      //     it('should instantiate a new RoundLogic', async () => {
      //       await doCallBackwardTick();
      //       expect(roundLogicStubConstructorSpy.calledOnce).to.be.true;
      //       expect(roundLogicStubConstructorSpy.firstCall.args[0]).to.be.deep.equal(roundLogicScope);
      //       expect(roundLogicStubConstructorSpy.firstCall.args[1]).to.be.deep.equal((instance as any).slots);
      //     });
      //
      //     it('should call getSnapshotRounds once or twice', async () => {
      //       getSnapshotRoundsStub.returns(0);
      //       await doCallBackwardTick();
      //       expect(getSnapshotRoundsStub.calledOnce).to.be.true;
      //       getSnapshotRoundsStub.reset();
      //       getSnapshotRoundsStub.returns(12);
      //       dbHelpersStub.enqueueResponse('performOps', Promise.resolve());
      //       await doCallBackwardTick();
      //       expect(getSnapshotRoundsStub.calledTwice).to.be.true;
      //     });
      //
      //     it('should call mergeBlockGenerator', async () => {
      //       await doCallBackwardTick();
      //       expect(roundLogicStubConstructorSpy.calledOnce).to.be.true;
      //       expect(roundLogicStubConstructorSpy.firstCall.args[0]).to.be.deep.equal(roundLogicScope);
      //       expect(roundLogicStubConstructorSpy.firstCall.args[1]).to.be.deep.equal((instance as any).slots);
      //     });
      //     it('should call performOps with correct data', async () => {
      //       await doCallBackwardTick();
      //
      //       expect(dbHelpersStub.stubs.performOps.firstCall.args).to.be.deep.eq([
      //         [
      //           'mergeBlockOp1',
      //           'mergeBlockOp2',
      //           'markBlockIdOp',
      //         ],
      //         'tx',
      //       ]);
      //     });
      //
      //     describe('then, if this was the last block in round', () => {
      //       beforeEach(() => {
      //         roundLogicScope.finishRound = true;
      //         roundLogicStub.stubs.land.returns(['roundLogicLandOp1']);
      //       });
      //
      //       it('should call roundLogic.land', async () => {
      //         await doCallBackwardTick();
      //         expect(roundLogicStub.stubs.land.calledOnce).to.be.true;
      //         expect(dbHelpersStub.stubs.performOps.firstCall.args).to.be.deep.eq([
      //           [
      //             'mergeBlockOp1',
      //             'mergeBlockOp2',
      //             'roundLogicLandOp1',
      //             'markBlockIdOp',
      //           ],
      //           'tx',
      //         ]);
      //       });
      //
      //       it('should then call bus.message', async () => {
      //         await doCallBackwardTick();
      //         expect(busStub.stubs.message.calledOnce).to.be.true;
      //         expect(busStub.stubs.message.firstCall.args[0]).to.be.equal('finishRound');
      //         expect(busStub.stubs.message.firstCall.args[1]).to.be.equal(roundLogicScope.round);
      //         expect(roundLogicStub.stubs.land.calledBefore(busStub.stubs.message)).to.be.true;
      //       });
      //
      //       it('should then call roundLogic.truncateBlocks if snapshotRound is true', async () => {
      //         getSnapshotRoundsStub.returns(roundLogicScope.round);
      //         await doCallBackwardTick();
      //         expect(roundLogicStub.stubs.truncateBlocks.calledOnce).to.be.true;
      //         expect(busStub.stubs.message.calledBefore(roundLogicStub.stubs.truncateBlocks));
      //         expect(roundLogicStub.stubs.land.calledBefore(roundLogicStub.stubs.truncateBlocks));
      //       });
      //     });
      //
      //     describe(' else', () => {
      //       beforeEach(() => {
      //         roundLogicScope.finishRound = false;
      //       });
      //
      //       it('should not call roundLogic.land, bus.message, roundLogic.truncateBlocks', async () => {
      //         await doCallBackwardTick();
      //         expect(roundLogicStub.stubs.land.notCalled).to.be.true;
      //         expect(busStub.stubs.message.notCalled).to.be.true;
      //         expect(roundLogicStub.stubs.truncateBlocks.notCalled).to.be.true;
      //       });
      //     });
      //
      //     it('should then call roundLogic.markBlockId', async () => {
      //       await doCallBackwardTick();
      //       expect(roundLogicStub.stubs.markBlockId.calledOnce).to.be.true;
      //       expect(roundLogicStub.stubs.mergeBlockGenerator.calledBefore(roundLogicStub.stubs.markBlockId)).to.be.true;
      //     });
      //   });
      //
      //   describe('in afterTxPromise', () => {
      //     let dbHelperStub: DbStub;
      //     const doCallBackwardTick = async () => {
      //       await instance.tick(block, 'tx' as any);
      //       return afterTxPromise();
      //     };
      //
      //     beforeEach(() => {
      //       // (block.height + 1) % this.slots.delegates === 0
      //       block.height = 100;
      //       dbHelperStub = container.get(Symbols.helpers.db);
      //       dbHelperStub.enqueueResponse('performOps', Promise.resolve());
      //     });
      //
      //     it('should not call anything if (block.height + 1) % this.slots.delegates !== 0', async () => {
      //       block.height = 1;
      //       await doCallBackwardTick();
      //       expect(dbHelperStub.stubs.performOps.called).is.false;
      //       expect(loggerStub.stubs.debug.notCalled).to.be.true;
      //       expect(loggerStub.stubs.error.notCalled).to.be.true;
      //       expect(loggerStub.stubs.trace.notCalled).to.be.true;
      //     });
      //
      //     it('should call logger.debug', async () => {
      //       await doCallBackwardTick();
      //       expect(loggerStub.stubs.debug.calledOnce).to.be.true;
      //       expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Performing round snapshot...');
      //     });
      //
      //     it('should call db.tx', async () => {
      //       await doCallBackwardTick();
      //       expect(dbHelperStub.stubs.performOps.called).is.true;
      //     });
      //
      //     it('should reject if round tx fails', async () => {
      //       const theError = new Error('test');
      //       dbHelperStub.stubs.performOps.rejects(theError);
      //       await expect(doCallBackwardTick()).to.be.rejectedWith(theError);
      //     });
      //
      //     it('should call logger.trace after db.performOps', async () => {
      //       await doCallBackwardTick();
      //       expect(loggerStub.stubs.trace.calledOnce).to.be.true;
      //       expect(loggerStub.stubs.trace.firstCall.args[0]).to.be.equal('Round snapshot done');
      //       expect(dbHelperStub.stubs.performOps.calledBefore(loggerStub.stubs.trace)).to.be.true;
      //     });
      //   });
      // });
      //
      // describe('getSnapshotRounds', () => {
      //   it('should call appStateLogic.get and return it if not false/undefined', () => {
      //     appStateStub.stubs.get.returns(1);
      //     const retVal = (instance as any).getSnapshotRounds();
      //     expect(appStateStub.stubs.get.calledOnce).to.be.true;
      //     expect(appStateStub.stubs.get.firstCall.args[0]).to.be.equal('rounds.snapshot');
      //     expect(retVal).to.be.equal(1);
      //   });
      //
      //   it('should  return 0 if appStateLogic.get returns false/undefined', () => {
      //     appStateStub.stubs.get.returns(false);
      //     const retVal = (instance as any).getSnapshotRounds();
      //     expect(retVal).to.be.equal(0);
      //     appStateStub.stubs.get.returns(undefined);
      //     const retVal2 = (instance as any).getSnapshotRounds();
      //     expect(retVal2).to.be.equal(0);
      //   });
      // });
      //
      // describe('innerTick', () => {
      //   let txGeneratorStub: SinonStub;
      //   let afterTxPromiseStub: SinonStub;
      //   let sumRoundStub: SinonStub;
      //   let getOutsidersStub: SinonStub;
      //   let roundSums;
      //   let dbHelpersStub: DbStub;
      //   beforeEach(() => {
      //     txGeneratorStub    = sandbox.stub();
      //     afterTxPromiseStub = sandbox.stub();
      //     sumRoundStub       = sandbox.stub(instance as any, 'sumRound');
      //     roundSums          = {
      //       roundDelegates: ['delegate1', 'delegate2'],
      //       roundFees     : 0,
      //       roundRewards  : [0],
      //     };
      //     sumRoundStub.returns(roundSums);
      //     getOutsidersStub = sandbox.stub(instance as any, 'getOutsiders');
      //     getOutsidersStub.resolves([]);
      //     innerTickStub.restore();
      //     appStateStub.stubs.set.returns(void 0);
      //     roundsLogicStub.stubs.calcRound.returns(1);
      //     block.height  = 98;
      //     dbHelpersStub = container.get(Symbols.helpers.db);
      //     dbHelpersStub.enqueueResponse('performOps', Promise.resolve());
      //   });
      //
      //   it('should call roundsLogic.calcRound twice', async () => {
      //     await (instance as any).innerTick(block, 'tx', true, txGeneratorStub, afterTxPromiseStub);
      //     expect(roundsLogicStub.stubs.calcRound.calledTwice).to.be.true;
      //     expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(block.height);
      //     expect(roundsLogicStub.stubs.calcRound.secondCall.args[0]).to.be.equal(block.height + 1);
      //   });
      //
      //   it('should call appStateLogic.set twice if all OK', async () => {
      //     await (instance as any).innerTick(block, 'tx', true, txGeneratorStub, afterTxPromiseStub);
      //     expect(appStateStub.stubs.set.calledTwice).to.be.true;
      //     expect(appStateStub.stubs.set.firstCall.args[0]).to.be.equal('rounds.isTicking');
      //     expect(appStateStub.stubs.set.firstCall.args[1]).to.be.true;
      //     expect(appStateStub.stubs.set.secondCall.args[0]).to.be.equal('rounds.isTicking');
      //     expect(appStateStub.stubs.set.secondCall.args[1]).to.be.false;
      //   });
      //
      //   it('should call sumRound if block.height is 1', async () => {
      //     block.height = 1;
      //     await (instance as any).innerTick(block, 'tx', true, txGeneratorStub, afterTxPromiseStub);
      //     expect(sumRoundStub.calledOnce).to.be.true;
      //     expect(sumRoundStub.firstCall.args[0]).to.be.equal(1);
      //   });
      //
      //   it('should call sumRound if nextRound !== round', async () => {
      //     roundsLogicStub.stubs.calcRound.onCall(0).returns(1);
      //     roundsLogicStub.stubs.calcRound.onCall(1).returns(2);
      //     await (instance as any).innerTick(block, 'tx', true, txGeneratorStub, afterTxPromiseStub);
      //     expect(sumRoundStub.calledOnce).to.be.true;
      //     expect(sumRoundStub.firstCall.args[0]).to.be.equal(1);
      //   });
      //
      //   it('should call txGenerator', async () => {
      //     await (instance as any).innerTick(block, 'tx', true, txGeneratorStub, afterTxPromiseStub);
      //     expect(txGeneratorStub.calledOnce).to.be.true;
      //     delete txGeneratorStub.firstCall.args[0].models;
      //     expect(txGeneratorStub.firstCall.args[0]).to.be.deep.equal({
      //       backwards     : true,
      //       block,
      //       finishRound   : false,
      //       library       : {
      //         logger: loggerStub,
      //       },
      //       modules       : {
      //         accounts: accountsModuleStub,
      //       },
      //       round         : 1,
      //       roundOutsiders: null,
      //     });
      //   });
      //
      //   it('should set roundFees: 0, roundRewards: [0], roundDelegates: [generatorPublicKey] if height = 1', async () => {
      //     block.height = 1;
      //     await (instance as any).innerTick(block, 'rz', true, txGeneratorStub, afterTxPromiseStub);
      //     const generatedRoundLogicScope = txGeneratorStub.firstCall.args[0];
      //     expect(generatedRoundLogicScope.roundFees).to.be.equal(0);
      //     expect(generatedRoundLogicScope.roundRewards).to.be.deep.equal([0]);
      //     expect(generatedRoundLogicScope.roundDelegates).to.be.deep.equal([block.generatorPublicKey]);
      //   });
      //
      //   it('should call getOutsiders if finishRound', async () => {
      //     // force finishRound
      //     roundsLogicStub.stubs.calcRound.onCall(0).returns(1);
      //     roundsLogicStub.stubs.calcRound.onCall(1).returns(2);
      //     await (instance as any).innerTick(block, 'tx', true, txGeneratorStub, afterTxPromiseStub);
      //     expect(getOutsidersStub.calledOnce).to.be.true;
      //     expect(getOutsidersStub.firstCall.args[0]).to.be.equal(1);
      //     expect(getOutsidersStub.firstCall.args[1]).to.be.deep.equal(roundSums.roundDelegates);
      //   });
      //
      //   it('should build roundLogicScope as expected', async () => {
      //     // block height != 1, finishRound = false
      //     const backwards = true;
      //     await (instance as any).innerTick(block, 'tx', backwards, txGeneratorStub, afterTxPromiseStub);
      //     let generatedRoundLogicScope = txGeneratorStub.firstCall.args[0];
      //     delete generatedRoundLogicScope.models;
      //     expect(generatedRoundLogicScope).to.be.deep.equal({
      //       backwards,
      //       block,
      //       finishRound   : false,
      //       library       : {
      //         logger: loggerStub,
      //       },
      //       modules       : {
      //         accounts: accountsModuleStub,
      //       },
      //       round         : 1,
      //       roundOutsiders: null,
      //     });
      //
      //     // block height != 1, finishRound = true
      //     roundsLogicStub.reset();
      //     txGeneratorStub.reset();
      //     roundsLogicStub.stubs.calcRound.onCall(0).returns(1);
      //     roundsLogicStub.stubs.calcRound.onCall(1).returns(2);
      //     await (instance as any).innerTick(block, 'tx', backwards, txGeneratorStub, afterTxPromiseStub);
      //     generatedRoundLogicScope = txGeneratorStub.firstCall.args[0];
      //     delete generatedRoundLogicScope.models;
      //     expect(generatedRoundLogicScope).to.be.deep.equal({
      //       backwards,
      //       block,
      //       finishRound   : true,
      //       library       : {
      //         logger: loggerStub,
      //       },
      //       modules       : {
      //         accounts: accountsModuleStub,
      //       },
      //       round         : 1,
      //       roundOutsiders: [],
      //       ...roundSums,
      //     });
      //
      //     // block height = 1
      //     roundsLogicStub.reset();
      //     txGeneratorStub.reset();
      //     roundsLogicStub.stubs.calcRound.returns(1);
      //     block.height = 1;
      //     await (instance as any).innerTick(block, 'tx', backwards, txGeneratorStub, afterTxPromiseStub);
      //     generatedRoundLogicScope = txGeneratorStub.firstCall.args[0];
      //     delete generatedRoundLogicScope.models;
      //     expect(generatedRoundLogicScope).to.be.deep.equal({
      //       backwards,
      //       block,
      //       finishRound   : true,
      //       library       : {
      //         logger: loggerStub,
      //       },
      //       modules       : {
      //         accounts: accountsModuleStub,
      //       },
      //       round         : 1,
      //       roundDelegates: [block.generatorPublicKey],
      //       roundFees     : 0,
      //       roundOutsiders: [],
      //       roundRewards  : [0],
      //     });
      //
      //   });
      //
      //   it('should call txGenerator and then afterTxPromise', async () => {
      //     await (instance as any).innerTick(block, 'tx', true, txGeneratorStub, afterTxPromiseStub);
      //     expect(afterTxPromiseStub.calledOnce).to.be.true;
      //     expect(txGeneratorStub.calledBefore(afterTxPromiseStub)).is.true;
      //   });
      //
      //   it('should set isTicking to true and then false if all success', async () => {
      //     await (instance as any).innerTick(block, 'tx', true, txGeneratorStub, afterTxPromiseStub);
      //     expect(appStateStub.stubs.set.callCount).is.eq(2);
      //     expect(appStateStub.stubs.set.firstCall.args[0]).is.eq('rounds.isTicking');
      //     expect(appStateStub.stubs.set.firstCall.args[1]).is.eq(true);
      //
      //     expect(appStateStub.stubs.set.secondCall.args[0]).is.eq('rounds.isTicking');
      //     expect(appStateStub.stubs.set.secondCall.args[1]).is.eq(false);
      //   });
      //   it('should set isTicking to true and then false if error', async () => {
      //     txGeneratorStub.rejects(new Error('error'));
      //     await expect((instance as any).innerTick(block, 'tx', true, txGeneratorStub, afterTxPromiseStub))
      //       .rejectedWith('error');
      //
      //     expect(appStateStub.stubs.set.callCount).is.eq(2);
      //     expect(appStateStub.stubs.set.firstCall.args[0]).is.eq('rounds.isTicking');
      //     expect(appStateStub.stubs.set.firstCall.args[1]).is.eq(true);
      //
      //     expect(appStateStub.stubs.set.secondCall.args[0]).is.eq('rounds.isTicking');
      //     expect(appStateStub.stubs.set.secondCall.args[1]).is.eq(false);
      //   });
      //
      // });
      //
      // describe('getOutsiders', () => {
      //   let round: number;
      //   let roundDelegates: string[];
      //
      //   beforeEach(() => {
      //     round          = 99;
      //     roundDelegates = ['key1', 'key2'];
      //     roundsLogicStub.stubs.lastInRound.returns(19532);
      //     delegatesModuleStub.stubs.generateDelegateList.returns(['outsider1', 'outsider2', ...roundDelegates]);
      //     accountsModuleStub.stubs.generateAddressByPublicKey.callsFake((pk) => {
      //       return 'addr_' + pk;
      //     });
      //   });
      //
      //   it('should call roundsLogic.lastInRound', async () => {
      //     await (instance as any).getOutsiders(round, roundDelegates);
      //     expect(roundsLogicStub.stubs.lastInRound.calledOnce).to.be.true;
      //     expect(roundsLogicStub.stubs.lastInRound.firstCall.args[0]).to.be.equal(round);
      //   });
      //
      //   it('should remove roundDelegates', async () => {
      //     // Let's leave our array intact after filter.
      //     accountsModuleStub.stubs.generateAddressByPublicKey.callsFake((pk) => {
      //       return pk;
      //     });
      //     const retVal = await (instance as any).getOutsiders(round, roundDelegates);
      //     expect(retVal).to.be.deep.equal(['outsider1', 'outsider2']);
      //   });
      //   it('should call accountsModule.generateAddressByPublicKey for each of the outsiders', async () => {
      //     await (instance as any).getOutsiders(round, roundDelegates);
      //     expect(accountsModuleStub.stubs.generateAddressByPublicKey.callCount).to.be.equal(2);
      //     expect(accountsModuleStub.stubs.generateAddressByPublicKey.firstCall.args[0]).to.be.equal('outsider1');
      //     expect(accountsModuleStub.stubs.generateAddressByPublicKey.secondCall.args[0]).to.be.equal('outsider2');
      //   });
      //
      //   it('should return an array of addresses', async () => {
      //     const retVal = await (instance as any).getOutsiders(round, roundDelegates);
      //     expect(Array.isArray(retVal)).to.be.true;
      //     expect(retVal).to.be.deep.equal(['addr_outsider1', 'addr_outsider2']);
      //   });
      // });
      //
      // describe('sumRound', () => {
      //   let round;
      //   let roundsModel: typeof RoundsModel;
      //   let sumRoundStub: SinonStub;
      //   beforeEach(() => {
      //     round        = 99;
      //     roundsModel  = container.get(Symbols.models.rounds);
      //     sumRoundStub = sandbox.stub(roundsModel, 'sumRound').resolves({
      //       rewards  : [1.1, 2.2, 3.6],
      //       fees     : 10.1,
      //       delegates: [Buffer.from('aa', 'hex'), Buffer.from('bb', 'hex')]
      //     });
      //   });
      //
      //   it('should call RoundsModel.sumRound', async () => {
      //     await (instance as any).sumRound(round, 'tx');
      //     expect(sumRoundStub.called).is.true;
      //     expect(sumRoundStub.firstCall.args).deep.eq([
      //       constants.activeDelegates,
      //       round,
      //       'tx'
      //     ]);
      //   });
      //
      //   it('should map sumRoundResponse correctly', async () => {
      //     const res = await (instance as any).sumRound(round, 'tx');
      //     expect(res).to.be.deep.eq({
      //       roundRewards: [1, 2, 3],
      //       roundFees   : 10,
      //       roundDelegates   : [Buffer.from('aa', 'hex'), Buffer.from('bb', 'hex')]
      //     });
      //   });
      //
    });
  });
});
