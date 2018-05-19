import { Container } from 'inversify';
import { constants } from '../../src/helpers';
import { Symbols } from '../../src/ioc/symbols';
import {
  AccountsModelStub,
  BlocksModelStub,
  BlocksSubmoduleChainStub, BlocksSubmoduleVerifyStub,
  BroadcasterLogicStub, BusStub, DelegatesModuleStub,
  ExceptionsManagerStub,
  LoggerStub,
  PeersLogicStub, PeersModuleStub,
  SystemModuleStub,
  TransactionPoolStub,
  TransactionsModuleStub,
} from '../stubs';
import EdStub from '../stubs/helpers/EdStub';
import JobsQueueStub from '../stubs/helpers/jobsQueueStub';
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

export const createContainer = (): Container => {
  const container = new Container();
  // Generics
  container.bind(Symbols.generic.appConfig)
    .toConstantValue(require(`${__dirname}/../integration/config.json`));
  container.bind(Symbols.generic.genesisBlock)
    .toConstantValue(require(`${__dirname}/../integration/genesisBlock.json`));
  container.bind(Symbols.generic.socketIO).to(SocketIOStub).inSingletonScope();
  container.bind(Symbols.generic.zschema).to(ZSchemaStub).inSingletonScope();

  container.bind(Symbols.helpers.constants).toConstantValue({ ...{}, ...constants });
  container.bind(Symbols.helpers.bus).to(BusStub).inSingletonScope();
  container.bind(Symbols.helpers.ed).to(EdStub).inSingletonScope();
  container.bind(Symbols.helpers.exceptionsManager).to(ExceptionsManagerStub).inSingletonScope();
  container.bind(Symbols.helpers.jobsQueue).to(JobsQueueStub).inSingletonScope();
  container.bind(Symbols.helpers.logger).to(LoggerStub).inSingletonScope();
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
  container.bind(Symbols.models.accounts).toConstructor(AccountsModelStub);
  container.bind(Symbols.models.blocks).toConstructor(BlocksModelStub);

  return container;
};
