import { PeerState, PeerType } from '@risevision/core-types';
import { v4 } from 'uuid';

export const createFakePeer = (item: any = {}): PeerType => {
  return {
    state    : item.state || PeerState.CONNECTED,
    ip       : item.ip || `1.1.${Math.ceil(Math.random() * 255)}.${
      Math.ceil(Math.random() * 255)}`,
    port     : item.port || Math.ceil(Math.random() * 65535),
    os       : item.os || 'linux',
    version  : item.version || '1.0.1',
    broadhash: item.broadhash || 'aa',
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
