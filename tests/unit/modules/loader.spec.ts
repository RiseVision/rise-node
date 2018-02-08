import {expect} from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {SinonSandbox, SinonStub} from 'sinon';
import * as sinon from 'sinon';
import * as rewire from 'rewire';
import {LoaderModule} from '../../../src/modules'
import {Symbols} from '../../../src/ioc/symbols';
import {
    DbStub, LoggerStub, AccountLogicStub, BusStub, JobsQueueStub,
    ZSchemaStub, PeersLogicStub, TransactionLogicStub, IBlocksStub,
    PeersModuleStub, SystemModuleStub, TransactionsModuleStub, RoundsLogicStub,
    TransportModuleStub, SocketIOStub, IAppStateStub, BroadcasterLogicStub,
    BlocksModuleChain, BlocksModuleProcessStub, BlocksModuleUtilsStub,
    BlocksModuleVerifyStub, MultisignaturesModuleStub, SequenceStub
} from '../../stubs'
import {Container} from "inversify";
import {createFakePeers} from '../../utils/fakePeersFactory';
import {PeerType} from "../../../src/logic";

chai.use(chaiAsPromised);

const LoaderModuleRewire = rewire('../../../src/modules/loader');

describe('modules/loader', () => {

    let instance: LoaderModule;
    let container: Container;
    let sandbox: SinonSandbox;
    let constants = {
        activeDelegates: 1,
        epochTime: new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
        maxPeers: 100,
    } as any;
    let appConfig = {
        loading: {
            loadPerIteration: 10,
            snapshot: false,
        }
    };
    let genesisBlock = {
        id: 10,
        payloadHash: Buffer.from('10').toString('hex'),
        blockSignature: Buffer.from('10').toString('hex')
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

        //Modules
        container.bind(Symbols.modules.blocks).to(IBlocksStub).inSingletonScope();
        container.bind(Symbols.modules.blocksSubModules.chain).to(BlocksModuleChain).inSingletonScope();
        container.bind(Symbols.modules.blocksSubModules.process).to(BlocksModuleProcessStub).inSingletonScope();
        container.bind(Symbols.modules.blocksSubModules.utils).to(BlocksModuleUtilsStub).inSingletonScope();
        container.bind(Symbols.modules.blocksSubModules.verify).to(BlocksModuleVerifyStub).inSingletonScope();
        container.bind(Symbols.modules.multisignatures).to(MultisignaturesModuleStub).inSingletonScope();
        container.bind(Symbols.modules.peers).to(PeersModuleStub).inSingletonScope();
        container.bind(Symbols.modules.system).to(SystemModuleStub).inSingletonScope();
        container.bind(Symbols.modules.transactions).to(TransactionsModuleStub).inSingletonScope();
        container.bind(Symbols.modules.transport).to(TransportModuleStub).inSingletonScope();

        container.bind(Symbols.modules.loader).to(LoaderModule);
    });

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        instance = container.get(Symbols.modules.loader);

        container.get<IBlocksStub>(Symbols.modules.blocks).lastBlock = {height: 1} as any;
    });

    afterEach(() => {
        constants = {
            activeDelegates: 1,
            epochTime: new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
            maxPeers: 100,
        } as any;
        appConfig = {
            loading: {
                loadPerIteration: 10,
                snapshot: false,
            }
        };
        genesisBlock = {
            id: 10,
            payloadHash: Buffer.from('10').toString('hex'),
            blockSignature: Buffer.from('10').toString('hex')
        };
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

    describe('.getNework', () => {

        let peersModuleStub;
        let peersLogicStub;
        let peers: PeerType[];
        let loggerStub: LoggerStub;

        beforeEach(() => {
            peers = createFakePeers(2);
            peers[0].height = 3;

            peersModuleStub = container.get(Symbols.modules.peers);
            peersLogicStub = container.get(Symbols.logic.peers);
            loggerStub = container.get(Symbols.helpers.logger);

            peersLogicStub.reset();
            loggerStub.stubReset();

            peersLogicStub.stubs.create.callsFake(peer => peer);
        });

        it('should return unchanged instance.network if (network.height <= 0 and Math.abs(expressive) === 1)', async () => {
            container.get<IBlocksStub>(Symbols.modules.blocks).lastBlock = {height: 0} as any;
            (instance as any).network = {
                height: 1,
                peers: [],
            };

            let result = await instance.getNework();

            expect(result).to.be.deep.equal({height: 1, peers: []});
        });

        it('should call instance.peersModule.list if instance.network.height > 0', async () => {
            (instance as any).network = {
                height: 1,
                peers: []
            };
            peersModuleStub.enqueueResponse('list', {peers});

            await instance.getNework();

            expect(peersModuleStub.stubs.list.calledOnce).to.be.true;
        });

        it('should call instance.logger.trace methods', async () => {
            peersModuleStub.enqueueResponse('list', {peers});

            await instance.getNework();

            expect(loggerStub.stubs.trace.callCount).to.be.equal(3);

            expect(loggerStub.stubs.trace.getCall(0).args.length).to.be.equal(2);
            expect(loggerStub.stubs.trace.getCall(0).args[0]).to.be.equal('Good peers - received');
            expect(loggerStub.stubs.trace.getCall(0).args[1]).to.be.deep.equal({count: peers.length});

            expect(loggerStub.stubs.trace.getCall(1).args.length).to.be.equal(2);
            expect(loggerStub.stubs.trace.getCall(1).args[0]).to.be.equal('Good peers - filtered');
            expect(loggerStub.stubs.trace.getCall(1).args[1]).to.be.deep.equal({count: peers.length});

            expect(loggerStub.stubs.trace.getCall(2).args.length).to.be.equal(2);
            expect(loggerStub.stubs.trace.getCall(2).args[0]).to.be.equal('Good peers - accepted');
            expect(loggerStub.stubs.trace.getCall(2).args[1]).to.be.deep.equal({count: 2});
        });

        it('should call instance.logger.debug methods', async () => {
            peersModuleStub.enqueueResponse('list', {peers});

            await instance.getNework();

            expect(loggerStub.stubs.debug.callCount).to.be.equal(1);
            expect(loggerStub.stubs.debug.getCall(0).args.length).to.be.equal(2);
            expect(loggerStub.stubs.debug.getCall(0).args[0]).to.be.equal('Good peers');
            expect(loggerStub.stubs.debug.getCall(0).args[1]).to.be.deep.equal([undefined, undefined]);
        });

        it('should call instance peersLogic.create', async () => {
            peersModuleStub.enqueueResponse('list', {peers});

            await instance.getNework();
            console.log(peersLogicStub.stubs.create.callCount);
            expect(peersLogicStub.stubs.create.called).to.be.true;
        });

        it('should return instance.network with empty peersArray prop if each of peersModule.list() peers is null', async () => {
            peersModuleStub.enqueueResponse('list', {peers: [null, null]});

            let ret = await instance.getNework();

            expect(ret).to.be.deep.equal({height: 0, peers: []});
            expect((instance as any).network).to.be.deep.equal({height: 0, peers: []});
        });

        it('should return instance.network with empty peersArray prop if each of peersModule.list() peers has height < lastBlock.height ', async () => {
            container.get<IBlocksStub>(Symbols.modules.blocks).lastBlock.height = 5;
            peersModuleStub.enqueueResponse('list', {peers});

            let ret = await instance.getNework();

            expect(ret).to.be.deep.equal({height: 0, peers: []});
        });

        it('should return instance.network with two peers in  peersArray prop', async () => {
            peersModuleStub.enqueueResponse('list', {peers});

            let ret = await instance.getNework();

            expect(ret).to.be.deep.equal({height: 2, peers});
        });

        it('should return a sorted peersArray', async () => {
            peers[1].height += 3;
            peersModuleStub.enqueueResponse('list', {peers});

            let ret = await instance.getNework();

            expect(ret).to.be.deep.equal({height: 4, peers: [peers[1], peers[0]]});
        });

        it('should return instance.network with one item in peersArray(check .findGoodPeers second .filter)', async () => {
            peers[0].height = 10;
            peersModuleStub.enqueueResponse('list', {peers});

            let ret = await instance.getNework();

            expect(ret).to.be.deep.equal({height: 10, peers: [peers[0]]});
            expect(peersLogicStub.stubs.create.calledOnce).to.be.true;
        });

    });

    describe('.getRandomPeer', () => {

        let getNetworkStub;
        let peers: PeerType[];

        beforeEach(() => {
            peers = createFakePeers(3);

            getNetworkStub = sandbox.stub(instance as any, 'getNework');
            getNetworkStub.returns({peers});
        });

        it('should call instance.getNetwork', async () => {
            await instance.getRandomPeer();

            expect(getNetworkStub.calledOnce).to.be.true;
        });

        it('should return random peer', async () => {
            let ret = await instance.getRandomPeer();

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
            let ret = instance.isSyncing;

            expect(ret).to.be.true;
        });

        it('should return false if appState.get returned undefined', () => {
            appStateStub.enqueueResponse('get', undefined);
            let ret = instance.isSyncing;

            expect(ret).to.be.false;
        });

    });

    describe('.onPeersReady', () => {

    });

    describe('.onBlockchainReady', () => {

        it('should set instance.loaded in true', () => {
            instance.onBlockchainReady();

            expect((instance as any).loaded).to.be.true;
        });

    });

    describe('.cleanup', () => {

        it('should set instance.loaded in true and returned a promise.resolve', () => {
            let ret = instance.cleanup();

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
        let blocksUtilsModuleStub: BlocksModuleUtilsStub;
        let busStub: BusStub;
        let loggerStub: LoggerStub;
        let loadStub: SinonStub;
        let processExitStub: SinonStub;

        beforeEach(() => {
            dbStub = container.get<DbStub>(Symbols.generic.db);
            roundsLogicStub = container.get<RoundsLogicStub>(Symbols.logic.rounds);
            appStateStub = container.get<IAppStateStub>(Symbols.logic.appState);
            blocksUtilsModuleStub = container.get<BlocksModuleUtilsStub>(Symbols.modules.blocksSubModules.utils);
            busStub = container.get<BusStub>(Symbols.helpers.bus);
            loggerStub = container.get<LoggerStub>(Symbols.helpers.logger)

            round = 5;
            loadResult = {data: 'data'};
            lastBlock = 1;
            blocksCountObj = {count: 2};
            genBlock = {
                id: 10,
                payloadHash: Buffer.from('10'),
                blockSignature: Buffer.from('10')
            };
            missedBlocksInMemAccountsObj = {count: 2};
            unappliedArray = [{round: '5'}, {round: '5'}];
            countDuplicatedDelegatesObj = {count: 0};
            results = [
                blocksCountObj,
                [genBlock],
                missedBlocksInMemAccountsObj,
                unappliedArray,
                [countDuplicatedDelegatesObj]
            ];

            (container.get(Symbols.generic.appConfig) as any).loading.loadPerIteration = 10;
            (container.get(Symbols.helpers.constants) as any).activeDelegates = constants.activeDelegates;

            res = [[], [], [{}]];

            processExitStub = sinon.stub(process, 'exit');
            loadStub = sandbox.stub(instance, 'load').resolves(loadResult);
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

            let ret = await instance.loadBlockChain();

            expect(loadStub.calledOnce).to.be.true;
            expect(loadStub.firstCall.args.length).to.be.equal(4);
            expect(loadStub.firstCall.args[0]).to.be.equal(1);
            expect(loadStub.firstCall.args[1]).to.be.equal(10);
            expect(loadStub.firstCall.args[2]).to.be.equal(null);
            expect(loadStub.firstCall.args[3]).to.be.equal(true);

            expect(ret).to.be.deep.equal(loadResult);
        });

        it('should set limit in default value if config.loading.loadPerIteration is not exist', async () => {
            blocksCountObj.count = 1;
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

            expect(instance.loadBlockChain()).to.be.rejectedWith('Failed to match genesis block with database');
        });

        it('should throw error if there are failed to match genesis block with database(bad payloadHash value)', async () => {
            dbStub.reset();
            results[1][0].payloadHash = Buffer.from('uganda');
            dbStub.enqueueResponse('task', Promise.resolve(results));
            dbStub.enqueueResponse('task', Promise.resolve(res));

            expect(instance.loadBlockChain()).to.be.rejectedWith('Failed to match genesis block with database');
        });

        it('should throw error if there are failed to match genesis block with database(bad blockSignature value)', async () => {
            dbStub.reset();
            results[1][0].blockSignature = Buffer.from('uganda');
            dbStub.enqueueResponse('task', Promise.resolve(results));
            dbStub.enqueueResponse('task', Promise.resolve(res));

            expect(instance.loadBlockChain()).to.be.rejectedWith('Failed to match genesis block with database');
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
                let newSnapshot = round - 2;
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
                container.get<IBlocksStub>(Symbols.modules.blocks).lastBlock = {height: 11} as any;

                await instance.loadBlockChain();

                expect(loggerStub.stubs.error.calledOnce).to.be.true;
                expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(1);
                expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal(`LastBlock height does not expected block. Expected: ${lastBlock} - Received: ${11}`);

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

            let ret = await instance.loadBlockChain();

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

            let ret = await instance.loadBlockChain();

            expect(loadStub.calledOnce).to.be.true;
            expect(loadStub.firstCall.args.length).to.be.equal(4);
            expect(loadStub.firstCall.args[0]).to.be.equal(2);
            expect(loadStub.firstCall.args[1]).to.be.equal(10);
            expect(loadStub.firstCall.args[2]).to.be.equal('Detected unapplied rounds in mem_round');
            expect(loadStub.firstCall.args[3]).to.be.equal(true);

            expect(ret).to.be.deep.equal(loadResult);
        });

        it('should call logger.error and proccess.emit if has been delegates table corrupted with duplicate entries and return after', async () => {
         
        });

        it('should call db.task second time');
        it('should return instance.laod if res[1].length > 0');
        it('should return instance.laod if res[2].length === 0');
        it('should call blocksUtilsModule.loadLastBlock');
        it('should call logger.info with blockchain ready info');
        it('should call bus.message');
        it('should return instance.load if throw');
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
            count = 2;
            limitPerIteration = 3;
            message = 'message';
            emitBlockchainReady = true;
            lastBlock = {data: "data"};
            error = {
                block: {
                    height: 1,
                    id: 1
                }
            };

            loggerStub = container.get<LoggerStub>(Symbols.helpers.logger)
            busStub = container.get<BusStub>(Symbols.helpers.bus);
            accountLogicStub = container.get<AccountLogicStub>(Symbols.logic.account)
            blocksProcessModuleStub = container.get<BlocksModuleProcessStub>(Symbols.modules.blocksSubModules.process);
            blocksChainModuleStub = container.get<BlocksModuleChain>(Symbols.modules.blocksSubModules.chain)

            busStub.reset();
            accountLogicStub.reset();
            blocksProcessModuleStub.reset();
            blocksChainModuleStub.reset();
            loggerStub.stubReset();

            accountLogicStub.enqueueResponse('removeTables', {});
            accountLogicStub.enqueueResponse('createTables', {});
            blocksProcessModuleStub.enqueueResponse('loadBlocksOffset', lastBlock)
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

            expect(instance.load(count, limitPerIteration)).to.be.rejectedWith(error);
        });

    });
});