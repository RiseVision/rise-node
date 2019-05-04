import { BlocksModuleProcess, BlocksSymbols } from '@risevision/core-blocks';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { IPeersModule, PeersLogic } from '@risevision/core-p2p';
import { createFakePeers } from '@risevision/core-p2p/tests/unit/utils/fakePeersFactory';
import {
  IAppState,
  IBlocksModel,
  IBlocksModule,
  IJobsQueue,
  ISystemModule,
  PeerType,
  SignedAndChainedBlockType,
  Symbols,
} from '@risevision/core-types';
import { wait } from '@risevision/core-utils';
import { LoggerStub } from '@risevision/core-utils/tests/unit/stubs';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import * as proxyquire from 'proxyquire';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { createFakeBlock } from '../../../../core-blocks/tests/unit/utils/createFakeBlocks';
import {
  CoreSymbols,
  OnBlockchainReady,
  RecreateAccountsTables,
} from '../../../src';
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
    systemModule.update(blocksModule.lastBlock);
    appState = container.get(Symbols.logic.appState);
    const logger = container.get<LoggerStub>(Symbols.helpers.logger);
    logger.stubReset();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('.getNetwork', () => {
    let peersModuleStub: IPeersModule;
    let peersLogicStub: PeersLogic;
    let loggerStub: LoggerStub;
    let peers: PeerType[];
    let getPeersStub: SinonStub;
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
      getPeersStub = sandbox.stub(peersModuleStub, 'getPeers');
    });

    afterEach(() => {
      loggerStub.stubReset();
    });

    it('should call peersModule.getPeers()', () => {
      getPeersStub.returns(peers);

      instance.getNetwork();

      expect(getPeersStub.calledOnce).to.be.true;
    });

    it('should call instance.logger.trace methods', () => {
      getPeersStub.returns(peers);

      instance.getNetwork();

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

    it('should call instance.logger.debug methods', () => {
      getPeersStub.returns(peers);
      loggerStub.stubs.debug.resetHistory();
      instance.getNetwork();

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

    it('should return network with empty peersArray prop if each of peersModule.list() peers is null', () => {
      getPeersStub.returns([null, null]);

      const ret = instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 0, peers: [] });
    });

    it('should return network with empty peersArray prop if each of peersModule.list() peers has height < lastBlock.height ', () => {
      blocksModule.lastBlock.height = 5;
      systemModule.update(blocksModule.lastBlock);
      getPeersStub.returns(peers);

      const ret = instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 0, peers: [] });
    });

    it('should return network with two peers in peersArray prop', () => {
      getPeersStub.returns(peers);

      const ret = instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 2, peers });
    });

    it('should return a sorted peersArray', () => {
      peers[1].height += 3;
      getPeersStub.returns(peers);

      const ret = instance.getNetwork();

      expect(ret).to.be.deep.equal({ height: 4, peers: [peers[1], peers[0]] });
    });

    it('should return network with one item in peersArray(check .findGoodPeers second .filter)', () => {
      peers[0].height = 10;
      getPeersStub.returns(peers);

      const ret = instance.getNetwork();

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
        .returns({ peers });
    });

    it('should call instance.getNetwork', () => {
      instance.getRandomPeer();

      expect(getNetworkStub.calledOnce).to.be.true;
    });

    it('should return random peer', () => {
      const ret = instance.getRandomPeer();

      expect(peers).to.include(ret);
    });
    it('should reject if no peers', () => {
      getNetworkStub.returns({ peers: [] });
      expect(() => instance.getRandomPeer()).to.throw(
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
    });
  });

  describe('.load', () => {
    let blocksModel: typeof IBlocksModel;
    let blocksProcessModule: BlocksModuleProcess;
    let hookSystem: WordPressHookSystem;
    let findOneStub: SinonStub;
    let doActionStub: SinonStub;
    let loadBlocksOffsetStub: SinonStub;
    let fakeBlock: SignedAndChainedBlockType;
    beforeEach(() => {
      blocksModel = container.getNamed(
        ModelSymbols.model,
        Symbols.models.blocks
      );
      hookSystem = container.get(Symbols.generic.hookSystem);
      blocksProcessModule = container.get(BlocksSymbols.modules.process);
      fakeBlock = createFakeBlock(container);
      findOneStub = sandbox.stub(blocksModel, 'findOne').resolves(fakeBlock);
      doActionStub = sandbox.stub(hookSystem, 'do_action').resolves();
      loadBlocksOffsetStub = sandbox
        .stub(blocksProcessModule, 'loadBlocksOffset')
        .resolves();
    });
    describe('offset', () => {
      describe('> 0', () => {
        it('should not recreate account tables', async () => {
          await instance.load(10, 6, '', false, 1);
          expect(doActionStub.called).false;
        });
        it('should call Blocks.findOne and set it to lastBlock', async () => {
          await instance.load(10, 6, '', false, 1);
          expect(findOneStub.called).true;
          expect(blocksModule.lastBlock).deep.eq(fakeBlock);
        });
      });
      describe('= 0', () => {
        it('should issue RecreateAccountsTable event', async () => {
          await instance.load(10, 6, '', false, 0);
          expect(doActionStub.calledOnce).true;
          expect(doActionStub.firstCall.args).deep.eq([
            RecreateAccountsTables.name,
          ]);
        });
      });
    });
    it('should call loadBlocksOffset honoring limit Param with correct params and correct # of times', async () => {
      await instance.load(10, 6, '', false, 0);
      expect(loadBlocksOffsetStub.callCount).eq(2);

      let [first, second] = loadBlocksOffsetStub.args;
      expect(first).deep.eq([6, 0, true]);
      expect(second).deep.eq([5, 6, true]);

      loadBlocksOffsetStub.resetHistory();
      await instance.load(10, 6, '', alse, 3);
      expect(loadBlocksOffsetStub.callCount).eq(2);

      [first, second] = loadBlocksOffsetStub.args;
      expect(first).deep.eq([6, 3 + 1, true]);
      expect(second).deep.eq([1, 10, true]);
    });

    it('should not emit blockChainReadyEvent if flag is false', async () => {
      await instance.load(10, 6, '', false, 1);
      expect(doActionStub.called).false;
      await instance.load(10, 6, '', true, 1);
      expect(doActionStub.called).true;
      expect(doActionStub.firstCall.args).deep.eq([OnBlockchainReady.name]);
    });
  });

  describe('.syncTimer', () => {
    let jobsQueueStub: IJobsQueue;
    let blocksIsStaleStub: SinonStub;
    let loggerStub: LoggerStub;
    let syncStub: SinonStub;
    let getNetworkStub: SinonStub;
    let getAppStateStub: SinonStub;

    beforeEach(() => {
      jobsQueueStub = container.get(Symbols.helpers.jobsQueue);
      loggerStub = container.get(Symbols.helpers.logger);
      syncStub = sandbox
        .stub(instance as any, 'doSync')
        .resolves(Promise.resolve({}));
      getNetworkStub = sandbox
        .stub(instance, 'getNetwork')
        .returns({ peers: [null], height: 10 });
      blocksIsStaleStub = sandbox.stub(blocksModule, 'isStale').resolves(true);

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

    // TODO: lerna
    // it('should call blocksModule.isStale', async () => {
    //   await (instance as any).syncTimer();
    //
    //   expect(blocksIsStaleStub.calledOnce).to.be.true;
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

    it('should not sync if there are no peers available to sync from');
  });
});
