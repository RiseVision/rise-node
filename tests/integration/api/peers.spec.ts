import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import { checkIntParam, checkPubKey, checkRequiredParam, checkReturnObjKeyVal } from './utils';
import { Symbols } from '../../../src/ioc/symbols';
import { IPeersModule } from '../../../src/ioc/interfaces/modules';
import { IPeersLogic } from '../../../src/ioc/interfaces/logic';
import { createFakePeer, createFakePeers } from '../../utils/fakePeersFactory';
import { PeerState, PeerType } from '../../../src/logic';

// tslint:disable no-unused-expression max-line-length
describe('api/peers', () => {

  initializer.setup();

  describe('/', () => {
    checkIntParam('height', '/api/peers', {min: 1});
    checkIntParam('offset', '/api/peers', {min: 0});
    checkIntParam('limit', '/api/peers', {min: 1, max: 100});
    checkIntParam('port', '/api/peers', {min: 1, max: 65535});
    checkIntParam('state', '/api/peers', {min: 0, max: 2});
    checkReturnObjKeyVal('peers', [], '/api/peers');
    it('should use params');
    it('should return peers :)');
  });

  describe('/get', () => {
    checkRequiredParam('ip', '/api/peers/get?ip=1.1.1.1&port=1000');
    checkRequiredParam('port', '/api/peers/get?ip=1.1.1.1&port=1000');
    checkIntParam('port', '/api/peers/get?ip=1.1.1.1', {min: 1, max: 65535});
    it('should throw peer not found if peer is not found', async () => {
      return supertest(initializer.appManager.expressApp)
        .get('/api/peers/get?ip=1.1.1.1&port=100')
        .expect(500)
        .then((response) => {
          expect(response.body.error).is.eq('Peer not found');
        });
    });
  });

  describe('/count', () => {
    checkReturnObjKeyVal('connected', 0, '/api/peers/count');
    checkReturnObjKeyVal('disconnected', 0, '/api/peers/count');
    checkReturnObjKeyVal('banned', 0, '/api/peers/count');
    describe('with some peers', () => {
      let connectedPeers: PeerType[];
      let disconnectedPeers: PeerType[];
      let bannedPeers: PeerType[];
      before(async () => {
        const peersLogic = initializer.appManager.container.get<IPeersLogic>(Symbols.logic.peers);
        const peers = createFakePeers(10);
        connectedPeers = peers.splice(0, 2);
        disconnectedPeers = peers.splice(0, 3);
        bannedPeers = peers.splice(0, 5);

        connectedPeers.forEach((p) => p.state = PeerState.CONNECTED);
        disconnectedPeers.forEach((p) => p.state = PeerState.DISCONNECTED);
        bannedPeers.forEach((p) => p.state = PeerState.BANNED);

        connectedPeers.forEach((p) => peersLogic.upsert(p, true));
        disconnectedPeers.forEach((p) => peersLogic.upsert(p, true));
        bannedPeers.forEach((p) => peersLogic.upsert(p, true));

      });

      checkReturnObjKeyVal('connected', 2, '/api/peers/count');
      checkReturnObjKeyVal('disconnected', 3, '/api/peers/count');
      checkReturnObjKeyVal('banned', 5, '/api/peers/count');
    });
  });

  describe('/version', () => {
    checkReturnObjKeyVal('build', 'integration-version', '/api/peers/version');
    checkReturnObjKeyVal('commit', 'integration-testing', '/api/peers/version');
    checkReturnObjKeyVal('minVersion', '^0.1.0', '/api/peers/version');
    checkReturnObjKeyVal('version', '0.1.0', '/api/peers/version');
  });
});
