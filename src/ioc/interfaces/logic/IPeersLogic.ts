import { BasePeerType, PeerType } from '../../../logic';
import { IPeerLogic } from './IPeerLogic';

export interface IPeersLogic {
  create(peer: BasePeerType): IPeerLogic;

  /**
   * Checks if peer is in list
   */
  exists(peer: BasePeerType): boolean;

  get(peer: PeerType | string): void;

  upsert(peer: PeerType, insertOnly: boolean): boolean;

  remove(peer: BasePeerType): boolean;

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
