import { BroadcastTaskOptions, PeerType } from '@risevision/core-types';

export interface IBroadcasterLogic {

  getPeers(params: { limit?: number, broadhash?: string }): Promise<PeerType[]>;

  enqueue(params: any, options: BroadcastTaskOptions): number;

  broadcast(params: {
              limit?: number, broadhash?: string,
              peers?: PeerType[]
            },
            options: any): Promise<{ peer: PeerType[] }>;

  /**
   * Count relays, eventually increment by one and return true if broadcast is exhausted
   */
  maxRelays(): number;

}
