import { PeerState } from '@risevision/core-types';
import { Peer } from '../peer';

// tslint:disable-next-line interface-name
export interface PeerFilter {
  limit?: number;
  offset?: number;
  orderBy?: string;
  ip?: string;
  port?: number;
  broadhash?: string;
  state?: PeerState;
}

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
   * Gets peers list
   */
  getPeers(options: {
    limit?: number;
    broadhash?: string;
    allowedStates?: PeerState[];
  }): Promise<Peer[]>;

  /**
   * Recalculate the consensus. Should be called when new blocks are received.
   */
  updateConsensus(): void;

  /**
   * Given a list of peers (with associated blockchain height), we find a list
   * of good peers (likely to sync with), then perform a histogram cut, removing
   * peers far from the most common observed height. This is not as easy as it
   * sounds, since the histogram has likely been made accross several blocks,
   * therefore need to aggregate).
   * Gets the list of good peers.
   */
  findGoodPeers(peers: Peer[]): { height: number; peers: Peer[] };
}
