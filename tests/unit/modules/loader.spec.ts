import {expect} from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {SinonSandbox} from 'sinon';
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
    BlocksModuleVerifyStub, MultisignaturesModuleStub
} from '../../stubs'
import {Container} from "inversify";
import {constants as constantsType, Sequence} from "../../../src/helpers";
import {createFakePeers} from '../../utils/fakePeersFactory';
import {PeerType} from "../../../src/logic";

chai.use(chaiAsPromised);

const genesisBlock = require('../../../etc/mainnet/genesisBlock.json');
const LoaderModuleRewire = rewire('../../../src/modules/loader');

describe('modules/loader', () => {

    let instance: LoaderModule;
    let container: Container;
    let sandbox: SinonSandbox;
    let constants: typeof constantsType;
    const appConfig = {
        loading: {
            loadPerIteration: 10,
            snapshot: true,
        }
    };

    before(() => {
        container = new Container();

        constants = {
            activeDelegates: 1,
            epochTime: new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
            maxPeers: 100,
        } as any;

        // Generic
        container.bind(Symbols.generic.appConfig).toConstantValue(appConfig);
        container.bind(Symbols.generic.db).to(DbStub).inSingletonScope();
        container.bind(Symbols.generic.genesisBlock).toConstantValue(genesisBlock);
        container.bind(Symbols.generic.socketIO).to(SocketIOStub);

        // Helpers
        container.bind(Symbols.helpers.sequence)
            .toConstantValue(new Sequence({
                onWarning: sinon.stub()
            }))
            .whenTargetTagged(Symbols.helpers.sequence, Symbols.tags.helpers.balancesSequence);
        container.bind(Symbols.helpers.bus).to(BusStub).inSingletonScope();
        container.bind(Symbols.helpers.constants).toConstantValue(constants);
        container.bind(Symbols.helpers.jobsQueue).to(JobsQueueStub).inSingletonScope();
        container.bind(Symbols.helpers.logger).to(LoggerStub).inSingletonScope();
        container.bind(Symbols.helpers.sequence)
            .toConstantValue(new Sequence({
                onWarning: sinon.stub()
            }))
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

    });

    describe('.onPeersReady', () => {

    });

    describe('.onBlockchainReady', () => {

    });

    describe('.cleanup', () => {

    });

    describe('.loadBlockChain', () => {

    });

    describe('.load', () => {

    });

})
;