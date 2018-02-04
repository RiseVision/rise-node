import { Container } from 'inversify';
import { constants } from '../../src/helpers';
import { Symbols } from '../../src/ioc/symbols';
import { BusStub, LoggerStub, PeersLogicStub, SystemModuleStub, TransactionsModuleStub } from '../stubs';
import DbStub from '../stubs/helpers/DbStub';
import { SequenceStub } from '../stubs/helpers/SequenceStub';
import { RoundsModuleStub } from '../stubs/modules/RoundsModuleStub';
import AccountsModuleStub from '../stubs/modules/AccountsModuleStub';
import BlocksModuleStub from '../stubs/modules/BlocksModuleStub';
import { BlocksSubmoduleUtilsStub } from '../stubs/modules/blocks/BlocksSubmoduleUtilsStub';
import TransactionLogicStub from '../stubs/logic/TransactionLogicStub';
import { BlockLogicStub } from '../stubs/logic/BlockLogicStub';

export const createContainer = (... what: symbol[]): Container => {
  const container = new Container();
  for (const w of what) {
    if (Symbols.generic.db === w) {
      container.bind(w).to(DbStub).inSingletonScope();
    } else if (Symbols.generic.genesisBlock === w) {
      container.bind(w).to(require(`${__dirname}/../integration/genesisBlock.json`)).inSingletonScope();
    }
    // Helpers
    // tslint:disable-next-line

    else if (Symbols.helpers.constants === w ) {
      container.bind(w).toConstantValue(JSON.parse(JSON.stringify(constants)));
    } else if (Symbols.helpers.bus === w ) {
      container.bind(w).to(BusStub).inSingletonScope();
    } else if (Symbols.helpers.logger === w ) {
      container.bind(w).to(LoggerStub).inSingletonScope();
    } else if (Symbols.helpers.sequence) {
      container.bind(w).to(SequenceStub).inSingletonScope().whenTargetTagged(
        Symbols.helpers.sequence,
        Symbols.tags.helpers.defaultSequence
      );
      container.bind(w).to(SequenceStub).inSingletonScope().whenTargetTagged(
        Symbols.helpers.sequence,
        Symbols.tags.helpers.balancesSequence
      );
      container.bind(w).to(SequenceStub).inSingletonScope().whenTargetTagged(
        Symbols.helpers.sequence,
        Symbols.tags.helpers.dbSequence
      );
    }
    // LOGIC
    // tslint:disable-next-line
    else if (Symbols.logic.block === w ) {
      container.bind(w).to(BlockLogicStub).inSingletonScope();
    } else if (Symbols.logic.peers === w ) {
      container.bind(w).to(PeersLogicStub).inSingletonScope();
    } else if (Symbols.logic.transaction === w) {
      container.bind(w).to(TransactionLogicStub).inSingletonScope();
    }

    // Modules
    // tslint:disable-next-line
    else if (Symbols.modules.accounts === w) {
      container.bind(w).to(AccountsModuleStub).inSingletonScope();
    } else if (Symbols.modules.blocks === w ) {
      container.bind(w).to(BlocksModuleStub).inSingletonScope();
    } else if (Symbols.modules.blocksSubModules.utils === w ) {
      container.bind(w).to(BlocksSubmoduleUtilsStub).inSingletonScope();
    } else if (Symbols.modules.rounds === w) {
      container.bind(w).to(RoundsModuleStub).inSingletonScope();
    } else if (Symbols.modules.system === w) {
      container.bind(w).to(SystemModuleStub).inSingletonScope();
    } else if (Symbols.modules.transactions === w) {
      container.bind(w).to(TransactionsModuleStub).inSingletonScope();
    }
  }

  return container;
};
