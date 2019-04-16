import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { PeerType } from '@risevision/core-types';
import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { PeersModule } from '../../../src';
import { p2pSymbols } from '../../../src/helpers';
import { PeersListRequest } from '../../../src/requests';
import { createFakePeers } from '../utils/fakePeersFactory';

// tslint:disable no-unused-expression
describe('apis/requests/PeersListRequest', () => {
  // let decodeStub: SinonStub;
  let peers;
  let container: Container;
  let peerRequestFactory: PeersListRequest;
  let sandbox: SinonSandbox;
  before(async () => {
    container = await createContainer();
    sandbox = sinon.createSandbox();
    peerRequestFactory = container.getNamed(
      p2pSymbols.transportMethod,
      p2pSymbols.requests.peersList
    );
  });
  beforeEach(() => {
    peers = createFakePeers(10);
  });
  afterEach(() => sandbox.restore());

  describe('round trip', () => {
    it('bau', async () => {
      const peersModule = container.get<PeersModule>(p2pSymbols.modules.peers);
      sandbox.stub(peersModule, 'getPeers').returns(peers);
      const buf = await peerRequestFactory.handleRequest({
        body: undefined,
        query: null,
      });
      expect(buf.length).gte(10);

      // try decoding
      const response = await peerRequestFactory.handleResponse(
        peers[0] as any,
        buf
      );
      expect(response).deep.eq({
        peers: peers.map((p) => {
          delete p.applyHeaders;
          delete (p as any).string;
          return p;
        }),
      });
    });
  });
});
