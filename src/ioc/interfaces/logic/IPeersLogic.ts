import { BasePeerType, PeerLogic, PeerType } from '../../../logic';

export interface IPeersLogic {
  create(peer: BasePeerType): PeerLogic;

  /**
   * Checks if peer is in list
   */
  exists(peer: BasePeerType): boolean;

  get(peer: PeerType | string): void;

  upsert(peer: PeerType, insertOnly: boolean): boolean;

  remove(peer: BasePeerType): boolean;

  list(normalize: true): PeerType[];

  list(normalize: false): PeerLogic[];

  list(normalize: boolean): any[];
}