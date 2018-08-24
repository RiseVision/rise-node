import { Container } from 'inversify';
import { constants, Symbols } from '@risevision/core-helpers';
import SocketIOStub from './SocketIOStub';
import {
  AppStateStub,
  BlocksSubmoduleChainStub,
  BlocksSubmoduleProcessStub,
  BlocksSubmoduleUtilsStub,
  BlocksSubmoduleVerifyStub,
  BroadcasterLogicStub,
  BusStub,
  DelegatesModuleStub,
  ExceptionsManagerStub,
  PeersLogicStub,
  PeersModuleStub,
  SequenceStub,
  SlotsStub,
  SystemModuleStub,
  TransactionPoolStub,
<<<<<<< HEAD:packages/core-test-utils/src/utils/containerCreator.ts
  TransactionsModuleStub
} from '..';
import CryptoStub from '../helpers/CryptoStub';
import DbStub from '../helpers/DbStub';
=======
  TransactionsModuleStub,
} from '../stubs';
import EdStub from '../stubs/helpers/EdStub';
import JobsQueueStub from '../stubs/helpers/jobsQueueStub';
import { ProtoBufHelperStub } from '../stubs/helpers/ProtoBufHelperStub';
import { SequenceStub } from '../stubs/helpers/SequenceStub';
import { SlotsStub } from '../stubs/helpers/SlotsStub';
import ZSchemaStub from '../stubs/helpers/ZSchemaStub';
import AccountLogicStub from '../stubs/logic/AccountLogicStub';
import { AppStateStub } from '../stubs/logic/AppStateStub';
import { BlockLogicStub } from '../stubs/logic/BlockLogicStub';
import BlockRewardLogicStub from '../stubs/logic/BlockRewardLogicStub';
import RoundsLogicStub from '../stubs/logic/RoundsLogicStub';
import TransactionLogicStub from '../stubs/logic/TransactionLogicStub';
import AccountsModuleStub from '../stubs/modules/AccountsModuleStub';
import { BlocksSubmoduleProcessStub } from '../stubs/modules/blocks/BlocksSubmoduleProcessStub';
import { BlocksSubmoduleUtilsStub } from '../stubs/modules/blocks/BlocksSubmoduleUtilsStub';
import BlocksModuleStub from '../stubs/modules/BlocksModuleStub';
import { ForgeModuleStub } from '../stubs/modules/ForgeModuleStub';
import { ForkModuleStub } from '../stubs/modules/ForkModuleStub';
import { LoaderModuleStub } from '../stubs/modules/LoaderModuleStub';
import MultisignaturesModuleStub from '../stubs/modules/MultisignaturesModuleStub';
import { RoundsModuleStub } from '../stubs/modules/RoundsModuleStub';
import TransportModuleStub from '../stubs/modules/TransportModuleStub';
import SocketIOStub from '../stubs/utils/SocketIOStub';
import {
  AccountsModel, BlocksModel, DelegatesModel, SignaturesModel, TransactionsModel, MultiSignaturesModel,
  VotesModel, Accounts2DelegatesModel, Accounts2MultisignaturesModel, Accounts2U_DelegatesModel,
  Accounts2U_MultisignaturesModel, RoundsModel, ForksStatsModel, PeersModel, RoundsFeesModel, InfoModel, ExceptionModel,
  MigrationsModel
} from '../../src/models';
>>>>>>> origin/feature/protobuf:tests/utils/containerCreator.ts
import { Sequelize } from 'sequelize-typescript';
import { MigratorStub } from '../helpers/MigratorStub';
import JobsQueueStub from '../helpers/jobsQueueStub';
import LoggerStub from '../helpers/LoggerStub';
import AccountLogicStub from '../logic/AccountLogicStub';
import { BlockLogicStub } from '../logic/BlockLogicStub';
import BlockRewardLogicStub from '../logic/BlockRewardLogicStub';
import TransactionLogicStub from '../logic/TransactionLogicStub';
import RoundsLogicStub from '../logic/RoundsLogicStub';
import AccountsModuleStub from '../modules/AccountsModuleStub';
import BlocksModuleStub from '../modules/BlocksModuleStub';
import { ForgeModuleStub } from '../modules/ForgeModuleStub';
import { ForkModuleStub } from '../modules/ForkModuleStub';
import { LoaderModuleStub } from '../modules/LoaderModuleStub';
import MultisignaturesModuleStub from '../modules/MultisignaturesModuleStub';
import { RoundsModuleStub } from '../modules/RoundsModuleStub';
import TransportModuleStub from '../modules/TransportModuleStub';
import {
<<<<<<< HEAD:packages/core-test-utils/src/utils/containerCreator.ts
  AccountsModel,
  BlocksModel,
  ExceptionModel,
  ForksStatsModel,
  InfoModel,
  MigrationsModel,
  TransactionsModel
} from '@risevision/core-models';
import TransactionTypeStub from '../logic/transactions/TransactionTypeStub';
import ZSchemaStub from '../helpers/ZSchemaStub';
=======
  MultiSignatureTransaction,
  RegisterDelegateTransaction,
  SecondSignatureTransaction, SendTransaction, VoteTransaction
} from '../../src/logic/transactions';
import DbStub from '../stubs/helpers/DbStub';
import { MigratorStub } from '../stubs/helpers/MigratorStub';
import { BaseRequest } from '../../src/apis/requests/BaseRequest';
import { requestSymbols } from '../../src/apis/requests/requestSymbols';
import { CommonBlockRequest } from '../../src/apis/requests/CommonBlockRequest';
import { GetBlocksRequest } from '../../src/apis/requests/GetBlocksRequest';
import { GetSignaturesRequest } from '../../src/apis/requests/GetSignaturesRequest';
import { GetTransactionsRequest } from '../../src/apis/requests/GetTransactionsRequest';
import { HeightRequest } from '../../src/apis/requests/HeightRequest';
import { PeersListRequest } from '../../src/apis/requests/PeersListRequest';
import { PingRequest } from '../../src/apis/requests/PingRequest';
import { PostBlocksRequest } from '../../src/apis/requests/PostBlocksRequest';
import { PostSignaturesRequest } from '../../src/apis/requests/PostSignaturesRequest';
import { PostTransactionsRequest } from '../../src/apis/requests/PostTransactionsRequest';
>>>>>>> origin/feature/protobuf:tests/utils/containerCreator.ts

export const createContainer = (): Container => {
  const container = new Container();
  // Generics
  container.bind(Symbols.generic.appConfig)
    .toConstantValue(JSON.parse(JSON.stringify(require(`${__dirname}/../integration/config.json`))));
  container.bind(Symbols.generic.genesisBlock)
    .toConstantValue(JSON.parse(JSON.stringify(require(`${__dirname}/../integration/genesisBlock.json`))));
  const genesis              = container.get<any>(Symbols.generic.genesisBlock)
  genesis.generatorPublicKey = Buffer.from(genesis.generatorPublicKey, 'hex');
  genesis.blockSignature     = Buffer.from(genesis.blockSignature, 'hex');

  container.bind(Symbols.generic.socketIO).to(SocketIOStub).inSingletonScope();
  container.bind(Symbols.generic.zschema).to(ZSchemaStub).inSingletonScope();
  container.bind(Symbols.generic.sequelize).toConstantValue(new Sequelize({
    database: 'test',
    //dialect: 'sqlite',
    dialect : 'postgres',
    username: 'root',
    password: 'test',
    //storage: ':memory',
    logging : !('SEQ_SILENT' in process.env),
  }));

  container.bind(Symbols.helpers.constants).toConstantValue({ ...{}, ...constants });
  container.bind(Symbols.helpers.bus).to(BusStub).inSingletonScope();
  container.bind(Symbols.helpers.crypto).to(CryptoStub).inSingletonScope();
  container.bind(Symbols.helpers.db).to(DbStub).inSingletonScope();
  container.bind(Symbols.helpers.migrator).to(MigratorStub).inSingletonScope();
  container.bind(Symbols.helpers.exceptionsManager).to(ExceptionsManagerStub).inSingletonScope();
  container.bind(Symbols.helpers.jobsQueue).to(JobsQueueStub).inSingletonScope();
  container.bind(Symbols.helpers.logger).to(LoggerStub).inSingletonScope();
  container.bind(Symbols.helpers.protoBuf).to(ProtoBufHelperStub).inSingletonScope();
  // BaseRequest.protoBufHelper = container.get(Symbols.helpers.protoBuf);

  container.bind(Symbols.helpers.sequence).to(SequenceStub).inSingletonScope().whenTargetTagged(
    Symbols.helpers.sequence,
    Symbols.tags.helpers.defaultSequence,
  );
  container.bind(Symbols.helpers.sequence).to(SequenceStub).inSingletonScope().whenTargetTagged(
    Symbols.helpers.sequence,
    Symbols.tags.helpers.balancesSequence,
  );
  container.bind(Symbols.helpers.sequence).to(SequenceStub).inSingletonScope().whenTargetTagged(
    Symbols.helpers.sequence,
    Symbols.tags.helpers.dbSequence,
  );
  container.bind(Symbols.helpers.slots).to(SlotsStub).inSingletonScope();

  // LOGIC
  container.bind(Symbols.logic.account).to(AccountLogicStub).inSingletonScope();
  container.bind(Symbols.logic.appState).to(AppStateStub).inSingletonScope();
  container.bind(Symbols.logic.block).to(BlockLogicStub).inSingletonScope();
  container.bind(Symbols.logic.blockReward).to(BlockRewardLogicStub).inSingletonScope();
  container.bind(Symbols.logic.peers).to(PeersLogicStub).inSingletonScope();
  container.bind(Symbols.logic.transaction).to(TransactionLogicStub).inSingletonScope();
  container.bind(Symbols.logic.transactionPool).to(TransactionPoolStub).inSingletonScope();
  container.bind(Symbols.logic.rounds).to(RoundsLogicStub).inSingletonScope();
  container.bind(Symbols.logic.broadcaster).to(BroadcasterLogicStub).inSingletonScope();

  // Modules
  container.bind(Symbols.modules.accounts).to(AccountsModuleStub).inSingletonScope();
  container.bind(Symbols.modules.blocks).to(BlocksModuleStub).inSingletonScope();
  container.bind(Symbols.modules.blocksSubModules.chain).to(BlocksSubmoduleChainStub).inSingletonScope();
  container.bind(Symbols.modules.blocksSubModules.process).to(BlocksSubmoduleProcessStub).inSingletonScope();
  container.bind(Symbols.modules.blocksSubModules.utils).to(BlocksSubmoduleUtilsStub).inSingletonScope();
  container.bind(Symbols.modules.blocksSubModules.verify).to(BlocksSubmoduleVerifyStub).inSingletonScope();
  container.bind(Symbols.modules.delegates).to(DelegatesModuleStub).inSingletonScope();
  container.bind(Symbols.modules.forge).to(ForgeModuleStub).inSingletonScope();
  container.bind(Symbols.modules.fork).to(ForkModuleStub).inSingletonScope();
  container.bind(Symbols.modules.loader).to(LoaderModuleStub).inSingletonScope();
  container.bind(Symbols.modules.multisignatures).to(MultisignaturesModuleStub).inSingletonScope();
  container.bind(Symbols.modules.peers).to(PeersModuleStub).inSingletonScope();
  container.bind(Symbols.modules.rounds).to(RoundsModuleStub).inSingletonScope();
  container.bind(Symbols.modules.system).to(SystemModuleStub).inSingletonScope();
  container.bind(Symbols.modules.transport).to(TransportModuleStub).inSingletonScope();
  container.bind(Symbols.modules.transactions).to(TransactionsModuleStub).inSingletonScope();

  // Models
  container.bind(Symbols.models.accounts).toConstructor(AccountsModel);
  container.bind(Symbols.models.blocks).toConstructor(BlocksModel);
  container.bind(Symbols.models.exceptions).toConstructor(ExceptionModel);
  container.bind(Symbols.models.forkStats).toConstructor(ForksStatsModel);
  container.bind(Symbols.models.migrations).toConstructor(MigrationsModel);
  container.bind(Symbols.models.info).toConstructor(InfoModel);
  container.bind(Symbols.models.transactions).toConstructor(TransactionsModel);

  // TRansactions
  container.bind(Symbols.logic.transactions.createmultisig).to(TransactionTypeStub).inSingletonScope();
  container.bind(Symbols.logic.transactions.delegate).to(TransactionTypeStub).inSingletonScope();
  container.bind(Symbols.logic.transactions.secondSignature).to(TransactionTypeStub).inSingletonScope();
  container.bind(Symbols.logic.transactions.send).to(TransactionTypeStub).inSingletonScope();
  container.bind(Symbols.logic.transactions.vote).to(TransactionTypeStub).inSingletonScope();

  // Requests
  const factory = (what: (new () => any)) => (ctx) => (options) => {
    const toRet = ctx.container.resolve(what);
    toRet.options = options;
    return toRet;
  };
  container.bind(requestSymbols.commonBlock).toFactory(factory(CommonBlockRequest));
  container.bind(requestSymbols.getBlocks).toFactory(factory(GetBlocksRequest));
  container.bind(requestSymbols.getSignatures).toFactory(factory(GetSignaturesRequest));
  container.bind(requestSymbols.getTransactions).toFactory(factory(GetTransactionsRequest));
  container.bind(requestSymbols.height).toFactory(factory(HeightRequest));
  container.bind(requestSymbols.peersList).toFactory(factory(PeersListRequest));
  container.bind(requestSymbols.ping).toFactory(factory(PingRequest));
  container.bind(requestSymbols.postBlocks).toFactory(factory(PostBlocksRequest));
  container.bind(requestSymbols.postSignatures).toFactory(factory(PostSignaturesRequest));
  container.bind(requestSymbols.postTransactions).toFactory(factory(PostTransactionsRequest));

  const sequelize = container.get<Sequelize>(Symbols.generic.sequelize);
  const models    = [
    AccountsModel, BlocksModel, Accounts2DelegatesModel, Accounts2U_DelegatesModel, Accounts2MultisignaturesModel,
    Accounts2U_MultisignaturesModel, ExceptionModel, ForksStatsModel, InfoModel, MigrationsModel, TransactionsModel];
  sequelize.addModels(models);

  // add container to models.
  models.forEach((model) => model.container = this.container);
  return container;
};


