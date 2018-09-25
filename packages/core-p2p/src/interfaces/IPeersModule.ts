import { PeerState, PeerType } from '@risevision/core-types';
import { Peer } from '../peer';

export type PeerFilter = { limit?: number, offset?: number, orderBy?: string, ip?: string, port?: number, broadhash?: string, state?: PeerState };

export interface IPeersModule {

  /**
   * Sets peer state to active and updates it to the list
   */
  update(peer: Peer): boolean;

  /**
   * Remove a peer from the list if its not one from config files
   */
  remove(peerIP: string, port: number): boolean;

  /**
   * Gets the peers using the given filter.
   */
  getByFilter(filter: PeerFilter): Promise<Peer[]>;

  /**
   * Gets peers list and calculated consensus. (Does not update conensus att application level)
   */
  // tslint:disable-next-line max-line-length
  list(options: { limit?: number, broadhash?: string, allowedStates?: PeerState[] }): Promise<{ consensus: number, peers: Peer[] }>;

  getPeers(params: { limit?: number, broadhash?: string }): Promise<Peer[]>;
}
