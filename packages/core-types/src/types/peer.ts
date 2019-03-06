export enum PeerState {
  BANNED = 0,
  DISCONNECTED = 1,
  CONNECTED = 2,
}

// tslint:disable-next-line
export type PeerHeaders = {
  nethash: string;
  port: number;
  version: string;
  firewalled: 'true' | 'false';
  broadhash?: string;
  height?: number;
  nonce?: string;
  os?: string;
};

// tslint:disable-next-line
export interface BasePeerType {
  ip: string;
  port: number;
}

// tslint:disable-next-line
export interface PeerType extends BasePeerType {
  state: PeerState;
  os: string;
  version: string;
  broadhash: string;
  height: number;
  clock: number;
  updated: number;
  nonce: string;

  readonly string: string;

  applyHeaders(h?: PeerHeaders): PeerHeaders;
}
// tslint:disable-next-line

// tslint:disable-next-line
export type PeerRequestOptions<T = any> = {
  url?: string;
  method: 'GET' | 'POST';
  data?: T;
  query?: any;
  headers: { [h: string]: string };
};
