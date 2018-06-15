import compareVersions = require('compare-versions');
import * as querystring from 'querystring';
import { IPeerLogic } from '../../ioc/interfaces/logic';
import { PeerRequestOptions } from '../../modules';

export interface IAPIRequest {
  getRequestOptions(): PeerRequestOptions;
  getResponseData(res: any);
  setPeer(peer: IPeerLogic);
  getOrigOptions(): PeerRequestOptions;
}

export abstract class BaseRequest implements IAPIRequest {
  protected options: any;
  protected peer: IPeerLogic;

  protected readonly method: 'GET' | 'POST';
  protected readonly baseUrl: string;
  protected readonly supportsProtoBuf: boolean = false;

  constructor(options: {data: any} = {data: null}) {
    this.options = options;
  }

  public getRequestOptions(): PeerRequestOptions {
    const reqOptions: PeerRequestOptions = {
      isProtoBuf: this.isProtoBuf(),
      method: this.getMethod(),
      url: this.getBaseUrl(),
    };
    if (this.options.data) {
      reqOptions.data = this.options.data;
    }
    return reqOptions;
  }

  public getResponseData(res: any) {
    return res.body;
  }

  public isProtoBuf() {
    // TODO Set correct version number
    return this.supportsProtoBuf && compareVersions(this.peer.version, '1.1.1') >= 0;
  }

  public setPeer(peer: IPeerLogic) {
    this.peer = peer;
  }

  public getOrigOptions(): PeerRequestOptions {
    return this.options;
  }

  protected getBaseUrl(): string {
    return this.baseUrl;
  }

  protected getMethod(): 'GET' | 'POST' {
    return this.method;
  }

  protected getQueryString(): string {
    let qs = '';
    if (typeof this.options.query !== 'undefined') {
      qs = querystring.stringify(this.options.query);
    }
    return qs.length === 0 ? '' : `?${qs}`;
  }
}