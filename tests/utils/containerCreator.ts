import { Container } from 'inversify';
import { constants } from '../../src/helpers';
import { Symbols } from '../../src/ioc/symbols';
import {
  BlocksSubmoduleChainStub, BlocksSubmoduleVerifyStub,
  BusStub, DelegatesModuleStub,
  LoggerStub,
  PeersLogicStub,
  SystemModuleStub,
  TransactionsModuleStub
} from '../stubs';
import DbStub from '../stubs/helpers/DbStub';
import { SequenceStub } from '../stubs/helpers/SequenceStub';
import { RoundsModuleStub } from '../stubs/modules/RoundsModuleStub';
import AccountsModuleStub from '../stubs/modules/AccountsModuleStub';
import BlocksModuleStub from '../stubs/modules/BlocksModuleStub';
import { BlocksSubmoduleUtilsStub } from '../stubs/modules/blocks/BlocksSubmoduleUtilsStub';
import TransactionLogicStub from '../stubs/logic/TransactionLogicStub';
import { BlockLogicStub } from '../stubs/logic/BlockLogicStub';
import EdStub from '../stubs/helpers/EdStub';
import { ForgeModuleStub } from '../stubs/modules/ForgeModuleStub';
import TransportModuleStub from '../stubs/modules/TransportModuleStub';
import ZSchemaStub from '../stubs/helpers/ZSchemaStub';
import { SlotsStub } from '../stubs/helpers/SlotsStub';
import { AppStateStub } from '../stubs/logic/AppStateStub';
import RoundsLogicStub from '../stubs/logic/RoundsLogicStub';
import { ForkModuleStub } from '../stubs/modules/ForkModuleStub';
import { BlocksSubmoduleProcessStub } from '../stubs/modules/blocks/BlocksSubmoduleProcessStub';

export const createContainer = (): Container => {
  const container = new Container();
  // Generics
  container.bind(Symbols.generic.db).to(DbStub).inSingletonScope();
  container.bind(Symbols.generic.genesisBlock)
    .toConstantValue(require(`${__dirname}/../integration/genesisBlock.json`));
  container.bind(Symbols.generic.zschema).to(ZSchemaStub).inSingletonScope();

  container.bind(Symbols.helpers.constants).toConstantValue(JSON.parse(JSON.stringify(constants)));
  container.bind(Symbols.helpers.bus).to(BusStub).inSingletonScope();
  container.bind(Symbols.helpers.ed).to(EdStub).inSingletonScope();
  container.bind(Symbols.helpers.logger).to(LoggerStub).inSingletonScope();
  container.bind(Symbols.helpers.sequence).to(SequenceStub).inSingletonScope().whenTargetTagged(
    Symbols.helpers.sequence,
    Symbols.tags.helpers.defaultSequence
  );
  container.bind(Symbols.helpers.sequence).to(SequenceStub).inSingletonScope().whenTargetTagged(
    Symbols.helpers.sequence,
    Symbols.tags.helpers.balancesSequence
  );
  container.bind(Symbols.helpers.sequence).to(SequenceStub).inSingletonScope().whenTargetTagged(
    Symbols.helpers.sequence,
    Symbols.tags.helpers.dbSequence
  );
  container.bind(Symbols.helpers.slots).to(SlotsStub).inSingletonScope();

  // LOGIC
  container.bind(Symbols.logic.appState).to(AppStateStub).inSingletonScope();
  container.bind(Symbols.logic.block).to(BlockLogicStub).inSingletonScope();
  container.bind(Symbols.logic.peers).to(PeersLogicStub).inSingletonScope();
  container.bind(Symbols.logic.transaction).to(TransactionLogicStub).inSingletonScope();
  container.bind(Symbols.logic.rounds).to(RoundsLogicStub).inSingletonScope();

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
  container.bind(Symbols.modules.rounds).to(RoundsModuleStub).inSingletonScope();
  container.bind(Symbols.modules.system).to(SystemModuleStub).inSingletonScope();
  container.bind(Symbols.modules.transport).to(TransportModuleStub).inSingletonScope();
  container.bind(Symbols.modules.transactions).to(TransactionsModuleStub).inSingletonScope();

  return container;
};
