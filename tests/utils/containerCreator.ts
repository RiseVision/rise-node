import { Container } from 'inversify';
import { constants } from '../../src/helpers';
import { Symbols } from '../../src/ioc/symbols';
import { BusStub, LoggerStub, PeersLogicStub, SystemModuleStub } from '../stubs';
import DbStub from '../stubs/helpers/DbStub';

export const createContainer = (... what: symbol[]): Container => {
  const container = new Container();
  for (const w of what) {
    if (Symbols.generic.db === w) {
      container.bind(w).to(DbStub).inSingletonScope();
    }
    // Helpers
    // tslint:disable-next-line
    else if (Symbols.helpers.constants === w ) {
      container.bind(w).toConstantValue(JSON.parse(JSON.stringify(constants)));
    } else if (Symbols.helpers.bus === w ) {
      container.bind(w).to(BusStub).inSingletonScope();
    } else if (Symbols.helpers.logger === w ) {
      container.bind(w).to(LoggerStub).inSingletonScope();
    }
    // LOGIC
    // tslint:disable-next-line
    else if (Symbols.logic.peers === w ) {
      container.bind(w).to(PeersLogicStub).inSingletonScope();
    } else if (Symbols.modules.system === w) {
      container.bind(w).to(SystemModuleStub).inSingletonScope();
    }
  }

  return container;
};
