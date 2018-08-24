import { PeerType } from '@risevision/core-types';
import { IAPIRequest } from './IAPIRequest';

export interface BroadcastTaskOptions {
  immediate?: boolean;
  requestHandler: IAPIRequest<any, any>;
}
export interface BroadcastTask {
  options: BroadcastTaskOptions;
  params?: any;
}

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
