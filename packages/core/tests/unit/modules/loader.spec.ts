import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as proxyquire from 'proxyquire';
import * as sequelize from 'sequelize';
import { Op } from 'sequelize';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import * as helpers from '../../../src/helpers';
import { wait } from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { PeerType } from '../../../src/logic';
import { LoaderModule } from '../../../src/modules';
import loaderSchema from '../../../src/schema/loader';
import {
  AccountLogicStub,
  AppStateStub,
  BlocksModuleStub,
  BlocksSubmoduleChainStub,
  BlocksSubmoduleProcessStub,
  BlocksSubmoduleUtilsStub,
  BroadcasterLogicStub,
  BusStub,
  IAppStateStub,
  JobsQueueStub,
  LoggerStub,
  MultisignaturesModuleStub,
  PeersLogicStub,
  PeersModuleStub,
  RoundsLogicStub,
  SequenceStub,
  SocketIOStub,
  SystemModuleStub,
  TransactionLogicStub,
  TransactionsModuleStub,
  TransportModuleStub,
  ZSchemaStub
} from '../../stubs';
import { createContainer } from '../../utils/containerCreator';
import { createFakePeers } from '../../utils/fakePeersFactory';
import { AccountsModel, BlocksModel, RoundsModel } from '../../../src/models';
import { GetSignaturesRequest } from '../../../src/apis/requests/GetSignaturesRequest';
import { GetTransactionsRequest } from '../../../src/apis/requests/GetTransactionsRequest';

chai.use(chaiAsPromised);

let promiseRetryStub: any;

// tslint:disable no-unused-expression
// tslint:disable no-unused-expression max-line-length
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

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
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
    } as any;
    container = createContainer();

    container.rebind(Symbols.generic.appConfig).toConstantValue(appConfig);
    container
      .rebind(Symbols.generic.genesisBlock)
      .toConstantValue(genesisBlock);
    container.rebind(Symbols.helpers.constants).toConstantValue(constants);
    container.rebind(Symbols.modules.loader).to(ProxyLoaderModule.LoaderModule);

    instance = container.get(Symbols.modules.loader);
    (instance as any).jobsQueue.register = sandbox
      .stub()
      .callsFake((val, fn) => fn());
    (instance as any).defaultSequence.addAndPromise = sandbox
      .stub()
      .callsFake((w) => Promise.resolve(w()));
    instance = container.get(Symbols.modules.loader);
    container.get<BlocksModuleStub>(Symbols.modules.blocks).lastBlock = {
      height: 1,
      id: 1,
    } as any;
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
    let peersModuleStub: PeersModuleStub;
    let peersLogicStub: PeersLogicStub;
    let loggerStub: LoggerStub;
    let peers: PeerType[];

    beforeEach(() => {
      peers = createFakePeers(2);
      peers[0].height = 3;

      peersModuleStub = container.get(Symbols.modules.peers);
      peersLogicStub = container.get(Symbols.logic.peers);
      loggerStub = container.get(Symbols.helpers.logger);

      peersLogicStub.stubs.create.callsFake((peer) => peer);
    });

    afterEach(() => {
      peersLogicStub.reset();
      loggerStub.stubReset();
    });

    it('should return unchanged instance.network if (network.height <= 0 and Math.abs(expressive) === 1)', async () => {
      container.get<BlocksModuleStub>(Symbols.modules.blocks).lastBlock = {
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
      peersModuleStub.enqueueResponse('list', { peers });

      await instance.getNetwork();

      expect(peersModuleStub.stubs.list.calledOnce).to.be.true;
    });

    it('should call instance.logger.trace methods', async () => {
      peersModuleStub.enqueueResponse('list', { peers });

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
      peersModuleStub.enqueueResponse('list', { peers });

      await instance.getNetwork();

      expect(loggerStub.stubs.debug.callCount).to.be.equal(1);
      expect(loggerStub.stubs.debug.getCall(0).args.length).to.be.equal(2);
      expect(loggerStub.stubs.debug.getCall(0).args[0]).to.be.equal(
        'Good peers'
      );
      expect(loggerStub.stubs.debug.getCall(0).args[1]).to.be.deep.equal([
        undefined,
        undefined,
      ]);
    });

    it('should call instance peersLogic.create', async () => {
      peersModuleStub.enqueueResponse('list', { peers });

      await instance.getNetwork();
      expect(peersLogicStub.stubs.create.called).to.be.true;
    });

    it('should return instance.network with empty peersArray prop if each of peersModule.list() peers is null', async () => {
      peersModuleStub.enqueueResponse('list', { peers: [null, null] });

      const ret = await instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 0, peers: [] });
      expect((instance as any).network).to.be.deep.equal({
        height: 0,
        peers: [],
      });
    });

    it('should return instance.network with empty peersArray prop if each of peersModule.list() peers has height < lastBlock.height ', async () => {
      container.get<BlocksModuleStub>(
        Symbols.modules.blocks
      ).lastBlock.height = 5;
      peersModuleStub.enqueueResponse('list', { peers });

      const ret = await instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 0, peers: [] });
    });

    it('should return instance.network with two peers in  peersArray prop', async () => {
      peersModuleStub.enqueueResponse('list', { peers });

      const ret = await instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 2, peers });
    });

    it('should return a sorted peersArray', async () => {
      peers[1].height += 3;
      peersModuleStub.enqueueResponse('list', { peers });

      const ret = await instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 4, peers: [peers[1], peers[0]] });
    });

    it('should return instance.network with one item in peersArray(check .findGoodPeers second .filter)', async () => {
      peers[0].height = 10;
      peersModuleStub.enqueueResponse('list', { peers });

      const ret = await instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 10, peers: [peers[0]] });
      expect(peersLogicStub.stubs.create.calledOnce).to.be.true;
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
      await expect(instance.getRandomPeer()).rejectedWith('No acceptable peers for the operation');
    });
  });

  describe('get .isSyncing', () => {
    let appStateStub: AppStateStub;

    beforeEach(() => {
      appStateStub = container.get(Symbols.logic.appState);
    });

    afterEach(() => {
      appStateStub.reset();
    });

    it('should call appState.get', () => {
      appStateStub.enqueueResponse('get', true);
      instance.isSyncing;

      expect(appStateStub.stubs.get.calledOnce).to.true;
    });

    it('should return loader.isSyncing state', () => {
      appStateStub.enqueueResponse('get', true);
      const ret = instance.isSyncing;

      expect(ret).to.be.true;
    });

    it('should return false if appState.get returned undefined', () => {
      appStateStub.enqueueResponse('get', undefined);
      const ret = instance.isSyncing;

      expect(ret).to.be.false;
    });
  });

  describe('.onPeersReady', () => {
    let syncTimerStub: SinonStub;
    let loadTransactionsStub: SinonStub;
    let loadSignaturesStub: SinonStub;
    let loggerStub: LoggerStub;
    let error;

    beforeEach(() => {
      loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);

      loadTransactionsStub = sandbox
        .stub(instance as any, 'loadTransactions')
        .resolves({});
      loadSignaturesStub = sandbox
        .stub(instance as any, 'loadSignatures')
        .resolves({});
      syncTimerStub = sandbox.stub(instance as any, 'syncTimer').resolves();

      error = new Error('error');
      instance.loaded = true;
    });

    afterEach(() => {
      loggerStub.stubReset();
    });

    it('should call instance.syncTimer', async () => {
      await instance.onPeersReady();

      expect(syncTimerStub.calledOnce).to.be.true;
      expect(syncTimerStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call promiseRetry', async () => {
      await instance.onPeersReady();

      expect(promiseRetryStub.calledTwice).to.be.true;

      expect(promiseRetryStub.firstCall.args.length).to.be.equal(2);
      expect(promiseRetryStub.firstCall.args[0]).to.be.a('function');
      expect(promiseRetryStub.firstCall.args[1]).to.be.deep.equal({
        retries: 5,
      });

      expect(promiseRetryStub.secondCall.args.length).to.be.equal(2);
      expect(promiseRetryStub.secondCall.args[0]).to.be.a('function');
      expect(promiseRetryStub.secondCall.args[1]).to.be.deep.equal({
        retries: 5,
      });
    });

    it('should call instance.loadTransaction', async () => {
      await instance.onPeersReady();

      expect(loadTransactionsStub.calledOnce).to.be.true;
      expect(loadTransactionsStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call logger.warn when instance.loadTransactions throw error', async () => {
      loadTransactionsStub.rejects(error);

      await instance.onPeersReady();

      expect(loggerStub.stubs.warn.calledOnce).to.be.true;
      expect(loggerStub.stubs.warn.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal(
        'Error loading transactions... Retrying... '
      );
      expect(loggerStub.stubs.warn.firstCall.args[1]).to.be.equal(error);

      expect(retryStub.calledOnce).to.be.true;
      expect(retryStub.firstCall.args.length).to.be.equal(1);
      expect(retryStub.firstCall.args[0]).to.be.equal(error);
    });

    it('should call logger.log when promiseRetry throw error(twice)', async () => {
      promiseRetryStub.rejects(error);

      await instance.onPeersReady();

      expect(loggerStub.stubs.log.calledTwice).to.be.true;
      expect(loggerStub.stubs.log.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.log.firstCall.args[0]).to.be.equal(
        'Unconfirmed transactions loader error'
      );
      expect(loggerStub.stubs.log.firstCall.args[1]).to.be.equal(error);

      expect(loggerStub.stubs.log.secondCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.log.secondCall.args[0]).to.be.equal(
        'Multisig pending transactions loader error'
      );
      expect(loggerStub.stubs.log.secondCall.args[1]).to.be.equal(error);
    });

    it('should call instance.loadSignature', async () => {
      await instance.onPeersReady();

      expect(loadSignaturesStub.calledOnce).to.be.true;
      expect(loadSignaturesStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call logger.warn when instance.promiseRetry throw error', async () => {
      loadSignaturesStub.rejects(error);

      await instance.onPeersReady();

      expect(loggerStub.stubs.warn.calledOnce).to.be.true;
      expect(loggerStub.stubs.warn.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal(
        'Error loading transactions... Retrying... '
      );
      expect(loggerStub.stubs.warn.firstCall.args[1]).to.be.equal(error);

      expect(retryStub.calledOnce).to.be.true;
      expect(retryStub.firstCall.args.length).to.be.equal(1);
      expect(retryStub.firstCall.args[0]).to.be.equal(error);
    });

    it('should not call instance.loadTransaction if instance.loaded is null', async () => {
      instance.loaded = false;

      await instance.onPeersReady();

      expect(loadTransactionsStub.notCalled).to.be.true;
    });
  });

  describe('.onBlockchainReady', () => {
    it('should set instance.loaded in true', () => {
      instance.onBlockchainReady();

      expect((instance as any).loaded).to.be.true;
    });
  });

  describe('.cleanup', () => {
    it('should set instance.loaded in true and returned a promise.resolve', async () => {
      const ret = instance.cleanup();

      expect((instance as any).loaded).to.be.false;
      expect(ret).to.be.an.instanceof(Promise);
      await ret; // should resolve;
    });
  });

  describe('.loadBlockChain', () => {
    let blocksModel: typeof BlocksModel;
    let loadStub: SinonStub;
    beforeEach(() => {
      blocksModel = container.get(Symbols.models.blocks);
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
        it('should call load if no accounts where updated on last block', async () => {
          accountsCountStub.resolves(0);
          await instance.loadBlockChain();
          expect(loadStub.called).is.true;
          expect(accountsCountStub.firstCall.args[0]).deep.eq({
            where: { blockId: {} },
          });
          expect(
            accountsCountStub.firstCall.args[0].where.blockId[Op.in]
          ).deep.eq({
            val: '(SELECT "id" from blocks ORDER BY "height" DESC LIMIT 1)',
          });
          expect(loadStub.firstCall.args).deep.eq([
            blocksCount,
            10,
            'Detected missed blocks in mem_accounts',
            true,
          ]);
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
              it('should call load if there are some orphanedMemAccounts', async () => {
                sequelizeQueryStub.onSecondCall().resolves(['a']);
                await instance.loadBlockChain();
                expect(loadStub.called).is.true;
                expect(loadStub.firstCall.args).deep.eq([
                  blocksCount,
                  10,
                  'Detected orphaned blocks in mem_accounts',
                  true,
                ]);
                expect(sequelizeQueryStub.secondCall.args[0]).to.be.deep.eq(
                  'SELECT a."blockId", b."id" FROM mem_accounts a LEFT OUTER JOIN blocks b ON b."id" = a."blockId" WHERE a."blockId" IS NOT NULL AND a."blockId" != \'0\' AND b."id" IS NULL'
                );
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
    });
  });

  describe('.load', () => {
    let count;
    let limitPerIteration;
    let message;
    let emitBlockchainReady;

    let loggerStub;
    let busStub: BusStub;
    let accountLogicStub: AccountLogicStub;
    let blocksProcessModuleStub: BlocksSubmoduleProcessStub;
    let blocksChainModuleStub: BlocksSubmoduleChainStub;

    let lastBlock;
    let error;

    beforeEach(() => {
      count = 2;
      limitPerIteration = 3;
      message = 'message';
      emitBlockchainReady = true;
      lastBlock = { data: 'data' };
      error = {
        block: {
          height: 1,
          id: 1,
        }
      };

      loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);
      busStub = container.get<BusStub>(Symbols.helpers.bus);
      accountLogicStub = container.get<AccountLogicStub>(Symbols.logic.account);
      blocksProcessModuleStub = container.get<BlocksSubmoduleProcessStub>(
        Symbols.modules.blocksSubModules.process
      );
      blocksChainModuleStub = container.get<BlocksSubmoduleChainStub>(
        Symbols.modules.blocksSubModules.chain
      );

      accountLogicStub.enqueueResponse('removeTables', Promise.resolve({}));
      accountLogicStub.enqueueResponse('createTables', Promise.resolve({}));
      blocksProcessModuleStub.enqueueResponse(
        'loadBlocksOffset',
        Promise.resolve(lastBlock)
      );
    });

    afterEach(() => {
      busStub.reset();
      accountLogicStub.reset();
      blocksProcessModuleStub.reset();
      blocksChainModuleStub.reset();
      loggerStub.stubReset();
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

    it('should call accountLogic.removeTables', async () => {
      await instance.load(count, limitPerIteration);

      expect(accountLogicStub.stubs.removeTables.calledOnce).to.be.true;
    });

    it('should call accountLogic.createTables', async () => {
      await instance.load(count, limitPerIteration);

      expect(accountLogicStub.stubs.createTables.calledOnce).to.be.true;
    });

    it('should call logger.info count > 1', async () => {
      await instance.load(count, limitPerIteration);

      expect(loggerStub.stubs.info.calledOnce).to.be.true;

      expect(loggerStub.stubs.info.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal(
        'Rebuilding blockchain, current block height: ' + 1
      );
    });

    it('should call blocksProcessModule.loadBlocksOffset', async () => {
      await instance.load(count, limitPerIteration);

      expect(blocksProcessModuleStub.stubs.loadBlocksOffset.calledOnce).to.be
        .true;

      expect(
        blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args.length
      ).to.be.equal(3);
      expect(
        blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args[0]
      ).to.be.equal(3);
      expect(
        blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args[1]
      ).to.be.equal(0);
      expect(
        blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args[2]
      ).to.be.equal(true);
    });

    it('should call logger.info and bus.message if emitBlockchainReady exist', async () => {
      busStub.enqueueResponse('message', '');

      await instance.load(
        count,
        limitPerIteration,
        message,
        emitBlockchainReady
      );

      expect(loggerStub.stubs.info.calledTwice).to.be.true;
      expect(loggerStub.stubs.info.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.secondCall.args[0]).to.be.equal(
        'Blockchain ready'
      );

      expect(busStub.stubs.message.calledOnce).to.be.true;
      expect(busStub.stubs.message.firstCall.args.length).to.be.equal(1);
      expect(busStub.stubs.message.firstCall.args[0]).to.be.equal(
        'blockchainReady'
      );
    });

    it('should not call logger.info if count <= 1', async () => {
      await instance.load(1, limitPerIteration);

      expect(loggerStub.stubs.info.notCalled).to.be.true;
    });

    it('should be no iterations if count less than offset( < 0)', async () => {
      await instance.load(-1, limitPerIteration);

      expect(blocksProcessModuleStub.stubs.loadBlocksOffset.notCalled).to.be
        .true;
    });

    it('should call logger.error if throw error', async () => {
      loggerStub.stubs.info.throws(error);
      busStub.enqueueResponse('message', '');
      blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});

      await instance.load(
        count,
        limitPerIteration,
        message,
        emitBlockchainReady
      );

      expect(loggerStub.stubs.error.called).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.deep.equal(error);
    });

    it('should call logger.error twice if throw error and error.block exist', async () => {
      loggerStub.stubs.info.throws(error);
      busStub.enqueueResponse('message', '');
      blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});

      await instance.load(
        count,
        limitPerIteration,
        message,
        emitBlockchainReady
      );

      expect(loggerStub.stubs.error.calledThrice).to.be.true;
      expect(loggerStub.stubs.error.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.error.secondCall.args[0]).to.be.deep.equal(
        'Blockchain failed at: ' + error.block.height
      );

      expect(loggerStub.stubs.error.thirdCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.error.thirdCall.args[0]).to.be.deep.equal(
        'Blockchain clipped'
      );
    });

    it('should call blocksChainModule.deleteAfterBlock if throw error and error.block exist', async () => {
      loggerStub.stubs.info.throws(error);
      busStub.enqueueResponse('message', '');
      blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});

      await instance.load(
        count,
        limitPerIteration,
        message,
        emitBlockchainReady
      );

      expect(blocksChainModuleStub.stubs.deleteAfterBlock.calledOnce).to.be
        .true;
      expect(
        blocksChainModuleStub.stubs.deleteAfterBlock.firstCall.args.length
      ).to.be.equal(1);
      expect(
        blocksChainModuleStub.stubs.deleteAfterBlock.firstCall.args[0]
      ).to.be.equal(error.block.id);
    });

    it('should call bus.message if throw error and error.block exist', async () => {
      loggerStub.stubs.info.throws(error);
      busStub.enqueueResponse('message', '');
      blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});

      await instance.load(
        count,
        limitPerIteration,
        message,
        emitBlockchainReady
      );

      expect(busStub.stubs.message.calledOnce).to.be.true;
      expect(busStub.stubs.message.firstCall.args.length).to.be.equal(1);
      expect(busStub.stubs.message.firstCall.args[0]).to.be.equal(
        'blockchainReady'
      );
    });

    it('should throw error if throw error in try block and error.block is not exist', async () => {
      delete error.block;
      loggerStub.stubs.info.throws(error);

      await expect(instance.load(count, limitPerIteration)).to.be.rejectedWith(
        error
      );
    });
  });

  describe('.sync', () => {
    let busStub: BusStub;
    let transactionsModuleStub: TransactionsModuleStub;
    let broadcasterLogicStub: BroadcasterLogicStub;
    let systemModuleStub: SystemModuleStub;
    let loggerStub: LoggerStub;
    let syncTriggerStub: SinonStub;
    let loadBlocksFromNetworkStub: SinonStub;

    beforeEach(() => {
      syncTriggerStub = sandbox.stub(instance as any, 'syncTrigger');
      loadBlocksFromNetworkStub = sandbox.stub(
        instance as any,
        'loadBlocksFromNetwork'
      );

      busStub = container.get<BusStub>(Symbols.helpers.bus);
      transactionsModuleStub = container.get<TransactionsModuleStub>(
        Symbols.modules.transactions
      );
      broadcasterLogicStub = container.get<BroadcasterLogicStub>(
        Symbols.logic.broadcaster
      );
      systemModuleStub = container.get<SystemModuleStub>(
        Symbols.modules.system
      );
      loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);

      busStub.enqueueResponse('message', Promise.resolve());
      busStub.enqueueResponse('message', Promise.resolve());
      broadcasterLogicStub.enqueueResponse('getPeers', Promise.resolve());
      broadcasterLogicStub.enqueueResponse('getPeers', Promise.resolve());
      systemModuleStub.enqueueResponse('update', Promise.resolve());
    });

    afterEach(() => {
      loggerStub.stubReset();
      busStub.reset();
      transactionsModuleStub.reset();
      broadcasterLogicStub.reset();
      systemModuleStub.reset();
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

    it('call bus\'s methods', async () => {
      await (instance as any).sync();

      expect(busStub.stubs.message.calledTwice).to.be.true;

      expect(busStub.stubs.message.firstCall.args.length).to.be.equal(1);
      expect(busStub.stubs.message.firstCall.args[0]).to.be.equal(
        'syncStarted'
      );

      expect(busStub.stubs.message.secondCall.args.length).to.be.equal(1);
      expect(busStub.stubs.message.secondCall.args[0]).to.be.equal(
        'syncFinished'
      );
    });

    it('call broadcasterLogic methods', async () => {
      await (instance as any).sync();

      expect(broadcasterLogicStub.stubs.getPeers.calledTwice).to.be.true;

      expect(
        broadcasterLogicStub.stubs.getPeers.firstCall.args.length
      ).to.be.equal(1);
      expect(
        broadcasterLogicStub.stubs.getPeers.firstCall.args[0]
      ).to.be.deep.equal({ limit: constants.maxPeers });

      expect(
        broadcasterLogicStub.stubs.getPeers.secondCall.args.length
      ).to.be.equal(1);
      expect(
        broadcasterLogicStub.stubs.getPeers.secondCall.args[0]
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
    let blocksProcessModuleStub: BlocksSubmoduleProcessStub;
    let blocksModuleStub: BlocksModuleStub;

    let randomPeer;
    let lastValidBlock;
    let isStaleStub: SinonStub;

    beforeEach(() => {
      randomPeer = { string: 'string', height: 2 };
      lastValidBlock = { height: 1, id: 1, timestamp: 0 } as any;

      blocksModuleStub = container.get<BlocksModuleStub>(
        Symbols.modules.blocks
      );
      loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);
      blocksProcessModuleStub = container.get<BlocksSubmoduleProcessStub>(
        Symbols.modules.blocksSubModules.process
      );

      getRandomPeerStub = sandbox
        .stub(instance as any, 'getRandomPeer')
        .resolves(randomPeer);
      blocksProcessModuleStub.enqueueResponse(
        'loadBlocksFromPeer',
        Promise.resolve(lastValidBlock)
      );
      blocksModuleStub.lastReceipt.isStale = () => false;

      isStaleStub = blocksModuleStub.sandbox.stub(blocksModuleStub.lastReceipt, 'isStale').returns(false);
    });

    afterEach(() => {
      loggerStub.stubReset();
      blocksProcessModuleStub.reset();
      blocksModuleStub.sandbox.resetHistory();
    });

    it('should call promiseRetry', async () => {
      await (instance as any).loadBlocksFromNetwork();

      expect(promiseRetryStub.calledOnce).to.be.true;
      expect(promiseRetryStub.firstCall.args.length).to.be.equal(2);
      expect(promiseRetryStub.firstCall.args[0]).to.be.a('function');
      expect(promiseRetryStub.firstCall.args[1]).to.be.deep.eq({ retries: 3, maxTimeout: 2000 });
    });

    it('should call wait if typeof(randomPeer) === undefined', async () => {
      getRandomPeerStub.onCall(0).resolves(undefined);
      getRandomPeerStub.onCall(1).resolves(randomPeer);
      const waitStub = sandbox.stub(helpers, 'wait');

      await (instance as any).loadBlocksFromNetwork();

      expect(getRandomPeerStub.calledTwice).to.be.true;

      expect(waitStub.calledOnce).to.be.true;
      expect(waitStub.firstCall.args.length).to.be.equal(1);
      expect(waitStub.firstCall.args[0]).to.be.equal(1000);
    });

    describe('lastBlock.height !== 1', () => {
      let commonBlock;

      beforeEach(() => {
        commonBlock = {};

        promiseRetryStub.onCall(0).callsFake(
          sandbox.spy((w) => {
            container.get<BlocksModuleStub>(
              Symbols.modules.blocks
            ).lastBlock = { height: 2, id: 1 } as any;
            return Promise.resolve(w(retryStub));
          })
        );

        // second call for set the lastBlock.height in 1 for cycle finish
        promiseRetryStub.onCall(1).callsFake(
          sandbox.spy((w) => {
            container.get<BlocksModuleStub>(
              Symbols.modules.blocks
            ).lastBlock = { height: 1, id: 1 } as any;
            return Promise.resolve(w(retryStub));
          })
        );
      });

      it('should call logger.info', async () => {
        blocksProcessModuleStub.enqueueResponse(
          'getCommonBlock',
          Promise.resolve(commonBlock)
        );

        await (instance as any).loadBlocksFromNetwork();

        expect(loggerStub.stubs.info.calledOnce).to.be.true;
        expect(loggerStub.stubs.info.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal(
          'Looking for common block with: string'
        );
      });

      it('should call blocksProcessModule.getCommonBlock', async () => {
        blocksProcessModuleStub.enqueueResponse(
          'getCommonBlock',
          Promise.resolve(commonBlock)
        );

        await (instance as any).loadBlocksFromNetwork();

        expect(blocksProcessModuleStub.stubs.getCommonBlock.calledOnce).to.be
          .true;
        expect(
          blocksProcessModuleStub.stubs.getCommonBlock.firstCall.args.length
        ).to.be.equal(2);
        expect(
          blocksProcessModuleStub.stubs.getCommonBlock.firstCall.args[0]
        ).to.be.deep.equal(randomPeer);
        expect(
          blocksProcessModuleStub.stubs.getCommonBlock.firstCall.args[1]
        ).to.be.equal(2);
      });

      it('should call logger.error and return after if commonBlock is null', async () => {
        blocksProcessModuleStub.enqueueResponse('getCommonBlock', null);

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
        blocksProcessModuleStub.enqueueResponse(
          'getCommonBlock',
          Promise.reject(error)
        );

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

      expect(blocksProcessModuleStub.stubs.loadBlocksFromPeer.calledOnce).to.be
        .true;
      expect(
        blocksProcessModuleStub.stubs.loadBlocksFromPeer.firstCall.args.length
      ).to.be.equal(1);
      expect(
        blocksProcessModuleStub.stubs.loadBlocksFromPeer.firstCall.args[0]
      ).to.be.equal(randomPeer);
    });

    it('should call blocksModule.lastReceipt.update', async () => {
      await (instance as any).loadBlocksFromNetwork();

      expect(blocksModuleStub.spies.lastReceipt.update.calledOnce).to.be.true;
      expect(
        blocksModuleStub.spies.lastReceipt.update.firstCall.args.length
      ).to.be.equal(1);
      expect(
        blocksModuleStub.spies.lastReceipt.update.firstCall.args[0]
      ).to.be.equal(1);
    });

    it('should call logger.error twice and return after if blocksProcessModule.loadBlocksFromPeer thro error', async () => {
      const error = new Error('error');
      blocksProcessModuleStub.reset();
      blocksProcessModuleStub.enqueueResponse(
        'loadBlocksFromPeer',
        Promise.reject(error)
      );
      blocksProcessModuleStub.enqueueResponse(
        'loadBlocksFromPeer',
        Promise.resolve(lastValidBlock)
      );

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
      blocksProcessModuleStub.reset();
      blocksProcessModuleStub.enqueueResponse(
        'loadBlocksFromPeer',
        Promise.resolve({
          height: 1,
          id: 12,
          timestamp: 0,
        } as any)
      );
      blocksProcessModuleStub.enqueueResponse(
        'loadBlocksFromPeer',
        Promise.resolve(lastValidBlock)
      );

      await (instance as any).loadBlocksFromNetwork();

      expect(blocksProcessModuleStub.stubs.loadBlocksFromPeer.calledTwice).to.be
        .true;
    });
    it('should not iterate forever if loadBlocksFromPeer throws', async function() {
      this.timeout(10000);

      container.rebind(Symbols.modules.loader).to(LoaderModule);
      instance = container.get(Symbols.modules.loader);
      sandbox
        .stub(instance as any, 'getRandomPeer')
        .resolves(randomPeer);
      blocksProcessModuleStub.reset();
      // 3 retries + first
      for (let i = 0; i < 4; i++) {
        blocksProcessModuleStub.stubs.loadBlocksFromPeer
          .onCall(i)
          .rejects(new Error(`${i}`));
      }
      await wait(1000);
      await (instance as any).loadBlocksFromNetwork();

      expect(blocksProcessModuleStub.stubs.loadBlocksFromPeer.callCount).eq(4);
    });
  });

  describe('.loadSignatures', () => {
    let getRandomPeerStub: SinonStub;
    let loggerStub: LoggerStub;
    let transportModuleStub: TransportModuleStub;
    let schemaStub: ZSchemaStub;
    let sequenceStub: SequenceStub;
    let multisigModuleStub: MultisignaturesModuleStub;

    let res;
    let randomPeer;

    beforeEach(() => {
      randomPeer = { string: 'string', makeRequest: sandbox.stub()};
      res = {
          signatures: [
            {
              signatures: [
                {
                  signature: 'sig11',
                },
              ],
              transaction: 'tr11',
            },
            {
              signatures: [
                {
                  signature: 'sig22',
                },
              ],
              transaction: 'tr22',
            },
          ],
      };
      randomPeer.makeRequest.resolves(res);

      loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);
      transportModuleStub = container.get<TransportModuleStub>(
        Symbols.modules.transport
      );
      schemaStub = container.get<ZSchemaStub>(Symbols.generic.zschema);
      sequenceStub = container.getTagged<SequenceStub>(
        Symbols.helpers.sequence,
        Symbols.helpers.sequence,
        Symbols.tags.helpers.defaultSequence
      );
      multisigModuleStub = container.get<MultisignaturesModuleStub>(
        Symbols.modules.multisignatures
      );

      getRandomPeerStub = sandbox
        .stub(instance as any, 'getRandomPeer')
        .resolves(randomPeer);
      transportModuleStub.enqueueResponse('getFromPeer', res);
      multisigModuleStub.enqueueResponse(
        'processSignature',
        Promise.resolve({})
      );
      multisigModuleStub.enqueueResponse(
        'processSignature',
        Promise.resolve({})
      );
    });

    afterEach(() => {
      loggerStub.stubReset();
      schemaStub.reset();
      transportModuleStub.reset();
      sequenceStub.reset();
      multisigModuleStub.reset();
    });

    it('should call instance.getRandomPeer', async () => {
      await (instance as any).loadSignatures();
      expect(getRandomPeerStub.calledOnce).to.be.true;
      expect(getRandomPeerStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call logger.log', async () => {
      await (instance as any).loadSignatures();

      expect(loggerStub.stubs.log.calledOnce).to.be.true;
      expect(loggerStub.stubs.log.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.log.firstCall.args[0]).to.be.equal(
        `Loading signatures from: ${randomPeer.string}`
      );
    });

    it('should call peer.makeRequest', async () => {
      await (instance as any).loadSignatures();

      expect(randomPeer.makeRequest.calledOnce).to.be.true;
      expect(
        randomPeer.makeRequest.firstCall.args.length
      ).to.be.equal(1);
      expect(
        randomPeer.makeRequest.firstCall.args[0]
      ).to.be.instanceOf(GetSignaturesRequest);
      expect(
        randomPeer.makeRequest.firstCall.args[0].options
      ).to.be.deep.equal({ data: null, });
    });

    it('should call schema.validate', async () => {
      await (instance as any).loadSignatures();

      expect(schemaStub.stubs.validate.calledOnce).to.be.true;
      expect(schemaStub.stubs.validate.firstCall.args.length).to.be.equal(2);
      expect(schemaStub.stubs.validate.firstCall.args[0]).to.be.deep.equal(res);
      expect(schemaStub.stubs.validate.firstCall.args[1]).to.be.equal(
        loaderSchema.loadSignatures
      );
    });

    it('should throw if validate was failed ', async () => {
      schemaStub.reset();
      schemaStub.enqueueResponse('validate', false);

      await expect((instance as any).loadSignatures()).to.be.rejectedWith(
        'Failed to validate /signatures schema'
      );
    });

    it('should call multisigModule.processSignature', async () => {
      await (instance as any).loadSignatures();

      expect(multisigModuleStub.stubs.processSignature.calledTwice).to.be.true;

      expect(
        multisigModuleStub.stubs.processSignature.firstCall.args.length
      ).to.be.deep.equal(1);
      expect(
        multisigModuleStub.stubs.processSignature.firstCall.args[0]
      ).to.be.deep.equal({
        signature: { signature: 'sig11' },
        transaction: 'tr11',
      });

      expect(
        multisigModuleStub.stubs.processSignature.secondCall.args.length
      ).to.be.deep.equal(1);
      expect(
        multisigModuleStub.stubs.processSignature.secondCall.args[0]
      ).to.be.deep.equal({
        signature: { signature: 'sig22' },
        transaction: 'tr22',
      });
    });

    it('should call logger.warn if multisigModule.processSignature throw error', async () => {
      const error = 'error';

      multisigModuleStub.stubs.processSignature.rejects(error);
      await (instance as any).loadSignatures();

      expect(loggerStub.stubs.warn.calledTwice).to.be.true;

      expect(loggerStub.stubs.warn.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal(
        'Cannot process multisig signature for tr11 '
      );
      expect(loggerStub.stubs.warn.firstCall.args[1]).to.be.instanceof(Error);
      expect(loggerStub.stubs.warn.firstCall.args[1].name).to.be.deep.equal(
        error
      );

      expect(loggerStub.stubs.warn.secondCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.warn.secondCall.args[0]).to.be.equal(
        'Cannot process multisig signature for tr22 '
      );
      expect(loggerStub.stubs.warn.secondCall.args[1]).to.be.instanceof(Error);
      expect(loggerStub.stubs.warn.secondCall.args[1].name).to.be.deep.equal(
        error
      );
    });
  });

  describe('.loadTransactions', () => {
    let getRandomPeerStub: SinonStub;
    let loggerStub: LoggerStub;
    let transportModuleStub: TransportModuleStub;
    let schemaStub: ZSchemaStub;
    let sequenceStub: SequenceStub;
    let transactionLogicStub: TransactionLogicStub;
    let transactionsModuleStub: TransactionsModuleStub;
    let peersModuleStub: PeersModuleStub;

    let res;
    let peer;
    let tx1;
    let tx2;

    beforeEach(() => {
      tx1 = { id: 1 };
      tx2 = { id: 2 };
      res = {
          transactions: [tx1, tx2],
      };
      peer = { string: 'string', ip: '127.0.0.uganda', port: 65488, makeRequest: sandbox.stub().resolves(res) };

      transactionLogicStub = container.get<TransactionLogicStub>(
        Symbols.logic.transaction
      );
      transactionsModuleStub = container.get<TransactionsModuleStub>(
        Symbols.modules.transactions
      );
      peersModuleStub = container.get<PeersModuleStub>(Symbols.modules.peers);
      loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);
      transportModuleStub = container.get<TransportModuleStub>(
        Symbols.modules.transport
      );
      schemaStub = container.get<ZSchemaStub>(Symbols.generic.zschema);
      sequenceStub = container.getTagged<SequenceStub>(
        Symbols.helpers.sequence,
        Symbols.helpers.sequence,
        Symbols.tags.helpers.balancesSequence
      );

      getRandomPeerStub = sandbox
        .stub(instance as any, 'getRandomPeer')
        .resolves(peer);
      transactionLogicStub.enqueueResponse('objectNormalize', {});
      transactionLogicStub.enqueueResponse('objectNormalize', {});

      transportModuleStub.enqueueResponse('receiveTransactions', {});
    });

    afterEach(() => {
      transactionLogicStub.reset();
      transactionsModuleStub.reset();
      peersModuleStub.reset();
      loggerStub.stubReset();
      schemaStub.reset();
      transportModuleStub.reset();
      sequenceStub.reset();
    });

    it('should call instance.getRandomPeer', async () => {
      await (instance as any).loadTransactions();

      expect(getRandomPeerStub.calledOnce).to.be.true;
      expect(getRandomPeerStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call logger.log', async () => {
      await (instance as any).loadTransactions();

      expect(loggerStub.stubs.log.calledOnce).to.be.true;
      expect(loggerStub.stubs.log.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.log.firstCall.args[0]).to.be.equal(
        `Loading transactions from: ${peer.string}`
      );
    });

    it('should call peer.makeRequest', async () => {
      await (instance as any).loadTransactions();

      expect(peer.makeRequest.calledOnce).to.be.true;
      expect(
        peer.makeRequest.firstCall.args.length
      ).to.be.equal(1);
      expect(
        peer.makeRequest.firstCall.args[0]
      ).to.be.instanceOf(GetTransactionsRequest);
      expect(
        peer.makeRequest.firstCall.args[0].options
      ).to.be.deep.equal({ data: null, });
    });

    it('should call schema.validate', async () => {
      await (instance as any).loadTransactions();

      expect(schemaStub.stubs.validate.calledOnce).to.be.true;
      expect(schemaStub.stubs.validate.firstCall.args.length).to.be.equal(2);
      expect(schemaStub.stubs.validate.firstCall.args[0]).to.be.deep.equal(
        res
      );
      expect(schemaStub.stubs.validate.firstCall.args[1]).to.be.equal(
        loaderSchema.loadTransactions
      );
    });

    it('should throw if validate was failed ', async () => {
      schemaStub.reset();
      schemaStub.enqueueResponse('validate', false);

      await expect((instance as any).loadTransactions()).to.be.rejectedWith(
        'Cannot validate load transactions schema against peer'
      );
    });

    it('should call transportModule.receiveTransaction for each tx', async () => {
      await (instance as any).loadTransactions();

      expect(transportModuleStub.stubs.receiveTransactions.calledOnce).to.be
        .true;

      expect(transportModuleStub.stubs.receiveTransactions.firstCall.args[0]).deep.eq([tx1, tx2]);
      expect(transportModuleStub.stubs.receiveTransactions.firstCall.args[1]).deep.eq(peer);
      expect(transportModuleStub.stubs.receiveTransactions.firstCall.args[2]).deep.eq(false);
    });
    it('shoudlnt call transport.receiveTransaction if no transactions were returned', async () => {
      peer.makeRequest.resolves({ transactions: [] });

      await (instance as any).loadTransactions();

      expect(transportModuleStub.stubs.receiveTransactions.calledOnce).to.be
        .false;
    });

    it('should split transactions in groups of 25 ', async () => {
      peer.makeRequest.resolves({ transactions: new Array(51).fill(null).map((_, idx) => idx) });

      await (instance as any).loadTransactions();

      expect(transportModuleStub.stubs.receiveTransactions.calledThrice).to.be.true;
      expect(transportModuleStub.stubs.receiveTransactions.firstCall.args[0]).deep.eq([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
      expect(transportModuleStub.stubs.receiveTransactions.secondCall.args[0]).deep.eq([25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49]);
      expect(transportModuleStub.stubs.receiveTransactions.thirdCall.args[0]).deep.eq([50]);
    });
    it('should call logger.debug if transportModule.receiveTransaction throw error', async () => {
      const error = new Error('error');
      transportModuleStub.reset();
      peer.makeRequest.resolves(res);
      transportModuleStub.stubs.receiveTransactions.rejects(error);

      await (instance as any).loadTransactions();

      expect(loggerStub.stubs.warn.calledOnce).to.be.true;

      expect(loggerStub.stubs.warn.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal(error);

    });
  });

  describe('.syncTrigger', () => {
    let loggerStub: LoggerStub;
    let appStateStub: AppStateStub;
    let socketIoStub: SocketIOStub;
    let inst: LoaderModule;

    beforeEach(() => {
      inst = new LoaderModule();
      appStateStub = new AppStateStub();
      loggerStub = new LoggerStub();
      socketIoStub = new SocketIOStub();

      (inst as any).appState = appStateStub;
      (inst as any).logger = loggerStub;
      (inst as any).io = socketIoStub;
      (inst as any).blocksModule = { lastBlock: { height: 1 } };

      appStateStub.enqueueResponse('set', {});
    });

    afterEach(() => {
      loggerStub.stubReset();
      socketIoStub.stubReset();
      appStateStub.reset();
      (inst as any).syncIntervalId = null;
    });

    describe('if turnOn==false && this.syncIntervalId', () => {
      let syncIntervalId: NodeJS.Timer;

      beforeEach(() => {
        syncIntervalId = {
          ref: () => void 0,
          unref: () => void 0,
        };
        (inst as any).syncIntervalId = syncIntervalId;
      });

      it('should call logger.trace', () => {
        (inst as any).syncTrigger(false);

        expect(loggerStub.stubs.trace.calledOnce).to.be.true;
        expect(loggerStub.stubs.trace.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.trace.firstCall.args[0]).to.be.equal(
          'Clearing sync interval'
        );

        expect((inst as any).syncIntervalId).to.be.null;
      });

      it('should call appState.set', async () => {
        (inst as any).syncTrigger(false);

        expect(appStateStub.stubs.set.calledOnce).to.be.true;
        expect(appStateStub.stubs.set.firstCall.args.length).to.be.equal(2);
        expect(appStateStub.stubs.set.firstCall.args[0]).to.be.equal(
          'loader.isSyncing'
        );
        expect(appStateStub.stubs.set.firstCall.args[1]).to.be.equal(false);
      });
    });

    describe('turnOn === true && !this.syncIntervalId', () => {
      it('should call logger.trace', () => {
        (inst as any).syncTrigger(true);

        expect(loggerStub.stubs.trace.calledOnce).to.be.true;
        expect(loggerStub.stubs.trace.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.trace.firstCall.args[0]).to.be.equal(
          'Setting sync interval'
        );
      });

      it('should call appState.set', async () => {
        (inst as any).syncTrigger(true);

        expect(appStateStub.stubs.set.calledOnce).to.be.true;
        expect(appStateStub.stubs.set.firstCall.args.length).to.be.equal(2);
        expect(appStateStub.stubs.set.firstCall.args[0]).to.be.equal(
          'loader.isSyncing'
        );
        expect(appStateStub.stubs.set.firstCall.args[1]).to.be.equal(true);
      });

      it('should call setTimeout\'s callback', () => {
        const timers = sinon.useFakeTimers(Date.now());

        (inst as any).syncTrigger(true);

        expect(loggerStub.stubs.trace.calledWith('Sync trigger')).to.be.false;

        timers.tick(1000);

        expect(loggerStub.stubs.trace.calledWith('Sync trigger')).to.be.true;
        timers.restore();
      });
    });

    it('check if turnOn === false && !this.syncIntervalId', () => {
      (inst as any).syncTrigger(false);

      expect(loggerStub.stubs.trace.notCalled).to.be.true;
    });

    it('check if turnOn === true && this.syncIntervalId', () => {
      (inst as any).syncIntervalId = {
        ref: () => void 0,
        unref: () => void 0,
      };

      (inst as any).syncTrigger(true);

      expect(loggerStub.stubs.trace.notCalled).to.be.true;
    });
  });

  describe('.syncTimer', () => {
    let jobsQueueStub: JobsQueueStub;
    let lastReceiptStubs;
    let loggerStub: LoggerStub;
    let appState: IAppStateStub;
    let syncStub: SinonStub;

    let lastReceipt;

    beforeEach(() => {
      lastReceipt = 'lastReceipt';

      lastReceiptStubs = {
        get: sandbox.stub().returns(lastReceipt),
        isStale: sandbox.stub().returns(true),
      };
      jobsQueueStub = container.get<JobsQueueStub>(Symbols.helpers.jobsQueue);
      loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);
      appState = container.get<IAppStateStub>(Symbols.logic.appState);
      syncStub = sandbox
        .stub(instance as any, 'sync')
        .resolves(Promise.resolve({}));

      (container.get<BlocksModuleStub>(
        Symbols.modules.blocks
      ) as any).lastReceipt = lastReceiptStubs;

      appState.enqueueResponse('get', true);
      appState.enqueueResponse('get', false);

      (instance as any).loaded = true;
    });

    afterEach(() => {
      appState.reset();
      loggerStub.stubReset();
      jobsQueueStub.reset();
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
        loaded: true,
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

    it('should call blocksModule.lastReceipt.isStale', async () => {
      await (instance as any).syncTimer();

      expect(lastReceiptStubs.isStale.calledOnce).to.be.true;
      expect(lastReceiptStubs.isStale.firstCall.args.length).to.be.equal(0);
    });

    it('should call instance.sync', async () => {
      await (instance as any).syncTimer();

      process.nextTick(() => {
        expect(syncStub.calledOnce).to.be.true;
        expect(syncStub.firstCall.args.length).to.be.equal(0);
      });
    });

    it('should call logger.warn if instance.sync throw error', async () => {
      syncStub.rejects({});

      await (instance as any).syncTimer();

      process.nextTick(() => {
        expect(retryStub.calledOnce).to.be.true;
        expect(loggerStub.stubs.warn.calledOnce).to.be.true;
      });
    });

    it('should not call instance.sync if instance.loaded is false', async () => {
      (instance as any).loaded = false;

      await (instance as any).syncTimer();

      expect(retryStub.notCalled).to.be.true;
    });

    it('should not call instance.synTc if !instance.isSyncing is false', async () => {
      appState.reset();
      appState.enqueueResponse('get', true);
      appState.enqueueResponse('get', true);

      await (instance as any).syncTimer();

      expect(syncStub.notCalled).to.be.true;
    });

    it('should not call instance.sync if blocksModule.lastReceipt.isStale return false', async () => {
      lastReceiptStubs.isStale.returns(false);

      await (instance as any).syncTimer();

      expect(syncStub.notCalled).to.be.true;
    });
  });

});
