import { PeerState, PeerType } from '../../../logic';
import { PeerFilter } from '../../../modules';
import { IPeerLogic } from '../logic';
import { IModule } from './IModule';

export interface IPeersModule extends IModule {

  /**
   * Sets peer state to active and updates it to the list
   */
  update(peer: IPeerLogic): boolean;

  /**
   * Remove a peer from the list if its not one from config files
   */
  remove(peerIP: string, port: number): boolean;

  /**
   * Gets the peers using the given filter.
   */
  getByFilter(filter: PeerFilter): Promise<IPeerLogic[]>;

  /**
   * Gets peers list and calculated consensus.
   */
  // tslint:disable-next-line max-line-length
  list(options: { limit?: number, broadhash?: string, allowedStates?: PeerState[] }): Promise<{ consensus: number, peers: IPeerLogic[] }>;
}
