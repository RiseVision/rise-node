import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { PeersListRequest } from '../../src/requests';
import { Container } from 'inversify';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { p2pSymbols, ProtoBufHelper } from '../../src/helpers';
import { createFakePeer, createFakePeers } from '../utils/fakePeersFactory';
import { PeerType } from '@risevision/core-types';
import { PeersModule } from '../../src';

// tslint:disable no-unused-expression
describe('apis/requests/PeersListRequest', () => {
  let instance: PeersListRequest;
  // let decodeStub: SinonStub;
  let peers: PeerType[];
  let container: Container;
  let peerRequestFactory: PeersListRequest;
  let sandbox: SinonSandbox;
  before(async () => {
    container          = await createContainer();
    sandbox            = sinon.createSandbox();
    peerRequestFactory = container.getNamed(p2pSymbols.transportMethod, p2pSymbols.requests.peersList);
  });
  beforeEach(() => {
    peers = createFakePeers(10);
  });
  afterEach(() => sandbox.restore());

  describe('round trip', () => {
    it('bau', async () => {
      const peersModule = container.get<PeersModule>(p2pSymbols.modules.peers);
      const stub        = sandbox.stub(peersModule, 'list').resolves({ peers });
      const buf         = await peerRequestFactory.handleRequest(null, null);
      expect(buf.length).gte(10);

      // try decoding
      const response = await peerRequestFactory.handleResponse(peers[0] as any, buf);
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
