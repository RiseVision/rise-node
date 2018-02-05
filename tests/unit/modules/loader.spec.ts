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
    TransportModuleStub
} from '../../stubs'
import {Container} from "inversify";
import {constants as constantsType} from "../../../src/helpers";

chai.use(chaiAsPromised);

const LoaderCache = rewire('../../../src/modules/loader');

describe('modules/loader', () => {

    let instance: LoaderModule;
    let container: Container;
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
        // container.bind(SSymbols.generic.genesisBlock).toConstantValue(); //etc/testnet
        // container.bind(Symbols.generic.socketIO).to();

        // Helpers
        // container.bind(Symbols.helpers.sequence).to();
        container.bind(Symbols.helpers.bus).to(BusStub).inSingletonScope();
        container.bind(Symbols.helpers.constants).toConstantValue(constants);
        container.bind(Symbols.helpers.jobsQueue).to(JobsQueueStub).inSingletonScope();
        container.bind(Symbols.helpers.logger).to(LoggerStub);
        // container.bind(Symbols.helpers.sequence).to();
        container.bind(Symbols.generic.zschema).to(ZSchemaStub).inSingletonScope();

        // Logic
        container.bind(Symbols.logic.account).to(AccountLogicStub).inSingletonScope();
        // container.bind(Symbols.logic.appState).to().inSingletonScope();
        // container.bind(Symbols.logic.broadcaster).to().inSingletonScope();
        container.bind(Symbols.logic.peers).to(PeersLogicStub).inSingletonScope();
        container.bind(Symbols.logic.transaction).to(TransactionLogicStub).inSingletonScope();
        container.bind(Symbols.logic.rounds).to(RoundsLogicStub).inSingletonScope();

        //Modules
        container.bind(Symbols.modules.blocks).to(IBlocksStub).inSingletonScope();
        // container.bind(Symbols.modules.blocksSubModules.chain).to().inSingletonScope();
        // container.bind(Symbols.modules.blocksSubModules.process).to().inSingletonScope();
        // container.bind(Symbols.modules.blocksSubModules.utils).to().inSingletonScope();
        // container.bind(Symbols.modules.blocksSubModules.verify).to().inSingletonScope();
        // container.bind(Symbols.modules.multisignatures).to().inSingletonScope();
        container.bind(Symbols.modules.peers).to(PeersModuleStub).inSingletonScope();
        container.bind(Symbols.modules.system).to(SystemModuleStub).inSingletonScope();
        container.bind(Symbols.modules.transactions).to(TransactionsModuleStub).inSingletonScope();
        container.bind(Symbols.modules.transport).to(TransportModuleStub).inSingletonScope();

    });

    beforeEach(() => {

    });

    describe('.initialize', () => {
        it('should set inst.network in default value', () => {

        });

    });

});