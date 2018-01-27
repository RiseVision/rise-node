import { v4 } from 'uuid';
import { PeerState, PeerType } from '../../src/logic';

export const createFakePeer = (item: any = {}): PeerType => {
  return {
    state    : item.state || PeerState.CONNECTED,
    ip       : item.ip || '1.1.1.1',
    port     : item.port || 1111,
    os       : item.os || 'linux',
    version  : item.version || '1.0.1',
    broadhash: item.broadhash || 'broadhash1',
    height   : item.height || 1,
    clock    : item.clock || 1,
    updated  : item.updated || 1,
    nonce    : item.nonce || v4(),
  };
};

export const createFakePeers = (howMany: number): PeerType[] => {
  return Array.apply(null, new Array(howMany))
    .map(() => createFakePeer());
};