import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { expect } from 'chai';
import { Container } from 'inversify';
import { PeerModulesRequest } from '../../../src';
import { p2pSymbols } from '../../../src/helpers';
import { createFakePeers } from '../utils/fakePeersFactory';

// tslint:disable no-unused-expression
describe('apis/requests/PeerModulesRequest', () => {
  // let decodeStub: SinonStub;
  let peers;
  let container: Container;
  let peersModuleRequest: PeerModulesRequest;
  before(async () => {
    container = await createContainer();
    peersModuleRequest = container.getNamed(
      p2pSymbols.transportMethod,
      p2pSymbols.requests.modules
    );
  });
  beforeEach(() => {
    peers = createFakePeers(10);
  });

  describe('round trip', () => {
    it('bau', async () => {
      const buf = await peersModuleRequest.handleRequest({
        body: null,
        query: null,
      });
      expect(buf.length).gte(10);

      // try decoding
      const response = await peersModuleRequest.handleResponse(
        peers[0] as any,
        buf
      );
      expect(response).deep.eq({
        modules: [
          {
            name: '@risevision/core-models',
            version: '1.0.0',
          },
          {
            name: '@risevision/core-helpers',
            version: '1.0.0',
          },
          {
            name: '@risevision/core-apis',
            version: '1.0.0',
          },
          {
            name: '@risevision/core-crypto',
            version: '1.0.0',
          },
          {
            name: '@risevision/core-p2p',
            version: '1.0.0',
          },
          {
            name: '@risevision/core-blocks',
            version: '1.0.0',
          },
          {
            name: '@risevision/core',
            version: '1.0.0',
          },
          {
            name: '@risevision/core-accounts',
            version: '1.0.0',
          },
          {
            name: '@risevision/core-transactions',
            version: '1.0.0',
          },
        ],
      });
    });
  });
});
