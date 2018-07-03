import { BroadcastTaskOptions, PeerType } from '../../../logic';

export interface IBroadcasterLogic {

  /**
   * Get peers
   */
  getPeers(params: { limit?: number, broadhash?: string }): Promise<PeerType[]>;

  /**
   * Enqueue a BroadcastTask
   */
  enqueue(params: any, options: BroadcastTaskOptions): number;

  /**
   * Broadcast to peers
   */
  broadcast(params: {
              limit?: number, broadhash?: string,
              peers?: PeerType[]
            },
            options: any): Promise<{ peer: PeerType[] }>;

  /**
   * Count relays, eventually increment by one and return true if broadcast is exhausted
   */
  maxRelays(object: { relays?: number }): boolean;

}
