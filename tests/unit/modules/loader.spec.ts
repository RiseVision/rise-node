import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { Symbols } from '../../../src/ioc/symbols';
import { LoaderModule } from '../../../src/modules';
import {
  AccountLogicStub,
  BlocksSubmoduleChainStub,
  BlocksSubmoduleUtilsStub,
  BlocksSubmoduleVerifyStub,
  BroadcasterLogicStub,
  BusStub,
  DbStub,
  IAppStateStub,
  IBlocksStub,
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

import { PeerType } from '../../../src/logic';
import loaderSchema from '../../../src/schema/loader';
import { BlocksSubmoduleProcessStub } from '../../stubs/modules/blocks/BlocksSubmoduleProcessStub';
import { createFakePeers } from '../../utils/fakePeersFactory';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
// tslint:disable no-unused-expression max-line-length
// tslint:disable no-unused-expression object-literal-sort-keys

const LoaderModuleRewire = rewire('../../../src/modules/loader');

describe('modules/loader', () => {

  let instance: LoaderModule;
  let container: Container;
  let sandbox: SinonSandbox;
  let constants    = {
    activeDelegates: 1,
    epochTime      : new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
    maxPeers       : 100,
  } as any;
  let appConfig    = {
    loading: {
      loadPerIteration: 10,
      snapshot        : false,
    },
  };
  let genesisBlock = {
    id            : 10,
    blockSignature: Buffer.from('10').toString('hex'),
    payloadHash   : Buffer.from('10').toString('hex'),

  };

  before(() => {
    container = new Container();

    // Generic
    container.bind(Symbols.generic.appConfig).toConstantValue(appConfig);
    container.bind(Symbols.generic.db).to(DbStub).inSingletonScope();
    container.bind(Symbols.generic.genesisBlock).toConstantValue(genesisBlock);
    container.bind(Symbols.generic.socketIO).to(SocketIOStub).inSingletonScope();

    // Helpers
    container.bind(Symbols.helpers.sequence)
      .to(SequenceStub)
      .whenTargetTagged(Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence);
    container.bind(Symbols.helpers.bus).to(BusStub).inSingletonScope();
    container.bind(Symbols.helpers.constants).toConstantValue(constants);
    container.bind(Symbols.helpers.jobsQueue).to(JobsQueueStub).inSingletonScope();
    container.bind(Symbols.helpers.logger).to(LoggerStub).inSingletonScope();
    container.bind(Symbols.helpers.sequence)
      .to(SequenceStub)
      .whenTargetTagged(Symbols.helpers.sequence, Symbols.tags.helpers.defaultSequence);
    container.bind(Symbols.generic.zschema).to(ZSchemaStub).inSingletonScope();

    // Logic
    container.bind(Symbols.logic.account).to(AccountLogicStub).inSingletonScope();
    container.bind(Symbols.logic.appState).to(IAppStateStub).inSingletonScope();
    container.bind(Symbols.logic.broadcaster).to(BroadcasterLogicStub).inSingletonScope();
    container.bind(Symbols.logic.peers).to(PeersLogicStub).inSingletonScope();
    container.bind(Symbols.logic.transaction).to(TransactionLogicStub).inSingletonScope();
    container.bind(Symbols.logic.rounds).to(RoundsLogicStub).inSingletonScope();

    // Modules
    container.bind(Symbols.modules.blocks).to(IBlocksStub).inSingletonScope();
    container.bind(Symbols.modules.blocksSubModules.chain).to(BlocksSubmoduleChainStub).inSingletonScope();
    container.bind(Symbols.modules.blocksSubModules.process).to(BlocksSubmoduleProcessStub).inSingletonScope();
    container.bind(Symbols.modules.blocksSubModules.utils).to(BlocksSubmoduleUtilsStub).inSingletonScope();
    container.bind(Symbols.modules.blocksSubModules.verify).to(BlocksSubmoduleVerifyStub).inSingletonScope();
    container.bind(Symbols.modules.multisignatures).to(MultisignaturesModuleStub).inSingletonScope();
    container.bind(Symbols.modules.peers).to(PeersModuleStub).inSingletonScope();
    container.bind(Symbols.modules.system).to(SystemModuleStub).inSingletonScope();
    container.bind(Symbols.modules.transactions).to(TransactionsModuleStub).inSingletonScope();
    container.bind(Symbols.modules.transport).to(TransportModuleStub).inSingletonScope();

    container.bind(Symbols.modules.loader).to(LoaderModule);
  });

  beforeEach(() => {
    sandbox  = sinon.sandbox.create();
    instance = container.get(Symbols.modules.loader);

    container.get<IBlocksStub>(Symbols.modules.blocks).lastBlock = { height: 1 } as any;
  });

  afterEach(() => {
    constants    = {
      activeDelegates: 1,
      epochTime      : new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
      maxPeers       : 100,
    } as any;
    appConfig    = {
      loading: {
        loadPerIteration: 10,
        snapshot        : false,
      },
    };
    genesisBlock = {
      blockSignature: Buffer.from('10').toString('hex'),
      id            : 10,
      payloadHash   : Buffer.from('10').toString('hex'),
    };
    sandbox.restore();
  });

  describe('.initialize', () => {

    it('should set instance.network to default value after the creation of the object', () => {
      expect((instance as any).network).to.be.deep.equal({
        height: 0,
        peers : [],
      });
    });

  });

  describe('.getNework', () => {

    let peersModuleStub;
    let peersLogicStub;
    let peers: PeerType[];
    let loggerStub: LoggerStub;

    beforeEach(() => {
      peers           = createFakePeers(2);
      peers[0].height = 3;

      peersModuleStub = container.get(Symbols.modules.peers);
      peersLogicStub  = container.get(Symbols.logic.peers);
      loggerStub      = container.get(Symbols.helpers.logger);

      peersLogicStub.reset();
      loggerStub.stubReset();

      peersLogicStub.stubs.create.callsFake((peer) => peer);
    });

    it('should return unchanged instance.network if (network.height <= 0 and Math.abs(expressive) === 1)', async () => {
      container.get<IBlocksStub>(Symbols.modules.blocks).lastBlock = { height: 0 } as any;
      (instance as any).network                                    = {
        height: 1,
        peers : [],
      };

      const result = await instance.getNework();

      expect(result).to.be.deep.equal({ height: 1, peers: [] });
    });

    it('should call instance.peersModule.list if instance.network.height > 0', async () => {
      (instance as any).network = {
        height: 1,
        peers : [],
      };
      peersModuleStub.enqueueResponse('list', { peers });

      await instance.getNework();

      expect(peersModuleStub.stubs.list.calledOnce).to.be.true;
    });

    it('should call instance.logger.trace methods', async () => {
      peersModuleStub.enqueueResponse('list', { peers });

      await instance.getNework();

      expect(loggerStub.stubs.trace.callCount).to.be.equal(3);

      expect(loggerStub.stubs.trace.getCall(0).args.length).to.be.equal(2);
      expect(loggerStub.stubs.trace.getCall(0).args[0]).to.be.equal('Good peers - received');
      expect(loggerStub.stubs.trace.getCall(0).args[1]).to.be.deep.equal({ count: peers.length });

      expect(loggerStub.stubs.trace.getCall(1).args.length).to.be.equal(2);
      expect(loggerStub.stubs.trace.getCall(1).args[0]).to.be.equal('Good peers - filtered');
      expect(loggerStub.stubs.trace.getCall(1).args[1]).to.be.deep.equal({ count: peers.length });

      expect(loggerStub.stubs.trace.getCall(2).args.length).to.be.equal(2);
      expect(loggerStub.stubs.trace.getCall(2).args[0]).to.be.equal('Good peers - accepted');
      expect(loggerStub.stubs.trace.getCall(2).args[1]).to.be.deep.equal({ count: 2 });
    });

    it('should call instance.logger.debug methods', async () => {
      peersModuleStub.enqueueResponse('list', { peers });

      await instance.getNework();

      expect(loggerStub.stubs.debug.callCount).to.be.equal(1);
      expect(loggerStub.stubs.debug.getCall(0).args.length).to.be.equal(2);
      expect(loggerStub.stubs.debug.getCall(0).args[0]).to.be.equal('Good peers');
      expect(loggerStub.stubs.debug.getCall(0).args[1]).to.be.deep.equal([undefined, undefined]);
    });

    it('should call instance peersLogic.create', async () => {
      peersModuleStub.enqueueResponse('list', { peers });

      await instance.getNework();

      expect(peersLogicStub.stubs.create.called).to.be.true;
    });

    it('should return instance.network with empty peersArray prop if each of peersModule.list() peers is null', async () => {
      peersModuleStub.enqueueResponse('list', { peers: [null, null] });

      const ret = await instance.getNework();

      expect(ret).to.be.deep.equal({ height: 0, peers: [] });
      expect((instance as any).network).to.be.deep.equal({ height: 0, peers: [] });
    });

    it('should return instance.network with empty peersArray prop if each of peersModule.list() peers has height < lastBlock.height ', async () => {
      container.get<IBlocksStub>(Symbols.modules.blocks).lastBlock.height = 5;
      peersModuleStub.enqueueResponse('list', { peers });

      const ret = await instance.getNework();

      expect(ret).to.be.deep.equal({ height: 0, peers: [] });
    });

    it('should return instance.network with two peers in  peersArray prop', async () => {
      peersModuleStub.enqueueResponse('list', { peers });

      const ret = await instance.getNework();

      expect(ret).to.be.deep.equal({ height: 2, peers });
    });

    it('should return a sorted peersArray', async () => {
      peers[1].height += 3;
      peersModuleStub.enqueueResponse('list', { peers });

      const ret = await instance.getNework();

      expect(ret).to.be.deep.equal({ height: 4, peers: [peers[1], peers[0]] });
    });

    it('should return instance.network with one item in peersArray(check .findGoodPeers second .filter)', async () => {
      peers[0].height = 10;
      peersModuleStub.enqueueResponse('list', { peers });

      const ret = await instance.getNework();

      expect(ret).to.be.deep.equal({ height: 10, peers: [peers[0]] });
      expect(peersLogicStub.stubs.create.calledOnce).to.be.true;
    });

  });

  describe('.getRandomPeer', () => {

    let getNetworkStub;
    let peers: PeerType[];

    beforeEach(() => {
      peers = createFakePeers(3);

      getNetworkStub = sandbox.stub(instance as any, 'getNework');
      getNetworkStub.returns({ peers });
    });

    it('should call instance.getNetwork', async () => {
      await instance.getRandomPeer();

      expect(getNetworkStub.calledOnce).to.be.true;
    });

    it('should return random peer', async () => {
      const ret = await instance.getRandomPeer();

      expect(peers).to.include(ret);
    });

  });

  describe('get .isSyncing', () => {

    let appStateStub;

    beforeEach(() => {
      appStateStub = container.get(Symbols.logic.appState);
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
      error = new Error('error');

      loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);

      loadTransactionsStub = sandbox.stub(instance as any, 'loadTransactions').resolves({});
      loadSignaturesStub   = sandbox.stub(instance as any, 'loadSignatures').resolves({});
      syncTimerStub        = sandbox.stub(instance as any, 'syncTimer').resolves({});

      instance.loaded = true;
    });

    it('should call instance.syncTimer', async () => {
      await instance.onPeersReady();

      expect(syncTimerStub.calledOnce).to.be.true;
      expect(syncTimerStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call instance.loadTransaction', async () => {
      await instance.onPeersReady();

      expect(loadTransactionsStub.calledOnce).to.be.true;
      expect(loadTransactionsStub.firstCall.args.length).to.be.equal(0);
    });

    it('should call logger.waarn when instancce.loadTransactions throw error');
    it('should call logger.log when promiseRetry throw error');
    it('should call instance.loadSignature');
    it('should call logger.warn when promiseRetry(second call) throw error');
    it('should call logger.log when promiseRetry(second call) throw error');

  });

  describe('.onBlockchainReady', () => {

    it('should set instance.loaded in true', () => {
      instance.onBlockchainReady();

      expect((instance as any).loaded).to.be.true;
    });

  });

  describe('.cleanup', () => {

    it('should set instance.loaded in true and returned a promise.resolve', () => {
      const ret = instance.cleanup();

      expect((instance as any).loaded).to.be.false;
      expect(ret).to.be.deep.equal(Promise.resolve());
    });

  });

  describe('.loadBlockChain', () => {

    let results;
    let genBlock;
    let loadResult;
    let blocksCountObj;
    let unappliedArray;
    let round;
    let countDuplicatedDelegatesObj;
    let res;
    let missedBlocksInMemAccountsObj;
    let lastBlock;

    let dbStub: DbStub;
    let roundsLogicStub: RoundsLogicStub;
    let appStateStub: IAppStateStub;
    let blocksUtilsModuleStub: BlocksSubmoduleUtilsStub;
    let busStub: BusStub;
    let loggerStub: LoggerStub;
    let loadStub: SinonStub;
    let processExitStub: SinonStub;
    let processEmitStub: SinonStub;

    beforeEach(() => {
      dbStub                = container.get<DbStub>(Symbols.generic.db);
      roundsLogicStub       = container.get<RoundsLogicStub>(Symbols.logic.rounds);
      appStateStub          = container.get<IAppStateStub>(Symbols.logic.appState);
      blocksUtilsModuleStub = container.get<BlocksSubmoduleUtilsStub>(Symbols.modules.blocksSubModules.utils);
      busStub               = container.get<BusStub>(Symbols.helpers.bus);
      loggerStub            = container.get<LoggerStub>(Symbols.helpers.logger);

      round                        = 5;
      loadResult                   = { data: 'data' };
      lastBlock                    = 1;
      blocksCountObj               = { count: 2 };
      genBlock                     = {
        blockSignature: Buffer.from('10'),
        id            : 10,
        payloadHash   : Buffer.from('10'),
      };
      missedBlocksInMemAccountsObj = { count: 2 };
      unappliedArray               = [{ round: '5' }, { round: '5' }];
      countDuplicatedDelegatesObj  = { count: 0 };
      results                      = [
        blocksCountObj,
        [genBlock],
        missedBlocksInMemAccountsObj,
        unappliedArray,
        [countDuplicatedDelegatesObj],
      ];

      (container.get(Symbols.generic.appConfig) as any).loading.loadPerIteration = 10;
      (container.get(Symbols.helpers.constants) as any).activeDelegates          = constants.activeDelegates;

      res = [[], [], [{}]];

      processExitStub = sandbox.stub(process, 'exit');
      processEmitStub = sandbox.stub(process, 'emit');
      loadStub        = sandbox.stub(instance, 'load').resolves(loadResult);
      roundsLogicStub.enqueueResponse('calcRound', round);
      roundsLogicStub.enqueueResponse('lastInRound', lastBlock);
      appStateStub.enqueueResponse('set', {});
      dbStub.enqueueResponse('task', Promise.resolve(results));
      dbStub.enqueueResponse('task', Promise.resolve(res));
      blocksUtilsModuleStub.enqueueResponse('loadLastBlock', Promise.resolve({}));
      busStub.enqueueResponse('message', Promise.resolve({}));
    });

    afterEach(() => {
      processExitStub.restore();
      dbStub.reset();
      roundsLogicStub.reset();
      appStateStub.reset();
      loggerStub.stubReset();
      blocksUtilsModuleStub.reset();
      busStub.reset();
    });

    it('should call db.task', async () => {
      await instance.loadBlockChain();

      expect(dbStub.stubs.task.called).to.be.true;
      expect(dbStub.stubs.task.firstCall.args.length).to.be.equal(1);
      expect(dbStub.stubs.task.firstCall.args[0]).to.be.a('function');
    });

    it('should call logger.info with blocks count info', async () => {
      await instance.loadBlockChain();

      expect(loggerStub.stubs.info.called).to.be.true;
      expect(loggerStub.stubs.info.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal(`Blocks ${blocksCountObj.count}`);
    });

    it('should return instance.load if blocks count is 1', async () => {
      blocksCountObj.count = 1;

      const ret = await instance.loadBlockChain();

      expect(loadStub.calledOnce).to.be.true;
      expect(loadStub.firstCall.args.length).to.be.equal(4);
      expect(loadStub.firstCall.args[0]).to.be.equal(1);
      expect(loadStub.firstCall.args[1]).to.be.equal(10);
      expect(loadStub.firstCall.args[2]).to.be.equal(null);
      expect(loadStub.firstCall.args[3]).to.be.equal(true);

      expect(ret).to.be.deep.equal(loadResult);
    });

    it('should set limit in default value if config.loading.loadPerIteration is not exist', async () => {
      blocksCountObj.count                                                       = 1;
      (container.get(Symbols.generic.appConfig) as any).loading.loadPerIteration = null;

      await instance.loadBlockChain();
      expect(loadStub.calledOnce).to.be.true;
      expect(loadStub.firstCall.args.length).to.be.equal(4);
      expect(loadStub.firstCall.args[1]).to.be.equal(1000);
    });

    it('should call logger.info with genesis block info', async () => {
      await instance.loadBlockChain();

      expect(loggerStub.stubs.info.called).to.be.true;
      expect(loggerStub.stubs.info.getCall(1).args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.getCall(1).args[0]).to.be.equal('Genesis block matches with database');
    });

    it('should throw error if there are failed to match genesis block with database(bad id value)', async () => {
      dbStub.reset();
      results[1][0].id = null;
      dbStub.enqueueResponse('task', Promise.resolve(results));
      dbStub.enqueueResponse('task', Promise.resolve(res));

      await expect(instance.loadBlockChain()).to.be.rejectedWith('Failed to match genesis block with database');
    });

    it('should throw if there are failed to match genesis block with database(bad payloadHash value)', async () => {
      dbStub.reset();
      results[1][0].payloadHash = Buffer.from('uganda');
      dbStub.enqueueResponse('task', Promise.resolve(results));
      dbStub.enqueueResponse('task', Promise.resolve(res));

      await expect(instance.loadBlockChain()).to.be.rejectedWith('Failed to match genesis block with database');
    });

    it('should throw if there are failed to match genesis block with database(bad blockSignature value)', async () => {
      dbStub.reset();
      results[1][0].blockSignature = Buffer.from('uganda');
      dbStub.enqueueResponse('task', Promise.resolve(results));
      dbStub.enqueueResponse('task', Promise.resolve(res));

      await   expect(instance.loadBlockChain()).to.be.rejectedWith('Failed to match genesis block with database');
    });

    it('should call roundsLogic.calcRound', async () => {
      await instance.loadBlockChain();

      expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
      expect(roundsLogicStub.stubs.calcRound.firstCall.args.length).to.be.equal(1);
      expect(roundsLogicStub.stubs.calcRound.firstCall.args[0]).to.be.equal(blocksCountObj.count);
    });

    it('should check if genesisBlock does not dinded in DB', async () => {
      dbStub.reset();
      results[1][0] = null;
      dbStub.enqueueResponse('task', Promise.resolve(results));
      dbStub.enqueueResponse('task', Promise.resolve(res));

      await instance.loadBlockChain();

      expect(loggerStub.stubs.info.getCall(0).calledBefore(
        roundsLogicStub.stubs.calcRound.getCall(0)
      )).is.true;

    });

    describe('Check verifySnapshot mode(this.config.loading.snapshot is exist)', async () => {

      beforeEach(() => {
        (container.get(Symbols.generic.appConfig) as any).loading.snapshot = true;
      });

      it('should call logger.info with snapshot mode enabled', async () => {
        await instance.loadBlockChain();

        expect(loggerStub.stubs.info.callCount).to.be.equal(5);

        expect(loggerStub.stubs.info.getCall(2).args.length).to.be.equal(1);
        expect(loggerStub.stubs.info.getCall(2).args[0]).to.be.equal('Snapshot mode enabled');
      });

      it('should call appState.set', async () => {
        await instance.loadBlockChain();

        expect(appStateStub.stubs.set.calledOnce).to.be.true;
        expect(appStateStub.stubs.set.firstCall.args.length).to.be.equal(2);
        expect(appStateStub.stubs.set.firstCall.args[0]).to.be.equal('rounds.snapshot');
        expect(appStateStub.stubs.set.firstCall.args[1]).to.be.equal(round);
      });

      // condition blocksCount === 1 already been check
      it('should check if config.loading.snapshot is number(with normalize to previous round, blocksCount % this.constants.activeDelegates > 0(round<1))', async () => {
        (container.get(Symbols.helpers.constants) as any).activeDelegates = 5;

        await instance.loadBlockChain();

        expect(appStateStub.stubs.set.firstCall.args[1]).to.be.equal(round - 1);
      });

      it('should check if config.loading.snapshot is number(with normalize to previous round, blocksCount % this.constants.activeDelegates > 0(round=0))', async () => {
        (container.get(Symbols.helpers.constants) as any).activeDelegates = 5;
        roundsLogicStub.reset();
        roundsLogicStub.enqueueResponse('calcRound', 0);
        roundsLogicStub.enqueueResponse('lastInRound', lastBlock);

        await instance.loadBlockChain();

        expect(appStateStub.stubs.set.calledOnce).to.be.true;
        expect(appStateStub.stubs.set.firstCall.args.length).to.be.equal(2);
        expect(appStateStub.stubs.set.firstCall.args[1]).to.be.equal(1);
      });

      it('should check if config.loading.snapshot is number and less that round', async () => {
        const newSnapshot                                                  = round - 2;
        (container.get(Symbols.generic.appConfig) as any).loading.snapshot = newSnapshot;

        await instance.loadBlockChain();

        expect(appStateStub.stubs.set.calledOnce).to.be.true;
        expect(appStateStub.stubs.set.firstCall.args.length).to.be.equal(2);
        expect(appStateStub.stubs.set.firstCall.args[1]).to.be.equal(newSnapshot);
      });

      it('should call logger.info with "Snapshotting to end of round"', async () => {
        await instance.loadBlockChain();

        expect(loggerStub.stubs.info.callCount).to.be.equal(5);
        expect(loggerStub.stubs.info.getCall(3).args.length).to.be.equal(2);
        expect(loggerStub.stubs.info.getCall(3).args[0]).to.be.equal('Snapshotting to end of round: 5');
        expect(loggerStub.stubs.info.getCall(3).args[1]).to.be.equal(blocksCountObj.count);
      });

      it('should call roundsLogic.lastInRound', async () => {
        await instance.loadBlockChain();

        expect(roundsLogicStub.stubs.lastInRound.calledOnce).to.be.true;
        expect(roundsLogicStub.stubs.lastInRound.firstCall.args.length).to.be.equal(1);
        expect(roundsLogicStub.stubs.lastInRound.firstCall.args[0]).to.be.equal(round);
      });

      it('should call instance.load', async () => {
        await instance.loadBlockChain();

        expect(loadStub.calledOnce).to.be.true;
        expect(loadStub.firstCall.args.length).to.be.equal(4);
        expect(loadStub.firstCall.args[0]).to.be.equal(lastBlock);
        expect(loadStub.firstCall.args[1]).to.be.equal(appConfig.loading.loadPerIteration);
        expect(loadStub.firstCall.args[2]).to.be.equal('Blocks Verification enabled');
        expect(loadStub.firstCall.args[3]).to.be.equal(false);
      });

      it('should call process.exit', async () => {
        await instance.loadBlockChain();

        expect(processExitStub.calledOnce).to.be.true;
        expect(processExitStub.firstCall.args[0]).to.be.equal(0);
      });

      it('should call logger.error and process.exit lastBlock.height !== (finded) lastBlock', async () => {
        container.get<IBlocksStub>(Symbols.modules.blocks).lastBlock = { height: 11 } as any;

        await instance.loadBlockChain();

        expect(loggerStub.stubs.error.calledOnce).to.be.true;
        expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
        expect(loggerStub.stubs.error.firstCall.args[0]).to.be
          .equal(`LastBlock height does not expected block. Expected: ${lastBlock} - Received: ${11}`);

        expect(processExitStub.callCount).to.be.equal(2);
        expect(processExitStub.firstCall.args[0]).to.be.equal(1);
      });
    });

    it('should check if instance.config.loading.snapshot is undefined(not Check verifySnapshot mode)', async () => {
      await instance.loadBlockChain();

      expect(processExitStub.notCalled).to.be.true;
    });

    it('should return instance.load if has been detected missed blocks in mem_accounts', async () => {
      dbStub.reset();
      results[2].count = 0;
      dbStub.enqueueResponse('task', Promise.resolve(results));

      const ret = await instance.loadBlockChain();

      expect(loadStub.calledOnce).to.be.true;
      expect(loadStub.firstCall.args.length).to.be.equal(4);
      expect(loadStub.firstCall.args[0]).to.be.equal(2);
      expect(loadStub.firstCall.args[1]).to.be.equal(10);
      expect(loadStub.firstCall.args[2]).to.be.equal('Detected missed blocks in mem_accounts');
      expect(loadStub.firstCall.args[3]).to.be.equal(true);

      expect(ret).to.be.deep.equal(loadResult);
    });

    it('should return instance.load if has been detected unapplied rounds in mem_round', async () => {
      dbStub.reset();
      results[3][0].round = 'uganda';
      dbStub.enqueueResponse('task', Promise.resolve(results));

      const ret = await instance.loadBlockChain();

      expect(loadStub.calledOnce).to.be.true;
      expect(loadStub.firstCall.args.length).to.be.equal(4);
      expect(loadStub.firstCall.args[0]).to.be.equal(2);
      expect(loadStub.firstCall.args[1]).to.be.equal(10);
      expect(loadStub.firstCall.args[2]).to.be.equal('Detected unapplied rounds in mem_round');
      expect(loadStub.firstCall.args[3]).to.be.equal(true);

      expect(ret).to.be.deep.equal(loadResult);
    });

    it('should call logger.error and proccess.emit if delegates table has been corrupted with duplicate entries and return with undefined', async () => {
      dbStub.reset();
      results[4][0].count = 2;
      dbStub.enqueueResponse('task', Promise.resolve(results));
      dbStub.enqueueResponse('task', Promise.resolve(res));

      const ret = await instance.loadBlockChain();

      expect(loggerStub.stubs.error.calledOnce).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal('Delegates table corrupted with duplicated entries');

      expect(processEmitStub.calledOnce).to.be.true;
      expect(processEmitStub.firstCall.args[0]).to.be.equal('exit');
      expect(processEmitStub.firstCall.args[1]).to.be.equal(1);

      expect(ret).to.be.undefined;
    });

    it('should call db.task second time', async () => {
      await instance.loadBlockChain();

      expect(dbStub.stubs.task.callCount).to.be.equal(2);
      expect(dbStub.stubs.task.secondCall.args.length).to.be.equal(1);
      expect(dbStub.stubs.task.secondCall.args[0]).to.be.a('function');
    });

    it('should return instance.laod if res[1].length > 0', async () => {
      dbStub.reset();
      res[1].push({});
      dbStub.enqueueResponse('task', Promise.resolve(results));
      dbStub.enqueueResponse('task', Promise.resolve(res));

      const ret = await instance.loadBlockChain();

      expect(loadStub.calledOnce).to.be.true;
      expect(loadStub.firstCall.args.length).to.be.equal(4);
      expect(loadStub.firstCall.args[0]).to.be.equal(2);
      expect(loadStub.firstCall.args[1]).to.be.equal(10);
      expect(loadStub.firstCall.args[2]).to.be.equal('Detected orphaned blocks in mem_accounts');
      expect(loadStub.firstCall.args[3]).to.be.equal(true);

      expect(ret).to.be.deep.equal(loadResult);
    });

    it('should return instance.laod if res[2].length === 0', async () => {
      dbStub.reset();
      res[2].pop();
      dbStub.enqueueResponse('task', Promise.resolve(results));
      dbStub.enqueueResponse('task', Promise.resolve(res));

      const ret = await instance.loadBlockChain();

      expect(loadStub.calledOnce).to.be.true;
      expect(loadStub.firstCall.args.length).to.be.equal(4);
      expect(loadStub.firstCall.args[0]).to.be.equal(2);
      expect(loadStub.firstCall.args[1]).to.be.equal(10);
      expect(loadStub.firstCall.args[2]).to.be.equal('No delegates found');
      expect(loadStub.firstCall.args[3]).to.be.equal(true);

      expect(ret).to.be.deep.equal(loadResult);
    });

    it('should call blocksUtilsModule.loadLastBlock', async () => {
      await instance.loadBlockChain();

      expect(blocksUtilsModuleStub.stubs.loadLastBlock.calledOnce).to.be.true;
      expect(blocksUtilsModuleStub.stubs.loadLastBlock.firstCall.args.length).to.be.equal(0);
    });

    it('should call logger.info with blockchain ready info', async () => {
      await instance.loadBlockChain();

      expect(loggerStub.stubs.info.callCount).to.be.equal(3);
      expect(loggerStub.stubs.info.lastCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.lastCall.args[0]).to.be.equal('Blockchain ready');
    });

    it('should call bus.message', async () => {
      await instance.loadBlockChain();

      expect(busStub.stubs.message.calledOnce).to.be.true;
      expect(busStub.stubs.message.firstCall.args.length).to.be.equal(1);
      expect(busStub.stubs.message.firstCall.args[0]).to.be.equal('blockchainReady');
    });

    it('should return instance.load if throw', async () => {
      const error = { message: 'msg' };
      blocksUtilsModuleStub.reset();
      blocksUtilsModuleStub.enqueueResponse('loadLastBlock', Promise.reject(error));

      await instance.loadBlockChain();

      expect(loadStub.calledOnce).to.be.true;
      expect(loadStub.firstCall.args.length).to.be.equal(2);
      expect(loadStub.firstCall.args[0]).to.be.equal(blocksCountObj.count);
      expect(loadStub.firstCall.args[1]).to.be.equal(error.message);
    });

    it('should return instance.load if throw(with default err.message)', async () => {
      const error = {};
      blocksUtilsModuleStub.reset();
      blocksUtilsModuleStub.enqueueResponse('loadLastBlock', Promise.reject(error));

      await instance.loadBlockChain();

      expect(loadStub.calledOnce).to.be.true;
      expect(loadStub.firstCall.args.length).to.be.equal(2);
      expect(loadStub.firstCall.args[0]).to.be.equal(blocksCountObj.count);
      expect(loadStub.firstCall.args[1]).to.be.equal('Failed to load last block');
    });

  });

  describe('.load', () => {

    let count;
    let limitPerIteration;
    let message;
    let emitBlockchainReady;

    let loggerStub;
    let busStub;
    let accountLogicStub;
    let blocksProcessModuleStub;
    let blocksChainModuleStub;

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

      loggerStub              = container.get<LoggerStub>(Symbols.helpers.logger);
      busStub                 = container.get<BusStub>(Symbols.helpers.bus);
      accountLogicStub        = container.get<AccountLogicStub>(Symbols.logic.account);
      blocksProcessModuleStub = container.get<BlocksSubmoduleProcessStub>(Symbols.modules.blocksSubModules.process);
      blocksChainModuleStub   = container.get<BlocksSubmoduleChainStub>(Symbols.modules.blocksSubModules.chain);

      accountLogicStub.enqueueResponse('removeTables', {});
      accountLogicStub.enqueueResponse('createTables', {});
      blocksProcessModuleStub.enqueueResponse('loadBlocksOffset', lastBlock);
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
      expect(loggerStub.stubs.warn.secondCall.args[0]).to.be.equal('Recreating memory tables');
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
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal('Rebuilding blockchain, current block height: ' + 1);
    });

    it('should call blocksProcessModule.loadBlocksOffset', async () => {
      await instance.load(count, limitPerIteration);

      expect(blocksProcessModuleStub.stubs.loadBlocksOffset.calledOnce).to.be.true;

      expect(blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args.length).to.be.equal(3);
      expect(blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args[0]).to.be.equal(3);
      expect(blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args[1]).to.be.equal(0);
      expect(blocksProcessModuleStub.stubs.loadBlocksOffset.firstCall.args[2]).to.be.equal(true);
    });

    it('should call logger.info and bus.message if emitBlockchainReady exist', async () => {
      busStub.enqueueResponse('message', '');

      await instance.load(count, limitPerIteration, message, emitBlockchainReady);

      expect(loggerStub.stubs.info.calledTwice).to.be.true;
      expect(loggerStub.stubs.info.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.secondCall.args[0]).to.be.equal('Blockchain ready');

      expect(busStub.stubs.message.calledOnce).to.be.true;
      expect(busStub.stubs.message.firstCall.args.length).to.be.equal(1);
      expect(busStub.stubs.message.firstCall.args[0]).to.be.equal('blockchainReady');
    });

    it('should not call logger.info if count <= 1', async () => {
      await instance.load(1, limitPerIteration);

      expect(loggerStub.stubs.info.notCalled).to.be.true;
    });

    it('should be no iterations if count less than offset( < 0)', async () => {
      await instance.load(-1, limitPerIteration);

      expect(blocksProcessModuleStub.stubs.loadBlocksOffset.notCalled).to.be.true;
    });

    it('should call logger.error if throw error', async () => {
      loggerStub.stubs.info.throws(error);
      busStub.enqueueResponse('message', '');
      blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});

      await instance.load(count, limitPerIteration, message, emitBlockchainReady);

      expect(loggerStub.stubs.error.called).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.deep.equal(error);
    });

    it('should call logger.error twice if throw error and error.block exist', async () => {
      loggerStub.stubs.info.throws(error);
      busStub.enqueueResponse('message', '');
      blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});

      await instance.load(count, limitPerIteration, message, emitBlockchainReady);

      expect(loggerStub.stubs.error.calledThrice).to.be.true;
      expect(loggerStub.stubs.error.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.error.secondCall.args[0]).to.be.deep.equal('Blockchain failed at: ' + error.block.height);

      expect(loggerStub.stubs.error.thirdCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.error.thirdCall.args[0]).to.be.deep.equal('Blockchain clipped');
    });

    it('should call blocksChainModule.deleteAfterBlock if throw error and error.block exist', async () => {
      loggerStub.stubs.info.throws(error);
      busStub.enqueueResponse('message', '');
      blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});

      await instance.load(count, limitPerIteration, message, emitBlockchainReady);

      expect(blocksChainModuleStub.stubs.deleteAfterBlock.calledOnce).to.be.true;
      expect(blocksChainModuleStub.stubs.deleteAfterBlock.firstCall.args.length).to.be.equal(1);
      expect(blocksChainModuleStub.stubs.deleteAfterBlock.firstCall.args[0]).to.be.equal(error.block.id);
    });

    it('should call bus.message if throw error and error.block exist', async () => {
      loggerStub.stubs.info.throws(error);
      busStub.enqueueResponse('message', '');
      blocksChainModuleStub.enqueueResponse('deleteAfterBlock', {});

      await instance.load(count, limitPerIteration, message, emitBlockchainReady);

      expect(busStub.stubs.message.calledOnce).to.be.true;
      expect(busStub.stubs.message.firstCall.args.length).to.be.equal(1);
      expect(busStub.stubs.message.firstCall.args[0]).to.be.equal('blockchainReady');
    });

    it('should throw error if throw error and error.block is not exist', async () => {
      delete error.block;
      loggerStub.stubs.info.throws(error);

      await expect(instance.load(count, limitPerIteration)).to.be.rejectedWith(error);
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
      syncTriggerStub           = sandbox.stub(instance as any, 'syncTrigger');
      loadBlocksFromNetworkStub = sandbox.stub(instance as any, 'loadBlocksFromNetwork');

      busStub                = container.get<BusStub>(Symbols.helpers.bus);
      transactionsModuleStub = container.get<TransactionsModuleStub>(Symbols.modules.transactions);
      broadcasterLogicStub   = container.get<BroadcasterLogicStub>(Symbols.logic.broadcaster);
      systemModuleStub       = container.get<SystemModuleStub>(Symbols.modules.system);
      loggerStub             = container.get<LoggerStub>(Symbols.helpers.logger);

      busStub.enqueueResponse('message', Promise.resolve());
      busStub.enqueueResponse('message', Promise.resolve());
      transactionsModuleStub.enqueueResponse('undoUnconfirmedList', Promise.resolve());
      transactionsModuleStub.enqueueResponse('applyUnconfirmedList', Promise.resolve());
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
      await  (instance as any).sync();

      expect(loggerStub.stubs.info.callCount).to.be.equal(2);

      expect(loggerStub.stubs.info.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal('Starting sync');

      expect(loggerStub.stubs.info.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.secondCall.args[0]).to.be.equal('Finished sync');
    });

    it('call logger.debug methods', async () => {
      await  (instance as any).sync();

      expect(loggerStub.stubs.debug.callCount).to.be.equal(3);

      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Undoing unconfirmed transactions before sync');

      expect(loggerStub.stubs.debug.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.secondCall.args[0]).to.be.equal('Establishing broadhash consensus before sync');

      expect(loggerStub.stubs.debug.thirdCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.thirdCall.args[0]).to.be.equal('Establishing broadhash consensus after sync');
    });

    it('call logger.debug methods', async () => {
      await  (instance as any).sync();

      expect(loggerStub.stubs.debug.callCount).to.be.equal(3);

      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Undoing unconfirmed transactions before sync');

      expect(loggerStub.stubs.debug.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.secondCall.args[0]).to.be.equal('Establishing broadhash consensus before sync');

      expect(loggerStub.stubs.debug.thirdCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.thirdCall.args[0]).to.be.equal('Establishing broadhash consensus after sync');
    });

    it('call bus"s methods', async () => {
      await  (instance as any).sync();

      expect(busStub.stubs.message.calledTwice).to.be.true;

      expect(busStub.stubs.message.firstCall.args.length).to.be.equal(1);
      expect(busStub.stubs.message.firstCall.args[0]).to.be.equal('syncStarted');

      expect(busStub.stubs.message.secondCall.args.length).to.be.equal(1);
      expect(busStub.stubs.message.secondCall.args[0]).to.be.equal('syncFinished');
    });

    it('call transactionsModule methods', async () => {
      await  (instance as any).sync();

      expect(transactionsModuleStub.stubs.undoUnconfirmedList.calledOnce).to.be.true;
      expect(transactionsModuleStub.stubs.undoUnconfirmedList.firstCall.args.length).to.be.equal(0);

      expect(transactionsModuleStub.stubs.applyUnconfirmedList.calledOnce).to.be.true;
      expect(transactionsModuleStub.stubs.applyUnconfirmedList.firstCall.args.length).to.be.equal(0);
    });

    it('call broadcasterLogic methods', async () => {
      await  (instance as any).sync();

      expect(broadcasterLogicStub.stubs.getPeers.calledTwice).to.be.true;

      expect(broadcasterLogicStub.stubs.getPeers.firstCall.args.length).to.be.equal(1);
      expect(broadcasterLogicStub.stubs.getPeers.firstCall.args[0]).to.be.deep.equal({ limit: constants.maxPeers });

      expect(broadcasterLogicStub.stubs.getPeers.secondCall.args.length).to.be.equal(1);
      expect(broadcasterLogicStub.stubs.getPeers.secondCall.args[0]).to.be.deep.equal({ limit: constants.maxPeers });
    });

    it('call instance.syncTrigger', async () => {
      await  (instance as any).sync();

      expect(syncTriggerStub.calledTwice).to.be.true;

      expect(syncTriggerStub.firstCall.args.length).to.be.equal(1);
      expect(syncTriggerStub.firstCall.args[0]).to.be.true;

      expect(syncTriggerStub.secondCall.args.length).to.be.equal(1);
      expect(syncTriggerStub.secondCall.args[0]).to.be.false;
    });

    it('check instance field', async () => {
      await  (instance as any).sync();

      expect((instance as any).isActive).to.be.false;
      expect((instance as any).blocksToSync).to.be.equal(0);
    });

  });

  describe('.syncTrigger', () => {

  });

  describe('.loadBlocksFromNetwork', () => {

  });

  describe('.syncTimer', () => {

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
      randomPeer = { string: 'string' };
      res        = {
        body:
          {
            signatures:
              [
                {
                  signatures : [
                    {
                      signature: 'sig11',
                    },
                  ],
                  transaction: 'tr11',
                },
                {
                  signatures : [
                    {
                      signature: 'sig22',
                    },
                  ],
                  transaction: 'tr22',
                },
              ],
          },
      };

      loggerStub          = container.get<LoggerStub>(Symbols.helpers.logger);
      transportModuleStub = container.get<TransportModuleStub>(Symbols.modules.transport);
      schemaStub          = container.get<ZSchemaStub>(Symbols.generic.zschema);
      sequenceStub        = container.getTagged<SequenceStub>(Symbols.helpers.sequence,
        Symbols.helpers.sequence, Symbols.tags.helpers.defaultSequence);
      multisigModuleStub  = container.get<MultisignaturesModuleStub>(Symbols.modules.multisignatures);

      getRandomPeerStub = sandbox.stub(instance as any, 'getRandomPeer').resolves(randomPeer);
      transportModuleStub.enqueueResponse('getFromPeer', res);
      multisigModuleStub.enqueueResponse('processSignature', {});
      multisigModuleStub.enqueueResponse('processSignature', {});
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
      expect(loggerStub.stubs.log.firstCall.args[0]).to.be.equal(`Loading signatures from: ${randomPeer.string}`);
    });

    it('should call transportModule.getFromPeer', async () => {
      await (instance as any).loadSignatures();

      expect(transportModuleStub.stubs.getFromPeer.calledOnce).to.be.true;
      expect(transportModuleStub.stubs.getFromPeer.firstCall.args.length).to.be.equal(2);
      expect(transportModuleStub.stubs.getFromPeer.firstCall.args[0]).to.be.deep.equal(randomPeer);
      expect(transportModuleStub.stubs.getFromPeer.firstCall.args[1]).to.be.deep.equal({
        api   : '/signatures',
        method: 'GET',
      });
    });

    it('should call schema.validate', async () => {
      await (instance as any).loadSignatures();

      expect(schemaStub.stubs.validate.calledOnce).to.be.true;
      expect(schemaStub.stubs.validate.firstCall.args.length).to.be.equal(2);
      expect(schemaStub.stubs.validate.firstCall.args[0]).to.be.deep.equal(res.body);
      expect(schemaStub.stubs.validate.firstCall.args[1]).to.be.equal(loaderSchema.loadSignatures);
    });

    it('should throw if validate was failed ', async () => {
      schemaStub.reset();
      schemaStub.enqueueResponse('validate', false);

      await expect((instance as any).loadSignatures()).to.be.rejectedWith('Failed to validate /signatures schema');
    });

    it('should call multisigModule.processSignature', async () => {
      await (instance as any).loadSignatures();

      expect(multisigModuleStub.stubs.processSignature.calledTwice).to.be.true;

      expect(multisigModuleStub.stubs.processSignature.firstCall.args.length).to.be.deep.equal(1);
      expect(multisigModuleStub.stubs.processSignature.firstCall.args[0]).to.be.deep.equal({
        signature  : { signature: 'sig11' },
        transaction: 'tr11',
      });

      expect(multisigModuleStub.stubs.processSignature.secondCall.args.length).to.be.deep.equal(1);
      expect(multisigModuleStub.stubs.processSignature.secondCall.args[0]).to.be.deep.equal({
        signature  : { signature: 'sig22' },
        transaction: 'tr22',
      });
    });

    it('should call logger.warn if multisigModule.processSignature throw error', async () => {
      const error = 'error';

      multisigModuleStub.stubs.processSignature.rejects(error);
      await (instance as any).loadSignatures();

      expect(loggerStub.stubs.warn.calledTwice).to.be.true;

      expect(loggerStub.stubs.warn.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal('Cannot process multisig signature for tr11 ');
      expect(loggerStub.stubs.warn.firstCall.args[1]).to.be.deep.equal({ name: error });

      expect(loggerStub.stubs.warn.secondCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.warn.secondCall.args[0]).to.be.equal('Cannot process multisig signature for tr22 ');
      expect(loggerStub.stubs.warn.secondCall.args[1]).to.be.deep.equal({ name: error });

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
      peer = { string: 'string', ip: '127.0.0.uganda', port: 65488 };
      tx1  = { id: 1 };
      tx2  = { id: 2 };
      res  = {
        body:
          {
            transactions:
              [tx1, tx2],
          },
      };

      transactionLogicStub   = container.get<TransactionLogicStub>(Symbols.logic.transaction);
      transactionsModuleStub = container.get<TransactionsModuleStub>(Symbols.modules.transactions);
      peersModuleStub        = container.get<PeersModuleStub>(Symbols.modules.peers);
      loggerStub             = container.get<LoggerStub>(Symbols.helpers.logger);
      transportModuleStub    = container.get<TransportModuleStub>(Symbols.modules.transport);
      schemaStub             = container.get<ZSchemaStub>(Symbols.generic.zschema);
      sequenceStub           = container.getTagged<SequenceStub>(
        Symbols.helpers.sequence,
        Symbols.helpers.sequence,
        Symbols.tags.helpers.balancesSequence);

      getRandomPeerStub = sandbox.stub(instance as any, 'getRandomPeer').resolves(peer);
      transportModuleStub.enqueueResponse('getFromPeer', res);
      transactionLogicStub.enqueueResponse('objectNormalize', {});
      transactionLogicStub.enqueueResponse('objectNormalize', {});
      transactionsModuleStub.enqueueResponse('processUnconfirmedTransaction', {});
      transactionsModuleStub.enqueueResponse('processUnconfirmedTransaction', {});
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
      expect(loggerStub.stubs.log.firstCall.args[0]).to.be.equal(`Loading transactions from: ${peer.string}`);
    });

    it('should call transportModule.getFromPeer', async () => {
      await (instance as any).loadTransactions();

      expect(transportModuleStub.stubs.getFromPeer.calledOnce).to.be.true;
      expect(transportModuleStub.stubs.getFromPeer.firstCall.args.length).to.be.equal(2);
      expect(transportModuleStub.stubs.getFromPeer.firstCall.args[0]).to.be.deep.equal(peer);
      expect(transportModuleStub.stubs.getFromPeer.firstCall.args[1]).to.be.deep.equal({
        api   : '/transactions',
        method: 'GET',
      });
    });

    it('should call schema.validate', async () => {
      await (instance as any).loadTransactions();

      expect(schemaStub.stubs.validate.calledOnce).to.be.true;
      expect(schemaStub.stubs.validate.firstCall.args.length).to.be.equal(2);
      expect(schemaStub.stubs.validate.firstCall.args[0]).to.be.deep.equal(res.body);
      expect(schemaStub.stubs.validate.firstCall.args[1]).to.be.equal(loaderSchema.loadTransactions);
    });

    it('should throw if validate was failed ', async () => {
      schemaStub.reset();
      schemaStub.enqueueResponse('validate', false);

      await expect((instance as any).loadTransactions()).to.be.rejectedWith('Cannot validate load transactions schema against peer');
    });

    it('should call transactionLogic.objectNormalize for each tx', async () => {
      await (instance as any).loadTransactions();

      expect(transactionLogicStub.stubs.objectNormalize.calledTwice).to.be.true;

      expect(transactionLogicStub.stubs.objectNormalize.firstCall.args.length).to.be.equal(1);
      expect(transactionLogicStub.stubs.objectNormalize.firstCall.args[0]).to.be.deep.equal(tx1);

      expect(transactionLogicStub.stubs.objectNormalize.secondCall.args.length).to.be.equal(1);
      expect(transactionLogicStub.stubs.objectNormalize.secondCall.args[0]).to.be.deep.equal(tx2);
    });

    describe('transactionLogic.objectNormalize throw error', () => {

      let error;

      beforeEach(() => {
        error = new Error('error');
        transactionLogicStub.stubs.objectNormalize.throws(error);
        peersModuleStub.enqueueResponse('remove', {});
        peersModuleStub.enqueueResponse('remove', {});
      });

      it('should throw error', async () => {
        await expect((instance as any).loadTransactions()).to.be.rejectedWith(error);
      });

      it('should call logger.debug', async () => {
        await expect((instance as any).loadTransactions()).to.be.rejectedWith(error);

        expect(loggerStub.stubs.debug.calledOnce).to.be.true;
        expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(2);
        expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal('Transaction normalization failed');
        expect(loggerStub.stubs.debug.firstCall.args[1]).to.be.deep.equal({
          err   : error.toString(),
          module: 'loader',
          tx    : tx1,
        });
      });

      it('should call logger.warn', async () => {
        await expect((instance as any).loadTransactions()).to.be.rejectedWith(error);

        expect(loggerStub.stubs.warn.calledOnce).to.be.true;
        expect(loggerStub.stubs.warn.firstCall.args.length).to.be.equal(2);
        expect(loggerStub.stubs.warn.firstCall.args[0]).to.be.equal('Transaction 1 is not valid, peer removed');
        expect(loggerStub.stubs.warn.firstCall.args[1]).to.be.deep.equal(peer.string);
      });

      it('should peersModule.remove', async () => {
        await expect((instance as any).loadTransactions()).to.be.rejectedWith(error);

        expect(peersModuleStub.stubs.remove.calledOnce).to.be.true;
        expect(peersModuleStub.stubs.remove.firstCall.args.length).to.be.equal(2);
        expect(peersModuleStub.stubs.remove.firstCall.args[0]).to.be.equal(peer.ip);
        expect(peersModuleStub.stubs.remove.firstCall.args[1]).to.be.equal(peer.port);
      });
    });

    it('should call transactionsModule.processUnconfirmedTransaction for each tx', async () => {
      await (instance as any).loadTransactions();

      expect(transactionsModuleStub.stubs.processUnconfirmedTransaction.calledTwice).to.be.true;

      expect(transactionsModuleStub.stubs.processUnconfirmedTransaction.firstCall.args.length).to.be.equal(3);
      expect(transactionsModuleStub.stubs.processUnconfirmedTransaction.firstCall.args[0]).to.deep.equal(tx1);
      expect(transactionsModuleStub.stubs.processUnconfirmedTransaction.firstCall.args[1]).to.be.false;
      expect(transactionsModuleStub.stubs.processUnconfirmedTransaction.firstCall.args[2]).to.be.true;

      expect(transactionsModuleStub.stubs.processUnconfirmedTransaction.secondCall.args.length).to.be.equal(3);
      expect(transactionsModuleStub.stubs.processUnconfirmedTransaction.secondCall.args[0]).to.deep.equal(tx2);
      expect(transactionsModuleStub.stubs.processUnconfirmedTransaction.secondCall.args[1]).to.be.false;
      expect(transactionsModuleStub.stubs.processUnconfirmedTransaction.secondCall.args[2]).to.be.true;
    });

    it('should call logger.debug if transactionsModule.processUnconfirmedTransaction throw error', async () => {
      const error = new Error('error');
      transactionsModuleStub.reset();
      transactionsModuleStub.stubs.processUnconfirmedTransaction.rejects(error);

      await (instance as any).loadTransactions();

      expect(loggerStub.stubs.debug.calledTwice).to.be.true;

      expect(loggerStub.stubs.debug.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.firstCall.args[0]).to.be.equal(error);

      expect(loggerStub.stubs.debug.secondCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.debug.secondCall.args[0]).to.be.equal(error);

    });

  });
});
