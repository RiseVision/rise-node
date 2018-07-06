import { BasePeerType, PeerType } from '../../../logic';
import { IPeerLogic } from './IPeerLogic';

/**
 * Methods signature for a peer
 */
export interface IPeersLogic {

  /**
   * Creates a returns a PeerLogic instance
   */
  create(peer: BasePeerType): IPeerLogic;

  /**
   * Checks if peer is in list
   */
  exists(peer: BasePeerType): boolean;

  /**
   * Returns a PeerLogic instance from a PeerType or alias
   */
  get(peer: PeerType | string): IPeerLogic;

  /**
   * Add or replace a peer into peers list
   */
  upsert(peer: PeerType, insertOnly: boolean): boolean;

  /**
   * Remove a peer from peers list
   */
  remove(peer: BasePeerType): boolean;

  /**
   * Returns peers list. If normalized is true you will get a list of PeerType peers,
   * otherwise you will get a list of PeerLogic peers.
   */
  list(normalize: true): PeerType[];

  list(normalize: false): IPeerLogic[];

  list(normalize: boolean): any[];

  /**
   * Filters acceptable peers.
   * @param {PeerType[]} peers
   * @returns {PeerType[]}
   */
  acceptable(peers: PeerType[]): PeerType[];
}
