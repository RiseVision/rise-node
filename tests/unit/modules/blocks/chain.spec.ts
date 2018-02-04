import { IPeersModule } from '../../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../../src/ioc/symbols';
import { Container } from 'inversify';
import { PeersLogicStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';
import { PeersModule } from '../../../../src/modules';

describe('modules/blocks/chain', () => {
  let inst: IPeersModule;
  let instR: PeersModule;
  let container: Container;
  let peersLogicStub: PeersLogicStub;
  const appConfig = {
    peers: {
      list: [{ ip: '1.2.3.4', port: 1111 }, { ip: '5.6.7.8', port: 2222 }],
    },
  };
  beforeEach(() => {
    container = createContainer(
      Symbols.generic.db,
      Symbols.helpers.bus,
      Symbols.helpers.constants,
      Symbols.helpers.logger,
      Symbols.logic.peers,
      Symbols.modules.system
    );
    container.bind(Symbols.generic.appConfig).toConstantValue(appConfig);
    container.bind(Symbols.modules.peers).to(PeersModule);

    inst = instR = container.get(Symbols.modules.peers);
    peersLogicStub = container.get(Symbols.logic.peers);
  });
});