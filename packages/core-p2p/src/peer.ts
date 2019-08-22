import {
  BasePeerType,
  PeerHeaders,
  PeerState,
  PeerType,
} from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import * as ip from 'ip';
import { P2PConstantsType, p2pSymbols } from './helpers';
import { ITransportMethod, SingleTransportPayload } from './requests/';
import { PingRequest } from './requests/PingRequest';
import { TransportModule } from './transport';
import { TransportWrapper } from './utils/TransportWrapper';

const nullable = ['os', 'version', 'broadhash', 'height', 'clock', 'updated'];

const headers = ['os', 'version', 'broadhash', 'height', 'nonce'];

const immutable = ['ip', 'port', 'string'];

const properties = [
  'ip',
  'port',
  'state',
  'os',
  'version',
  'broadhash',
  'height',
  'clock',
  'updated',
  'nonce',
];

@injectable()
export class Peer implements PeerType {
  public ip: string;
  public port: number;
  public state: PeerState;
  public os: string;
  public version: string;
  public broadhash: string;
  public height: number;
  public clock: number;
  public updated: number;
  public nonce: string;
  public string: string;

  @inject(p2pSymbols.constants)
  private p2pConsts: P2PConstantsType;

  @inject(p2pSymbols.transportMethod)
  @named(p2pSymbols.requests.ping)
  private pingRequest: PingRequest;

  @inject(p2pSymbols.modules.transport)
  private transportModule: TransportModule;

  @inject(p2pSymbols.utils.transportWrapper)
  private transportWrapper: TransportWrapper;

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

  public normalize<
    T extends { height?: number; port?: number; state?: PeerState }
  >(peer: T): T {
    if (peer.height) {
      peer.height = this.parseInt(peer.height, 1);
    }

    peer.port = this.parseInt(peer.port, 0);
    peer.state = this.parseInt(peer.state, PeerState.DISCONNECTED);

    return peer;
  }

  /**
   * Checks number or assigns default value from parameter.
   */
  public parseInt(integer: number | null | undefined, fallback: number) {
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
      if (
        peer[prop] !== null &&
        typeof peer[prop] !== 'undefined' &&
        this.immutable.indexOf(prop) === -1
      ) {
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

  public async makeRequest<Body, Query, Out>(
    method: ITransportMethod<Body, Query, Out>,
    payload: SingleTransportPayload<Body, Query> = {}
  ): Promise<Out | null> {
    const options = await method.createRequestOptions(payload);
    const { body } = await this.transportModule.getFromPeer<Buffer>(
      this,
      options
    );
    const resp = await this.transportWrapper.unwrapResponse(body, this);
    if (resp === null) {
      throw new Error('Received null wrapped response');
    }
    if (resp.success) {
      return method.handleResponse(this, resp.wrappedResponse);
    } else {
      throw new Error((resp as any).error);
    }
  }

  public get hasStaleInfo() {
    if (!this.updated) {
      return true;
    }
    const elapsed = Date.now() - this.updated;
    if (this.state === PeerState.DISCONNECTED && elapsed > 60000) {
      return true;
    }
    return elapsed > this.p2pConsts.stalePeerDataLimit;
  }

  public pingAndUpdate(): Promise<null> {
    return this.makeRequest(this.pingRequest);
  }

  public get nullable() {
    return nullable;
  }

  public get headers() {
    return headers;
  }

  public get immutable() {
    return immutable;
  }

  public get properties() {
    return properties;
  }

  public toLogObj() {
    return JSON.stringify(this.object());
  }
}
