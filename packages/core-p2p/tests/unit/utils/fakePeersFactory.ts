import { PeerState, PeerType } from '@risevision/core-types';
import { PeerHeaders } from '@risevision/core-types';
import { v4 } from 'uuid';

export function createFakePeer(item: any = {}): PeerType {
  return {
    broadhash: item.broadhash || 'aa',
    clock: item.clock || 1,
    height: item.height || 1,
    ip:
      item.ip ||
      `1.1.${Math.ceil(Math.random() * 255)}.${Math.ceil(Math.random() * 255)}`,
    nonce: item.nonce || v4(),
    os: item.os || 'linux',
    port: item.port || Math.ceil(Math.random() * 65535),
    state: item.state || PeerState.CONNECTED,
    updated: item.updated || 1,
    version: item.version || '1.0.1',
    get string() {
      return `${this.ip}:${this.port}`;
    },
    applyHeaders(h?: PeerHeaders): PeerHeaders {
      // tslint:disable-next-line
      console.log('stubme?');
      return {
        nethash: 'stubme?',
        port: 123,
        version: '1.2.3',
        firewalled: 'true',
      };
    },
  };
}

export const createFakePeers = (
  howMany: number,
  item: any = {}
): PeerType[] => {
  return Array.apply(null, new Array(howMany)).map(() => createFakePeer(item));
};
