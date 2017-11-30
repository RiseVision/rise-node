import { Peer, PeerState, PeerType } from '../../../logic';
import { PeerFilter } from '../../../modules';
import { IModule } from './IModule';

export interface IPeersModule extends IModule {
  /**
   * Filters peers with private ips or same nonce
   */
  acceptable(peers: PeerType[]): PeerType[];

  /**
   * Pings a peer
   */
  ping(peer: Peer): Promise<void>;

  /**
   * Sets peer state to active and updates it to the list
   */
  update(peer: Peer): boolean;

  /**
   * Remove a peer from the list if its not one from config files
   */
  remove(peerIP: string, port: number): boolean;

  /**
   * Discover peers by getting list and validates them
   */
  discover(): Promise<void>;

  /**
   * Gets the peers using the given filter.
   */
  getByFilter(filter: PeerFilter): Promise<PeerType[]>;

  /**
   * Gets peers list and calculated consensus.
   */
  // tslint:disable-next-line max-line-length
  list(options: { limit?: number, broadhash?: string, allowedStates?: PeerState[] }): Promise<{ consensus: number, peers: PeerType[] }>;
}
