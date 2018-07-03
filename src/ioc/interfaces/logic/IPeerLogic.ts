import { BasePeerType, PeerHeaders, PeerState, PeerType } from '../../../logic';
import { PeerRequestOptions } from '../../../modules';

export interface IPeerLogic {
  ip: string;
  port: number;
  state: PeerState;
  os: string;
  version: string;
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

  /**
   * Validates and Normalize PeerType
   */
  accept(peer: BasePeerType): this;

  /**
   * Normalize peer data
   */
  normalize<T extends { height?: number, port?: number, state?: PeerState }>(peer: T): T;

  /**
   * Checks number or assigns default value from parameter.
   */
  parseInt(integer: number, fallback: number): number;

  /**
   * Replaces current PeerHeaders with new ones
   */
  applyHeaders(h: PeerHeaders): PeerHeaders;

  /**
   * Replace PeerType or PeerHeaders with new ones
   */
  update(peer: PeerType | PeerHeaders): this;

  /**
   * Create obj representation of this peer.
   */
  object(): PeerType;

  /**
   * Make a request from this peer
   */
  makeRequest<T>(options: PeerRequestOptions): Promise<T>;

  /**
   * Pings peer and update itself using response headers (transportModule)
   */
  pingAndUpdate(): Promise<void>;
}
