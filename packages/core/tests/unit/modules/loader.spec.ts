import {
  IAppState,
  IBlocksModel,
  IBlocksModule,
  IJobsQueue,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { IPeersModule, PeersLogic } from '@risevision/core-p2p';
import { createFakePeers } from '@risevision/core-p2p/tests/unit/utils/fakePeersFactory';
import { PeerType } from '@risevision/core-types';
import { wait } from '@risevision/core-utils';
import { LoggerStub } from '@risevision/core-utils/tests/unit/stubs';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as proxyquire from 'proxyquire';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { CoreSymbols } from '../../../src';
import { LoaderModule } from '../../../src/modules';

chai.use(chaiAsPromised);

let promiseRetryStub: any;

// tslint:disable no-unused-expression max-line-length no-big-function object-literal-sort-keys
const ProxyLoaderModule = proxyquire('../../../src/modules/loader', {
  'promise-retry': (...args) => {
    return promiseRetryStub.apply(this, args);
  },
});

describe('modules/loader', () => {
  let instance: LoaderModule;
  let container: Container;
  let sandbox: SinonSandbox;
  let retryStub: SinonStub;
  let constants;
  let appConfig;
  let genesisBlock;
  let blocksModule: IBlocksModule;
  let systemModule: ISystemModule;
  let appState: IAppState;
  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(async () => {
    retryStub = sandbox.stub();
    promiseRetryStub = sandbox
      .stub()
      .callsFake(sandbox.spy((w) => Promise.resolve(w(retryStub))));
    genesisBlock = {
      blockSignature: Buffer.from('10'),
      id: 10,
      payloadHash: Buffer.from('10'),
    };
    appConfig = {
      loading: {
        loadPerIteration: 10,
        snapshot: false,
      },
      forging: {
        transactionsPolling: false,
      },
    };
    constants = {
      activeDelegates: 1,
      epochTime: { getTime: sinon.stub().returns(1000) },
      maxPeers: 100,
      blocks: {
        targetTime: 30,
      },
    } as any;
    container = await createContainer([
      'core',
      'core-helpers',
      'core-crypto',
      'core-blocks',
      'core-accounts',
      'core-transactions',
    ]);

    container.rebind(Symbols.generic.appConfig).toConstantValue(appConfig);
    container
      .rebind(Symbols.generic.genesisBlock)
      .toConstantValue(genesisBlock);
    container.rebind(Symbols.generic.constants).toConstantValue(constants);
    container
      .rebind(CoreSymbols.modules.loader)
      .to(ProxyLoaderModule.LoaderModule);
    systemModule = container.get(Symbols.modules.system);
    instance = container.get(CoreSymbols.modules.loader);
    (instance as any).jobsQueue.register = sandbox
      .stub()
      .callsFake((val, fn) => fn());
    (instance as any).defaultSequence.addAndPromise = sandbox
      .stub()
      .callsFake((w) => Promise.resolve(w()));
    instance = container.get(CoreSymbols.modules.loader);
    blocksModule = container.get<any>(Symbols.modules.blocks);
    blocksModule.lastBlock = {
      height: 1,
      id: 1,
    } as any;
    appState = container.get(Symbols.logic.appState);
    const logger = container.get<LoggerStub>(Symbols.helpers.logger);
    logger.stubReset();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('.initialize', () => {
    it('should set instance.network to default value after the creation of the object', () => {
      expect((instance as any).network).to.be.deep.equal({
        height: 0,
        peers: [],
      });
    });
  });

  describe('.getNetwork', () => {
    let peersModuleStub: IPeersModule;
    let peersLogicStub: PeersLogic;
    let loggerStub: LoggerStub;
    let peers: PeerType[];
    let listPEersStub: SinonStub;
    let peersCreateStub: SinonStub;
    beforeEach(() => {
      peers = createFakePeers(2);
      peers[0].height = 3;

      peersModuleStub = container.get(Symbols.modules.peers);
      peersLogicStub = container.get(Symbols.logic.peers);
      loggerStub = container.get(Symbols.helpers.logger);

      peersCreateStub = sandbox
        .stub(peersLogicStub, 'create')
        .callsFake((peer) => peer as any);
      listPEersStub = sandbox.stub(peersModuleStub, 'list');
    });

    afterEach(() => {
      loggerStub.stubReset();
    });

    it('should return unchanged instance.network if (network.height <= 0 and Math.abs(expressive) === 1)', async () => {
      blocksModule.lastBlock = {
        height: 0,
      } as any;
      (instance as any).network = {
        height: 1,
        peers: [],
      };

      const result = await instance.getNetwork();

      expect(result).to.be.deep.equal({ height: 1, peers: [] });
    });

    it('should call instance.peersModule.list if instance.network.height > 0', async () => {
      (instance as any).network = {
        height: 1,
        peers: [],
      };
      listPEersStub.returns({ peers });

      await instance.getNetwork();

      expect(listPEersStub.calledOnce).to.be.true;
    });

    it('should call instance.logger.trace methods', async () => {
      listPEersStub.returns({ peers });

      await instance.getNetwork();

      expect(loggerStub.stubs.trace.callCount).to.be.equal(3);

      expect(loggerStub.stubs.trace.getCall(0).args.length).to.be.equal(2);
      expect(loggerStub.stubs.trace.getCall(0).args[0]).to.be.equal(
        'Good peers - received'
      );
      expect(loggerStub.stubs.trace.getCall(0).args[1]).to.be.deep.equal({
        count: peers.length,
      });

      expect(loggerStub.stubs.trace.getCall(1).args.length).to.be.equal(2);
      expect(loggerStub.stubs.trace.getCall(1).args[0]).to.be.equal(
        'Good peers - filtered'
      );
      expect(loggerStub.stubs.trace.getCall(1).args[1]).to.be.deep.equal({
        count: peers.length,
      });

      expect(loggerStub.stubs.trace.getCall(2).args.length).to.be.equal(2);
      expect(loggerStub.stubs.trace.getCall(2).args[0]).to.be.equal(
        'Good peers - accepted'
      );
      expect(loggerStub.stubs.trace.getCall(2).args[1]).to.be.deep.equal({
        count: 2,
      });
    });

    it('should call instance.logger.debug methods', async () => {
      listPEersStub.returns({ peers });
      loggerStub.stubs.debug.resetHistory();
      await instance.getNetwork();

      expect(loggerStub.stubs.debug.callCount).to.be.equal(1);
      expect(loggerStub.stubs.debug.getCall(0).args.length).to.be.equal(2);
      expect(loggerStub.stubs.debug.getCall(0).args[0]).to.be.equal(
        'Good peers'
      );
      expect(loggerStub.stubs.debug.getCall(0).args[1]).to.be.deep.equal([
        peers[0].string,
        peers[1].string,
      ]);
    });

    it('should return instance.network with empty peersArray prop if each of peersModule.list() peers is null', async () => {
      listPEersStub.returns({ peers: [null, null] });

      const ret = await instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 0, peers: [] });
      expect((instance as any).network).to.be.deep.equal({
        height: 0,
        peers: [],
      });
    });

    it('should return instance.network with empty peersArray prop if each of peersModule.list() peers has height < lastBlock.height ', async () => {
      blocksModule.lastBlock.height = 5;
      listPEersStub.returns({ peers });

      const ret = await instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 0, peers: [] });
    });

    it('should return instance.network with two peers in  peersArray prop', async () => {
      listPEersStub.returns({ peers });

      const ret = await instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 2, peers });
    });

    it('should return a sorted peersArray', async () => {
      peers[1].height += 3;
      listPEersStub.returns({ peers });

      const ret = await instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 4, peers: [peers[1], peers[0]] });
    });

    it('should return instance.network with one item in peersArray(check .findGoodPeers second .filter)', async () => {
      peers[0].height = 10;
      listPEersStub.returns({ peers });

      const ret = await instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 10, peers: [peers[0]] });
    });
  });

  describe('.getRandomPeer', () => {
    let getNetworkStub;
    let peers: PeerType[];

    beforeEach(() => {
      peers = createFakePeers(3);
      getNetworkStub = sandbox
        .stub(instance as any, 'getNetwork')
        .resolves({ peers });
    });

    it('should call instance.getNetwork', async () => {
      await instance.getRandomPeer();

      expect(getNetworkStub.calledOnce).to.be.true;
    });

    it('should return random peer', async () => {
      const ret = await instance.getRandomPeer();

      expect(peers).to.include(ret);
    });
    it('should reject if no peers', async () => {
      getNetworkStub.resolves({ peers: [] });
      await expect(instance.getRandomPeer()).rejectedWith(
        'No acceptable peers for the operation'
      );
    });
  });

  describe('get .isSyncing', () => {
    let appStateStub: IAppState;
    let appStateGet: SinonStub;
    beforeEach(() => {
      appStateStub = container.get(Symbols.logic.appState);
      appStateGet = sandbox.stub(appStateStub, 'get');
    });

    it('should call appState.get', () => {
      appStateGet.returns(true);
      instance.isSyncing;

      expect(appStateGet.calledOnce).to.true;
    });

    it('should return loader.isSyncing state', () => {
      appStateGet.returns(true);
      const ret = instance.isSyncing;

      expect(ret).to.be.true;
    });

    it('should return false if appState.get returned undefined', () => {
      appStateGet.returns(undefined);
      const ret = instance.isSyncing;

      expect(ret).to.be.false;
    });
  });

  describe('.loadBlockChain', () => {
    let blocksModel: typeof IBlocksModel;
    let loadStub: SinonStub;
    beforeEach(() => {
      blocksModel = container.getNamed(
        ModelSymbols.model,
        Symbols.models.blocks
      );
      loadStub = sandbox.stub(instance, 'load').resolves();
    });
    it('should call load if blocksmodel.count is 1', async () => {
      const stub = sandbox.stub(blocksModel, 'count').resolves(1);
      await instance.loadBlockChain();
      expect(stub.called).is.true;
      expect(loadStub.called).is.true;
      expect(loadStub.firstCall.args).is.deep.eq([1, 10, null, true]);
    });
    describe('with more than 1 block', () => {
      let countStub: SinonStub;
      let findGenesisStub: SinonStub;
      const blocksCount = 2;
      beforeEach(() => {
        countStub = sandbox.stub(blocksModel, 'count').resolves(blocksCount);
        findGenesisStub = sandbox.stub(blocksModel, 'findOne');
      });
      it('should throw if findOne height=1 is a different genesis block', async () => {
        findGenesisStub.resolves({ id: '1' });
        await expect(instance.loadBlockChain()).to.be.rejectedWith(
          'Failed to match genesis block with database'
        );

        // Case 2
        findGenesisStub.resolves({
          id: genesisBlock.id,
          payloadHash: Buffer.from('aa'),
        });
        await expect(instance.loadBlockChain()).to.be.rejectedWith(
          'Failed to match genesis block with database'
        );

        // Case 3
        findGenesisStub.resolves({
          id: genesisBlock.id,
          payloadHash: genesisBlock.payloadHash,
          blockSignature: Buffer.from('aa'),
        });
        await expect(instance.loadBlockChain()).to.be.rejectedWith(
          'Failed to match genesis block with database'
        );
      });
      /*
      describe('valid genesis in db', () => {
        let roundsLogic: RoundsLogicStub;
        let accountsModel: typeof AccountsModel;
        let accountsCountStub: SinonStub;
        beforeEach(() => {
          findGenesisStub.resolves(genesisBlock);
          roundsLogic = container.get(Symbols.logic.rounds);
          accountsModel = container.get(Symbols.models.accounts);
          roundsLogic.enqueueResponse('calcRound', 1);
          accountsCountStub = sandbox.stub(accountsModel, 'count');
        });
        it('should query for current round given the number of current blocks', async () => {
          roundsLogic.stubs.calcRound.throws(new Error('die'));
          await expect(instance.loadBlockChain()).to.be.rejectedWith('die');
          expect(roundsLogic.stubs.calcRound.firstCall.args[0]).eq(blocksCount);
        });
        describe('verifySnapshot case', () => {
          it(
            'should rest config.loading.snapshot to current round if config was boolean'
          );
          it(
            'should reset snapshot to round-1 if blocksCount is not divisible by activeDelegates'
          );
          it('should set appState rounds.snapshot to correct value');
          it('should call load with correct data');
          it(
            'should process.exit 1 if it was not possible to load until desired block'
          );
        });

        describe('with accounts ok', async () => {
          let roundsModel: typeof RoundsModel;
          let roundsFindAllStub: SinonStub;
          beforeEach(() => {
            accountsCountStub.onFirstCall().resolves(1);
            roundsModel = container.get(Symbols.models.rounds);
            roundsFindAllStub = sandbox.stub(roundsModel, 'findAll');
          });
          it('should call load with proper data if there is some other round rows != than current round', async () => {
            roundsFindAllStub.resolves([{ round: 1 }, { round: 2 }]);
            await instance.loadBlockChain();
            expect(roundsFindAllStub.called).is.true;
            expect(roundsFindAllStub.firstCall.args[0]).is.deep.eq({
              attributes: ['round'],
              group: 'round',
            });
            expect(loadStub.called).is.true;
            expect(loadStub.firstCall.args).deep.eq([
              blocksCount,
              10,
              'Detected unapplied rounds in mem_round',
              true,
            ]);
          });

          describe('with rounds data ok', () => {
            let processExitStub: SinonStub;
            let sequelizeQueryStub: SinonStub;
            beforeEach(() => {
              roundsFindAllStub.resolves([]);
              processExitStub = sandbox
                .stub(process, 'exit')
                .throws(new Error('exit'));
              sequelizeQueryStub = sandbox.stub(roundsModel.sequelize, 'query');
            });
            it('should exit if some duplicatedDelegates', async () => {
              sequelizeQueryStub.onFirstCall().resolves([{ count: 1 }]);
              await expect(instance.loadBlockChain()).be.rejectedWith('exit');
              expect(processExitStub.called).is.true;
              expect(processExitStub.firstCall.args[0]).eq(1);
              expect(sequelizeQueryStub.firstCall.args[0]).eq(
                'WITH duplicates AS (SELECT COUNT(1) FROM delegates GROUP BY "transactionId" HAVING COUNT(1) > 1) SELECT count(1) FROM duplicates'
              );
              expect(sequelizeQueryStub.firstCall.args[1]).deep.eq({
                type: sequelize.QueryTypes.SELECT,
              });
            });
            describe('with no dup delegates', () => {
              let restoreUnconfirmedEntriesStub: SinonStub;
              beforeEach(() => {
                sequelizeQueryStub.onFirstCall().resolves([{ count: 0 }]);
                restoreUnconfirmedEntriesStub = sandbox
                  .stub(accountsModel, 'restoreUnconfirmedEntries')
                  .resolves();
              });
              it('should call restoreUnconfirmedEntries', async () => {
                restoreUnconfirmedEntriesStub.rejects(new Error('hey'));
                await expect(instance.loadBlockChain()).rejectedWith('hey');
                expect(restoreUnconfirmedEntriesStub.called).is.true;
              });
              describe('with no orphan accounts', () => {
                beforeEach(() => {
                  sequelizeQueryStub.onSecondCall().resolves([]);
                });
                it('should call load if there are no delegates', async () => {
                  accountsCountStub.onSecondCall().resolves(0);
                  await instance.loadBlockChain();
                  expect(loadStub.called).is.true;
                  expect(loadStub.firstCall.args).deep.eq([
                    blocksCount,
                    10,
                    'No delegates found',
                    true,
                  ]);
                });
                describe('with delegates', async () => {
                  let blocksUtilsStub: BlocksSubmoduleUtilsStub;
                  let busStub: BusStub;
                  beforeEach(() => {
                    accountsCountStub.onSecondCall().resolves(1);
                    blocksUtilsStub = container.get(
                      Symbols.modules.blocksSubModules.utils
                    );
                    busStub = container.get(Symbols.helpers.bus);
                  });
                  it('call load if loadLastBlock rejects', async () => {
                    blocksUtilsStub.enqueueResponse(
                      'loadLastBlock',
                      Promise.reject('errr')
                    );
                    await instance.loadBlockChain();
                    expect(loadStub.called).is.true;
                    expect(loadStub.firstCall.args).deep.eq([
                      blocksCount,
                      10,
                      'Failed to load last block',
                    ]);
                    expect(busStub.stubs.message.called).is.false;
                  });
                  it('should loadLastBlock if everything is fine and eventually broadcast message', async () => {
                    blocksUtilsStub.enqueueResponse(
                      'loadLastBlock',
                      Promise.resolve()
                    );
                    busStub.enqueueResponse('message', Promise.resolve());
                    await instance.loadBlockChain();
                    expect(blocksUtilsStub.stubs.loadLastBlock.called).is.true;
                    expect(busStub.stubs.message.called).is.true;
                    expect(busStub.stubs.message.firstCall.args[0]).eq(
                      'blockchainReady'
                    );
                  });
                });
              });
            });
          });

        });
      });
      */
    });
  });
  /*
    describe('.load', () => {
      let count;
      let limitPerIteration;
      let message;
      let emitBlockchainReady;

      let loggerStub;

      let accountLogicStub: AccountLogic;

      let lastBlock;
      let error;

      beforeEach(() => {
        count               = 2;
        limitPerIteration   = 3;
        message             = 'message';
        emitBlockchainReady = true;
        lastBlock           = { data: 'data' };
        error               = {
          block: {
            height: 1,
            id    : 1,
          },
        };

        loggerStub       = container.get<LoggerStub>(Symbols.helpers.logger);
        accountLogicStub = container.get<AccountLogic>(Symbols.logic.account);
      });

      it('should call logger.warn twice if message exist', async () => {
        await instance.load(count, limitPerIteration, message);

        expect(loggerStub.stubs.warn.calledTwice).to.be.true;

        expect(loggerStub.stubs.warn.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal(message);

        expect(loggerStub.stubs.warn.secondCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.warn.secondCall.args[0]).to.be.equal(
          'Recreating memory tables'
        );
      });

      it('should not call logger.warn if message is not exist', async () => {
        await instance.load(count, limitPerIteration);

        expect(loggerStub.stubs.warn.notCalled).to.be.true;
      });

      // it('should call accountLogic.removeTables', async () => {
      //   await instance.load(count, limitPerIteration);
      //
      //   expect(accountLogicStub.stubs.removeTables.calledOnce).to.be.true;
      // });
      //
      // it('should call accountLogic.createTables', async () => {
      //   await instance.load(count, limitPerIteration);
      //
      //   expect(accountLogicStub.stubs.createTables.calledOnce).to.be.true;
      // });

      it('should call logger.info count > 1', async () => {
        await instance.load(count, limitPerIteration);

        expect(loggerStub.stubs.info.calledOnce).to.be.true;

        expect(loggerStub.stubs.info.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal(
          'Rebuilding blockchain, current block height: ' + 1
        );
      });

      // it('should call blocksProcessModule.loadBlocksOffset', async () => {
      //   await instance.load(count, limitPerIteration);
      //
      //   expect(blocksProcessModuleStub.stubs.loadBlocksOffset.calledOnce).to.be
      //     .true;
      //
      //   expect(
      //     blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args.length
      //   ).to.be.equal(3);
      //   expect(
      //     blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args[0]
      //   ).to.be.equal(3);
      //   expect(
      //     blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args[1]
      //   ).to.be.equal(0);
      //   expect(
      //     blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args[2]
      //   ).to.be.equal(true);
      // });
      //
      // it('should call logger.info and bus.message if emitBlockchainReady exist', async () => {
      //   busStub.enqueueResponse('message', '');
      //
      //   await instance.load(
      //     count,
      //     limitPerIteration,
      //     message,
      //     emitBlockchainReady
      //   );
      //
      //   expect(loggerStub.stubs.info.calledTwice).to.be.true;
      //   expect(loggerStub.stubs.info.secondCall.args.length).to.be.equal(1);
      //   expect(loggerStub.stubs.info.secondCall.args[0]).to.be.equal(
      //     'Blockchain ready'
      //   );
      //
      //   expect(busStub.stubs.message.calledOnce).to.be.true;
      //   expect(busStub.stubs.message.firstCall.args.length).to.be.equal(1);
      //   expect(busStub.stubs.message.firstCall.args[0]).to.be.equal(
      //     'blockchainReady'
      //   );
      // });

      // it('should not call logger.info if count <= 1', async () => {
      //   await instance.load(1, limitPerIteration);
      //
      //   expect(loggerStub.stubs.info.notCalled).to.be.true;
      // });
      //
      // it('should be no iterations if count less than offset( < 0)', async () => {
      //   await instance.load(-1, limitPerIteration);
      //
      //   expect(blocksProcessModuleStub.stubs.loadBlocksOffset.notCalled).to.be
      //     .true;
      // });
      //
      // it('should call logger.error if throw error', async () => {
      //   loggerStub.stubs.info.throws(error);
      //   busStub.enqueueResponse('message', '');
      //   blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});
      //
      //   await instance.load(
      //     count,
      //     limitPerIteration,
      //     message,
      //     emitBlockchainReady
      //   );
      //
      //   expect(loggerStub.stubs.error.called).to.be.true;
      //   expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
      //   expect(loggerStub.stubs.error.firstCall.args[0]).to.be.deep.equal(error);
      // });
      //
      // it('should call logger.error twice if throw error and error.block exist', async () => {
      //   loggerStub.stubs.info.throws(error);
      //   busStub.enqueueResponse('message', '');
      //   blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});
      //
      //   await instance.load(
      //     count,
      //     limitPerIteration,
      //     message,
      //     emitBlockchainReady
      //   );
      //
      //   expect(loggerStub.stubs.error.calledThrice).to.be.true;
      //   expect(loggerStub.stubs.error.secondCall.args.length).to.be.equal(1);
      //   expect(loggerStub.stubs.error.secondCall.args[0]).to.be.deep.equal(
      //     'Blockchain failed at: ' + error.block.height
      //   );
      //
      //   expect(loggerStub.stubs.error.thirdCall.args.length).to.be.equal(1);
      //   expect(loggerStub.stubs.error.thirdCall.args[0]).to.be.deep.equal(
      //     'Blockchain clipped'
      //   );
      // });
      //
      // it('should call blocksChainModule.deleteAfterBlock if throw error and error.block exist', async () => {
      //   loggerStub.stubs.info.throws(error);
      //   busStub.enqueueResponse('message', '');
      //   blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});
      //
      //   await instance.load(
      //     count,
      //     limitPerIteration,
      //     message,
      //     emitBlockchainReady
      //   );
      //
      //   expect(blocksChainModuleStub.stubs.deleteAfterBlock.calledOnce).to.be
      //     .true;
      //   expect(
      //     blocksChainModuleStub.stubs.deleteAfterBlock.firstCall.args.length
      //   ).to.be.equal(1);
      //   expect(
      //     blocksChainModuleStub.stubs.deleteAfterBlock.firstCall.args[0]
      //   ).to.be.equal(error.block.id);
      // });
      //
      // it('should call bus.message if throw error and error.block exist', async () => {
      //   loggerStub.stubs.info.throws(error);
      //   busStub.enqueueResponse('message', '');
      //   blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});
      //
      //   await instance.load(
      //     count,
      //     limitPerIteration,
      //     message,
      //     emitBlockchainReady
      //   );
      //
      //   expect(busStub.stubs.message.calledOnce).to.be.true;
      //   expect(busStub.stubs.message.firstCall.args.length).to.be.equal(1);
      //   expect(busStub.stubs.message.firstCall.args[0]).to.be.equal(
      //     'blockchainReady'
      //   );
      // });

      it('should throw error if throw error in try block and error.block is not exist', async () => {
        delete error.block;
        loggerStub.stubs.info.throws(error);

        await expect(instance.load(count, limitPerIteration)).to.be.rejectedWith(
          error
        );
      });
    });
  */
  /*
  describe('.sync', () => {
    let transactionsModuleStub: ITransactionsModule;
    let broadcasterLogicStub: IBroadcasterLogic;
    let systemModuleStub: ISystemModule;
    let loggerStub: LoggerStub;
    let getPeersStub: SinonStub;
    let syncTriggerStub: SinonStub;
    let loadBlocksFromNetworkStub: SinonStub;
    let systemModuleUpdateStub: SinonStub;
    let peersModule: IPeersModule;

    beforeEach(() => {
      syncTriggerStub           = sandbox.stub(instance as any, 'syncTrigger');
      loadBlocksFromNetworkStub = sandbox.stub(
        instance as any,
        'loadBlocksFromNetwork'
      );

      transactionsModuleStub = container.get(
        Symbols.modules.transactions
      );
      broadcasterLogicStub   = container.get(
        Symbols.logic.broadcaster
      );
      systemModuleStub       = container.get(
        Symbols.modules.system
      );
      peersModule = container.get(p2pSymbols.modules.peers);
      loggerStub             = container.get<LoggerStub>(Symbols.helpers.logger);

      getPeersStub           = sandbox.stub(peersModule, 'getPeers').resolves();
      systemModuleUpdateStub = sandbox.stub(systemModuleStub, 'update').resolves();
    });

    afterEach(() => {
      loggerStub.stubReset();
    });

    it('call logger.info methods', async () => {
      await (instance as any).sync();

      expect(loggerStub.stubs.info.callCount).to.be.equal(2);

      expect(loggerStub.stubs.info.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal(
        'Starting sync'
      );

      expect(loggerStub.stubs.info.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.secondCall.args[0]).to.be.equal(
        'Finished sync'
      );
    });

    it('call logger.debug methods', async () => {
      loggerStub.stubReset();
      await (instance as any).sync();

      expect(loggerStub.stubs.debug.callCount).to.be.equal(2);

      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal(
        'Establishing broadhash consensus before sync'
      );

      expect(loggerStub.stubs.debug.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.secondCall.args[0]).to.be.equal(
        'Establishing broadhash consensus after sync'
      );
    });

    // it('call bus\'s methods', async () => {
    //   await (instance as any).sync();
    //
    //   expect(busStub.stubs.message.calledTwice).to.be.true;
    //
    //   expect(busStub.stubs.message.firstCall.args.length).to.be.equal(1);
    //   expect(busStub.stubs.message.firstCall.args[0]).to.be.equal(
    //     'syncStarted'
    //   );
    //
    //   expect(busStub.stubs.message.secondCall.args.length).to.be.equal(1);
    //   expect(busStub.stubs.message.secondCall.args[0]).to.be.equal(
    //     'syncFinished'
    //   );
    // });

    it('call broadcasterLogic methods', async () => {
      await (instance as any).sync();

      expect(getPeersStub.calledTwice).to.be.true;

      expect(
        getPeersStub.firstCall.args.length
      ).to.be.equal(1);
      expect(
        getPeersStub.firstCall.args[0]
      ).to.be.deep.equal({ limit: constants.maxPeers });

      expect(
        getPeersStub.secondCall.args.length
      ).to.be.equal(1);
      expect(
        getPeersStub.secondCall.args[0]
      ).to.be.deep.equal({ limit: constants.maxPeers });
    });

    it('call instance.syncTrigger', async () => {
      await (instance as any).sync();

      expect(syncTriggerStub.calledTwice).to.be.true;

      expect(syncTriggerStub.firstCall.args.length).to.be.equal(1);
      expect(syncTriggerStub.firstCall.args[0]).to.be.true;

      expect(syncTriggerStub.secondCall.args.length).to.be.equal(1);
      expect(syncTriggerStub.secondCall.args[0]).to.be.false;
    });

    it('check instance field', async () => {
      await (instance as any).sync();

      expect((instance as any).isActive).to.be.false;
      expect((instance as any).blocksToSync).to.be.equal(0);
    });
  });

  describe('.loadBlocksFromNetwork', () => {
    let getRandomPeerStub: SinonStub;
    let loggerStub: LoggerStub;
    let blocksProcessModuleStub: BlocksModuleProcess;
    let blocksModuleStub: IBlocksModule;

    let randomPeer;
    let lastValidBlock;
    let isStaleStub: SinonStub;
    let loadBlocksFromPeerStub: SinonStub;

    beforeEach(() => {
      randomPeer     = { string: 'string', height: 2 };
      lastValidBlock = { height: 1, id: 1, timestamp: 0 } as any;

      blocksModuleStub        = blocksModule;
      loggerStub              = container.get<LoggerStub>(Symbols.helpers.logger);
      blocksProcessModuleStub = container.get(BlocksSymbols.modules.process);

      getRandomPeerStub      = sandbox
        .stub(instance as any, 'getRandomPeer')
        .resolves(randomPeer);
      loadBlocksFromPeerStub = sandbox
        .stub(blocksProcessModuleStub, 'loadBlocksFromPeer')
        .resolves(lastValidBlock);

      blocksModuleStub.lastReceipt.isStale = () => false;

      isStaleStub = sandbox.stub(blocksModuleStub.lastReceipt, 'isStale').returns(false);
    });

    afterEach(() => {
      loggerStub.stubReset();
    });

    it('should call promiseRetry', async () => {
      await (instance as any).loadBlocksFromNetwork();

      expect(promiseRetryStub.calledOnce).to.be.true;
      expect(promiseRetryStub.firstCall.args.length).to.be.equal(2);
      expect(promiseRetryStub.firstCall.args[0]).to.be.a('function');
      expect(promiseRetryStub.firstCall.args[1]).to.be.deep.eq({ retries: 3, maxTimeout: 2000 });
    });

    // it('should call wait if typeof(randomPeer) === undefined', async () => {
    //   getRandomPeerStub.onCall(0).resolves(undefined);
    //   getRandomPeerStub.onCall(1).resolves(randomPeer);
    //   const waitStub = sandbox.stub(helpers,  'wait');
    //
    //   await (instance as any).loadBlocksFromNetwork();
    //
    //   expect(getRandomPeerStub.calledTwice).to.be.true;
    //
    //   expect(waitStub.calledOnce).to.be.true;
    //   expect(waitStub.firstCall.args.length).to.be.equal(1);
    //   expect(waitStub.firstCall.args[0]).to.be.equal(1000);
    // });

    describe('lastBlock.height !== 1', () => {
      let commonBlock;
      let getCommonBlockStub: SinonStub;
      beforeEach(() => {
        commonBlock        = {};
        getCommonBlockStub = sandbox.stub(blocksProcessModuleStub, 'getCommonBlock')
          .resolves(commonBlock);
        promiseRetryStub.onCall(0).callsFake(
          sandbox.spy((w) => {
            blocksModule.lastBlock = { height: 2, id: 1 } as any;
            return Promise.resolve(w(retryStub));
          })
        );

        // second call for set the lastBlock.height in 1 for cycle finish
        promiseRetryStub.onCall(1).callsFake(
          sandbox.spy((w) => {
            blocksModule.lastBlock = { height: 1, id: 1 } as any;
            return Promise.resolve(w(retryStub));
          })
        );
      });

      it('should call logger.info', async () => {
        await (instance as any).loadBlocksFromNetwork();

        expect(loggerStub.stubs.info.calledOnce).to.be.true;
        expect(loggerStub.stubs.info.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal(
          'Looking for common block with: string'
        );
      });

      it('should call blocksProcessModule.getCommonBlock', async () => {
        await (instance as any).loadBlocksFromNetwork();

        expect(getCommonBlockStub.calledOnce).to.be
          .true;
        expect(
          getCommonBlockStub.firstCall.args.length
        ).to.be.equal(2);
        expect(
          getCommonBlockStub.firstCall.args[0]
        ).to.be.deep.equal(randomPeer);
        expect(
          getCommonBlockStub.firstCall.args[1]
        ).to.be.equal(2);
      });

      it('should call logger.error and return after if commonBlock is null', async () => {
        getCommonBlockStub.resolves(null);

        await (instance as any).loadBlocksFromNetwork();

        expect(loggerStub.stubs.error.calledOnce).to.be.true;
        expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal(
          'Failed to find common block with: string'
        );
        expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal(
          'Failed to find common block with: string'
        );

        expect(retryStub.calledOnce).to.be.true;
        expect(retryStub.firstCall.args.length).to.be.equal(1);
        expect(retryStub.firstCall.args[0]).to.be.instanceof(Error);
        expect(retryStub.firstCall.args[0].message).to.be.deep.equal(
          'Failed to find common block'
        );
      });

      it('should call logger.error one and return after if blocksProcessModule.getCommonBlock thro error', async () => {
        const error = new Error('error');
        getCommonBlockStub.rejects(error);
        loggerStub.stubReset();

        await (instance as any).loadBlocksFromNetwork();
        expect(loggerStub.stubs.error.calledOnce).to.be.true;

        expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal(
          'Failed to find common block with: string'
        );

        expect(retryStub.firstCall.args[0]).to.be.deep.equal(error);
      });
    });

    it('should call blocksProcessModule.loadBlocksFromPeer', async () => {
      await (instance as any).loadBlocksFromNetwork();

      expect(loadBlocksFromPeerStub.calledOnce).to.be
        .true;
      expect(
        loadBlocksFromPeerStub.firstCall.args.length
      ).to.be.equal(1);
      expect(
        loadBlocksFromPeerStub.firstCall.args[0]
      ).to.be.equal(randomPeer);
    });

    it('should call blocksModule.lastReceipt.update', async () => {
      const spy = sandbox.spy(blocksModule.lastReceipt, 'update');
      await (instance as any).loadBlocksFromNetwork();

      expect(spy.calledOnce).to.be.true;
      expect(
        spy.firstCall.args.length
      ).to.be.equal(1);
      expect(
        spy.firstCall.args[0]
      ).to.be.equal(1);
    });

    it('should call logger.error twice and return after if blocksProcessModule.loadBlocksFromPeer thro error', async () => {
      const error = new Error('error');
      loadBlocksFromPeerStub.onFirstCall().rejects(error);
      loadBlocksFromPeerStub.onSecondCall().resolves(lastValidBlock);

      await (instance as any).loadBlocksFromNetwork();

      expect(loggerStub.stubs.error.calledTwice).to.be.true;

      expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal(
        error.toString()
      );

      expect(loggerStub.stubs.error.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.error.secondCall.args[0]).to.be.equal(
        'Failed to load blocks from: string'
      );

      expect(retryStub.firstCall.args[0]).to.be.deep.equal(error);
    });

    it('should start second iterate in the cycle if lastValidBlock.id === lastBlock.id', async () => {
      loadBlocksFromPeerStub.onFirstCall().resolves({
        height   : 1,
        id       : 12,
        timestamp: 0,
      });
      loadBlocksFromPeerStub.onSecondCall().resolves(lastValidBlock);

      await (instance as any).loadBlocksFromNetwork();

      expect(loadBlocksFromPeerStub.calledTwice).to.be
        .true;
    });
    it('should not iterate forever if loadBlocksFromPeer throws', async function () {
      this.timeout(10000);

      container.rebind(CoreSymbols.modules.loader).to(LoaderModule);
      instance = container.get(CoreSymbols.modules.loader);
      sandbox
        .stub(instance as any, 'getRandomPeer')
        .resolves(randomPeer);
      // blocksProcessModuleStub.reset();
      // 3 retries + first
      for (let i = 0; i < 4; i++) {
        loadBlocksFromPeerStub
          .onCall(i)
          .rejects(new Error(`${i}`));
      }
      await wait(1000);
      await (instance as any).loadBlocksFromNetwork();

      expect(loadBlocksFromPeerStub.callCount).eq(4);
    });
  });
*/
  // describe('.loadSignatures', () => {
  //   let getRandomPeerStub: SinonStub;
  //   let loggerStub: LoggerStub;
  //   let transportModuleStub: TransportModuleStub;
  //   let schemaStub: ZSchemaStub;
  //   let sequenceStub: SequenceStub;
  //   let multisigModuleStub: MultisignaturesModuleStub;
  //
  //   let res;
  //   let randomPeer;
  //
  //   beforeEach(() => {
  //     randomPeer = { string: 'string', makeRequest: sandbox.stub()};
  //     res = {
  //         signatures: [
  //           {
  //             signatures: [
  //               {
  //                 signature: 'sig11',
  //               },
  //             ],
  //             transaction: 'tr11',
  //           },
  //           {
  //             signatures: [
  //               {
  //                 signature: 'sig22',
  //               },
  //             ],
  //             transaction: 'tr22',
  //           },
  //         ],
  //     };
  //     randomPeer.makeRequest.resolves(res);
  //
  //     loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);
  //     transportModuleStub = container.get<TransportModuleStub>(
  //       Symbols.modules.transport
  //     );
  //     schemaStub = container.get<ZSchemaStub>(Symbols.generic.zschema);
  //     sequenceStub = container.getTagged<SequenceStub>(
  //       Symbols.helpers.sequence,
  //       Symbols.helpers.sequence,
  //       Symbols.tags.helpers.defaultSequence
  //     );
  //     multisigModuleStub = container.get<MultisignaturesModuleStub>(
  //       Symbols.modules.multisignatures
  //     );
  //
  //     getRandomPeerStub = sandbox
  //       .stub(instance as any, 'getRandomPeer')
  //       .resolves(randomPeer);
  //     transportModuleStub.enqueueResponse('getFromPeer', res);
  //     multisigModuleStub.enqueueResponse(
  //       'processSignature',
  //       Promise.resolve({})
  //     );
  //     multisigModuleStub.enqueueResponse(
  //       'processSignature',
  //       Promise.resolve({})
  //     );
  //   });
  //
  //   afterEach(() => {
  //     loggerStub.stubReset();
  //     schemaStub.reset();
  //     transportModuleStub.reset();
  //     sequenceStub.reset();
  //     multisigModuleStub.reset();
  //   });
  //
  //   it('should call instance.getRandomPeer', async () => {
  //     await (instance as any).loadSignatures();
  //     expect(getRandomPeerStub.calledOnce).to.be.true;
  //     expect(getRandomPeerStub.firstCall.args.length).to.be.equal(0);
  //   });
  //
  //   it('should call logger.log', async () => {
  //     await (instance as any).loadSignatures();
  //
  //     expect(loggerStub.stubs.log.calledOnce).to.be.true;
  //     expect(loggerStub.stubs.log.firstCall.args.length).to.be.equal(1);
  //     expect(loggerStub.stubs.log.firstCall.args[0]).to.be.equal(
  //       `Loading signatures from: ${randomPeer.string}`
  //     );
  //   });
  //
  //   it('should call peer.makeRequest', async () => {
  //     await (instance as any).loadSignatures();
  //
  //     expect(randomPeer.makeRequest.calledOnce).to.be.true;
  //     expect(
  //       randomPeer.makeRequest.firstCall.args.length
  //     ).to.be.equal(1);
  //     expect(
  //       randomPeer.makeRequest.firstCall.args[0]
  //     ).to.be.instanceOf(GetSignaturesRequest);
  //     expect(
  //       randomPeer.makeRequest.firstCall.args[0].options
  //     ).to.be.deep.equal({ data: null, });
  //   });
  //
  //   it('should call schema.validate', async () => {
  //     await (instance as any).loadSignatures();
  //
  //     expect(schemaStub.stubs.validate.calledOnce).to.be.true;
  //     expect(schemaStub.stubs.validate.firstCall.args.length).to.be.equal(2);
  //     expect(schemaStub.stubs.validate.firstCall.args[0]).to.be.deep.equal(res);
  //     expect(schemaStub.stubs.validate.firstCall.args[1]).to.be.equal(
  //       loaderSchema.loadSignatures
  //     );
  //   });
  //
  //   it('should throw if validate was failed ', async () => {
  //     schemaStub.reset();
  //     schemaStub.enqueueResponse('validate', false);
  //
  //     await expect((instance as any).loadSignatures()).to.be.rejectedWith(
  //       'Failed to validate /signatures schema'
  //     );
  //   });
  //
  //   it('should call multisigModule.processSignature', async () => {
  //     await (instance as any).loadSignatures();
  //
  //     expect(multisigModuleStub.stubs.processSignature.calledTwice).to.be.true;
  //
  //     expect(
  //       multisigModuleStub.stubs.processSignature.firstCall.args.length
  //     ).to.be.deep.equal(1);
  //     expect(
  //       multisigModuleStub.stubs.processSignature.firstCall.args[0]
  //     ).to.be.deep.equal({
  //       signature: { signature: 'sig11' },
  //       transaction: 'tr11',
  //     });
  //
  //     expect(
  //       multisigModuleStub.stubs.processSignature.secondCall.args.length
  //     ).to.be.deep.equal(1);
  //     expect(
  //       multisigModuleStub.stubs.processSignature.secondCall.args[0]
  //     ).to.be.deep.equal({
  //       signature: { signature: 'sig22' },
  //       transaction: 'tr22',
  //     });
  //   });
  //
  //   it('should call logger.warn if multisigModule.processSignature throw error', async () => {
  //     const error = 'error';
  //
  //     multisigModuleStub.stubs.processSignature.rejects(error);
  //     await (instance as any).loadSignatures();
  //
  //     expect(loggerStub.stubs.warn.calledTwice).to.be.true;
  //
  //     expect(loggerStub.stubs.warn.firstCall.args.length).to.be.equal(2);
  //     expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal(
  //       'Cannot process multisig signature for tr11 '
  //     );
  //     expect(loggerStub.stubs.warn.firstCall.args[1]).to.be.instanceof(Error);
  //     expect(loggerStub.stubs.warn.firstCall.args[1].name).to.be.deep.equal(
  //       error
  //     );
  //
  //     expect(loggerStub.stubs.warn.secondCall.args.length).to.be.equal(2);
  //     expect(loggerStub.stubs.warn.secondCall.args[0]).to.be.equal(
  //       'Cannot process multisig signature for tr22 '
  //     );
  //     expect(loggerStub.stubs.warn.secondCall.args[1]).to.be.instanceof(Error);
  //     expect(loggerStub.stubs.warn.secondCall.args[1].name).to.be.deep.equal(
  //       error
  //     );
  //   });
  // });

  // TODO: lerna move to core-transactions
  // describe('.loadTransactions', () => {
  //   let getRandomPeerStub: SinonStub;
  //   let loggerStub: LoggerStub;
  //   let transportModuleStub: ITransportModule;
  //   let sequenceStub: ISequence;
  //   let transactionLogicStub: ITransactionLogic;
  //   let transactionsModuleStub: ITransactionsModule;
  //   let peersModuleStub: IPeersModule;
  //
  //
  //   let objectNormalizeStub: SinonStub;
  //   let receiveTransactionsStub: SinonStub;
  //   let res;
  //   let peer;
  //   let tx1;
  //   let tx2;
  //
  //   beforeEach(() => {
  //     tx1  = { id: 1 };
  //     tx2  = { id: 2 };
  //     res  = {
  //       transactions: [tx1, tx2],
  //     };
  //     peer = { string: 'string', ip: '127.0.0.uganda', port: 65488, makeRequest: sandbox.stub().resolves(res) };
  //
  //     transactionLogicStub   = container.get(
  //       Symbols.logic.transaction
  //     );
  //     transactionsModuleStub = container.get(
  //       Symbols.modules.transactions
  //     );
  //     peersModuleStub        = container.get(Symbols.modules.peers);
  //     loggerStub             = container.get(Symbols.helpers.logger);
  //     transportModuleStub    = container.get(
  //       Symbols.modules.transport
  //     );
  //     sequenceStub           = container.getNamed(
  //       Symbols.helpers.sequence,
  //       Symbols.names.helpers.balancesSequence
  //     );
  //
  //     getRandomPeerStub = sandbox
  //       .stub(instance as any, 'getRandomPeer')
  //       .resolves(peer);
  //
  //     objectNormalizeStub     = sandbox.stub(transactionLogicStub, 'objectNormalize').returns({});
  //     receiveTransactionsStub = sandbox.stub(transportModuleStub, 'receiveTransactions').returns({});
  //
  //   });
  //
  //   afterEach(() => {
  //     loggerStub.stubReset();
  //   });
  //
  //   it('should call instance.getRandomPeer', async () => {
  //     await (instance as any).loadTransactions();
  //
  //     expect(getRandomPeerStub.calledOnce).to.be.true;
  //     expect(getRandomPeerStub.firstCall.args.length).to.be.equal(0);
  //   });
  //
  //   it('should call logger.log', async () => {
  //     await (instance as any).loadTransactions();
  //
  //     expect(loggerStub.stubs.log.calledOnce).to.be.true;
  //     expect(loggerStub.stubs.log.firstCall.args.length).to.be.equal(1);
  //     expect(loggerStub.stubs.log.firstCall.args[0]).to.be.equal(
  //       `Loading transactions from: ${peer.string}`
  //     );
  //   });
  //
  //   it('should call peer.makeRequest', async () => {
  //     await (instance as any).loadTransactions();
  //
  //     expect(peer.makeRequest.calledOnce).to.be.true;
  //     expect(
  //       peer.makeRequest.firstCall.args.length
  //     ).to.be.equal(1);
  //     expect(
  //       peer.makeRequest.firstCall.args[0]
  //     ).to.be.instanceOf(GetTransactionsRequest);
  //     expect(
  //       peer.makeRequest.firstCall.args[0].options
  //     ).to.be.deep.equal({ data: null, });
  //   });
  //
  //   // it('should call schema.validate', async () => {
  //   //   await (instance as any).loadTransactions();
  //   //
  //   //   expect(schemaStub.stubs.validate.calledOnce).to.be.true;
  //   //   expect(schemaStub.stubs.validate.firstCall.args.length).to.be.equal(2);
  //   //   expect(schemaStub.stubs.validate.firstCall.args[0]).to.be.deep.equal(
  //   //     res
  //   //   );
  //   //   expect(schemaStub.stubs.validate.firstCall.args[1]).to.be.equal(
  //   //     loaderSchema.loadTransactions
  //   //   );
  //   // });
  //   //
  //   // it('should throw if validate was failed ', async () => {
  //   //   schemaStub.reset();
  //   //   schemaStub.enqueueResponse('validate', false);
  //   //
  //   //   await expect((instance as any).loadTransactions()).to.be.rejectedWith(
  //   //     'Cannot validate load transactions schema against peer'
  //   //   );
  //   // });
  //
  //   it('should call transportModule.receiveTransaction for each tx', async () => {
  //     await (instance as any).loadTransactions();
  //
  //     expect(receiveTransactionsStub.calledOnce).to.be
  //       .true;
  //
  //     expect(receiveTransactionsStub.firstCall.args[0]).deep.eq([tx1, tx2]);
  //     expect(receiveTransactionsStub.firstCall.args[1]).deep.eq(peer);
  //     expect(receiveTransactionsStub.firstCall.args[2]).deep.eq(false);
  //   });
  //   it('shoudlnt call transport.receiveTransaction if no transactions were returned', async () => {
  //     peer.makeRequest.resolves({ transactions: [] });
  //
  //     await (instance as any).loadTransactions();
  //
  //     expect(receiveTransactionsStub.calledOnce).to.be
  //       .false;
  //   });
  //
  //   it('should split transactions in groups of 25 ', async () => {
  //     peer.makeRequest.resolves({ transactions: new Array(51).fill(null).map((_, idx) => idx) });
  //
  //     await (instance as any).loadTransactions();
  //
  //     expect(receiveTransactionsStub.calledThrice).to.be.true;
  //     expect(receiveTransactionsStub.firstCall.args[0]).deep.eq([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
  //     expect(receiveTransactionsStub.secondCall.args[0]).deep.eq([25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49]);
  //     expect(receiveTransactionsStub.thirdCall.args[0]).deep.eq([50]);
  //   });
  //   it('should call logger.debug if transportModule.receiveTransaction throw error', async () => {
  //     const error = new Error('error');
  //     peer.makeRequest.resolves(res);
  //     receiveTransactionsStub.rejects(error);
  //
  //     await (instance as any).loadTransactions();
  //
  //     expect(loggerStub.stubs.warn.calledOnce).to.be.true;
  //
  //     expect(loggerStub.stubs.warn.firstCall.args.length).to.be.equal(1);
  //     expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal(error);
  //
  //   });
  // });

  describe('.syncTimer', () => {
    let jobsQueueStub: IJobsQueue;
    let lastReceiptStubs;
    let loggerStub: LoggerStub;
    let syncStub: SinonStub;
    let getAppStateStub: SinonStub;
    let lastReceipt;

    beforeEach(() => {
      lastReceipt = 'lastReceipt';

      lastReceiptStubs = {
        get: sandbox.stub().returns(lastReceipt),
        isStale: sandbox.stub().returns(true),
      };
      jobsQueueStub = container.get(Symbols.helpers.jobsQueue);
      loggerStub = container.get(Symbols.helpers.logger);
      syncStub = sandbox
        .stub(instance as any, 'doSync')
        .resolves(Promise.resolve({}));

      (blocksModule as any).lastReceipt = lastReceiptStubs;

      getAppStateStub = sandbox.stub(appState, 'get');
      getAppStateStub.onFirstCall().returns(true);
      getAppStateStub.onSecondCall().returns(false);
    });

    afterEach(() => {
      loggerStub.stubReset();
    });

    it('should call logger.trace', async () => {
      await (instance as any).syncTimer();

      expect(loggerStub.stubs.trace.calledTwice).to.be.true;

      expect(loggerStub.stubs.trace.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.trace.firstCall.args[0]).to.be.equal(
        'Setting sync timer'
      );

      expect(loggerStub.stubs.trace.secondCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.trace.secondCall.args[0]).to.be.equal(
        'Sync timer trigger'
      );
      expect(loggerStub.stubs.trace.secondCall.args[1]).to.be.deep.equal({
        last_receipt: lastReceipt,
        syncing: true,
      });
    });

    it('should call jobsQueue.register', async () => {
      const jobsQueueRegisterStub = (instance as any).jobsQueue.register;
      await (instance as any).syncTimer();

      expect(jobsQueueRegisterStub.calledOnce).to.be.true;
      expect(jobsQueueRegisterStub.firstCall.args.length).to.be.equal(3);
      expect(jobsQueueRegisterStub.firstCall.args[0]).to.be.equal(
        'loaderSyncTimer'
      );
      expect(jobsQueueRegisterStub.firstCall.args[1]).to.be.a('function');
      expect(jobsQueueRegisterStub.firstCall.args[2]).to.be.equal(1000);
    });

    it('should call blocksModule.lastReceipt.get', async () => {
      await (instance as any).syncTimer();

      expect(lastReceiptStubs.get.calledOnce).to.be.true;
      expect(lastReceiptStubs.get.firstCall.args.length).to.be.equal(0);
    });

    // TODO: lerna
    // it('should call blocksModule.lastReceipt.isStale', async () => {
    //   await (instance as any).syncTimer();
    //
    //   expect(lastReceiptStubs.isStale.calledOnce).to.be.true;
    //   expect(lastReceiptStubs.isStale.firstCall.args.length).to.be.equal(0);
    // });

    it('should call instance.sync', async () => {
      await (instance as any).syncTimer();

      await wait(1000);

      expect(syncStub.calledOnce).to.be.true;
      expect(syncStub.firstCall.args.length).to.be.equal(0);
    });

    it('should not call instance.sync if instance.loaded is false', async () => {
      (instance as any).loaded = false;

      await (instance as any).syncTimer();

      expect(retryStub.notCalled).to.be.true;
    });
  });
});
