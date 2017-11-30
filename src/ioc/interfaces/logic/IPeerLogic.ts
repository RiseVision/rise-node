import { BasePeerType, PeerHeaders, PeerState, PeerType } from '../../../logic';

export interface IPeerLogic {
  ip: string;
  port: number;
  state: PeerState;
  os: string;
  version: string;
  dappid: string | string[];
  broadhash: string;
  height: number;
  clock: number;
  updated: number;
  nonce: string;
  string: string;
  readonly nullable: string[];
  readonly headers: string[];
  readonly immutable: string[];
  readonly properties: string[];

  accept(peer: BasePeerType): this;

  normalize<T extends { dappid?: string | string[], height?: number, port?: number, state?: PeerState }>(peer: T): T;

  /**
   * Checks number or assigns default value from parameter.
   */
  parseInt(integer: number, fallback: number): number;

  applyHeaders(h: PeerHeaders): PeerHeaders;

  update(peer: PeerType | PeerHeaders): this;

  /**
   * Create obj representation of this peer.
   */
  object(): PeerType;
}
