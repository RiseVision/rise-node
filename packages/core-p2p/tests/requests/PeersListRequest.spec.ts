import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { PeersListRequest } from '../../src/requests';
import { Container } from 'inversify';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { p2pSymbols, ProtoBufHelper } from '../../src/helpers';
import { RequestFactoryType } from '../../src/utils';

// tslint:disable no-unused-expression
describe('apis/requests/PeersListRequest', () => {
  let instance: PeersListRequest;
  // let decodeStub: SinonStub;
  let peer: any;
  let container: Container;
  let peerRequestFactory: RequestFactoryType<any, PeersListRequest>;
  let protobufHelper: ProtoBufHelper;
  before(async () => {
    container          = await createContainer();
    peerRequestFactory = container.get(p2pSymbols.requests.peersList);
  });
  beforeEach(() => {
    protobufHelper = container.get<ProtoBufHelper>(p2pSymbols.helpers.protoBuf);
    peer           = {
      broadhash: '123123123',
      clock    : 9999999,
      height   : 123,
      ip       : '127.0.0.1',
      nonce    : '1231234',
      os       : 'unix',
      port     : 5555,
      state    : 2,
      updated  : 123,
      version  : '1.1.1',
    };
    const buf      = protobufHelper.encode(peer, 'peer');
    const decoded  = protobufHelper.decodeToObj(buf, 'peer', 'peer', {
      longs: Number,
    });
    expect(decoded).deep.eq(peer);
    instance = peerRequestFactory({ data: null });
  });

  describe('getResponseData', () => {
    it('should decode properly', () => {
      const buf = protobufHelper.encode({
        peers: [
          peer, peer, peer,
        ],
      }, 'p2p.peers', 'transportPeers');
      const resp = instance.getResponseData({body: buf, peer});
      expect(resp).deep.eq({
        peers: [ peer, peer, peer]
      });
    });
  });

});
