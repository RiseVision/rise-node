import * as ip from 'ip';

export enum PeerState {
  BANNED       = 0,
  DISCONNECTED = 1,
  CONNECTED    = 2,
}

// tslint:disable-next-line
export type PeerHeaders = {
  nethash: string;
  port: number;
  version: string;
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
  dappid: string | string[];
  broadhash: string;
  height: number;
  clock: number;
  updated: number;
  nonce: string;
}

const nullable = [
  'os',
  'version',
  'dappid',
  'broadhash',
  'height',
  'clock',
  'updated',
];

const headers = [
  'os',
  'version',
  'dappid',
  'broadhash',
  'height',
  'nonce',
];

const newVar = [
  'ip',
  'port',
  'string',
];

const properties = [
  'ip',
  'port',
  'state',
  'os',
  'version',
  'dappid',
  'broadhash',
  'height',
  'clock',
  'updated',
  'nonce',
];

export class Peer implements PeerType {
  public ip: string;
  public port: number;
  public state: PeerState;
  public os: string;
  public version: string;
  public dappid: string | string[];
  public broadhash: string;
  public height: number;
  public clock: number;
  public updated: number;
  public nonce: string;
  public string: string;

  public constructor(peer: BasePeerType = {} as any) {
    this.accept({ ...{}, ...peer });
  }

  public accept(peer: BasePeerType) {
    // Normalize peer data
    peer = this.normalize(peer);

    // Accept only supported and defined properties
    for (const key of this.properties) {
      if (peer[key] !== null && peer[key] !== undefined) {
        this[key] = peer[key];
      }
    }

    // Adjust properties according to rules
    if (/^[0-9]+$/.test(this.ip)) {
      this.ip = ip.fromLong(parseInt(this.ip, 10));
    }

    if (this.ip && this.port) {
      this.string = this.ip + ':' + this.port;
    }

    return this;
  }

  public normalize<T extends { dappid?: string | string[], height?: number, port?: number, state?: PeerState }>(peer: T): T {
    if (peer.dappid && !Array.isArray(peer.dappid)) {
      peer.dappid = [peer.dappid];
    }

    if (peer.height) {
      peer.height = this.parseInt(peer.height, 1);
    }

    peer.port  = this.parseInt(peer.port, 0);
    peer.state = this.parseInt(peer.state, PeerState.DISCONNECTED);

    return peer;
  }

  /**
   * Checks number or assigns default value from parameter.
   */
  public parseInt(integer: number, fallback: number) {
    integer = parseInt(`${integer}`, 10);
    integer = isNaN(integer) ? fallback : integer;
    return integer;
  }

  public applyHeaders(h: PeerHeaders = {} as any) {
    h = this.normalize(h);
    this.update(h);
    return h;
  }

  public update(peer: PeerType | PeerHeaders) {
    peer = this.normalize(peer);
    for (const prop of this.properties) {
      if (peer[prop] !== null && typeof(peer[prop]) !== 'undefined' && this.immutable.indexOf(prop) === -1) {
        this[prop] = peer[prop];
      }
    }
    return this;
  }

  /**
   * Create obj representation of this peer.
   */
  public object(): PeerType {
    const copy: PeerType = {} as any;
    for (const prop of this.properties) {
      copy[prop] = this[prop];
    }

    for (const prop of this.nullable) {
      if (!copy[prop]) {
        copy[prop] = null;
      }
    }

    return copy;
  }

  public get nullable() {
    return nullable;
  }

  public get headers() {
    return headers;
  }

  public get immutable() {
    return newVar;
  }

  public get properties() {
    return properties;
  }
}
