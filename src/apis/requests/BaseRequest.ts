import { inject, injectable } from 'inversify';
import * as popsicle from 'popsicle';
import * as querystring from 'querystring';
import * as semver from 'semver';
import { ProtoBufHelper } from '../../helpers';
import { IPeerLogic } from '../../ioc/interfaces/logic';
import { Symbols } from '../../ioc/symbols';
import { PeerRequestOptions } from '../../modules';

export interface IAPIRequest {
  getRequestOptions(): PeerRequestOptions;
  getResponseData(res: any): any;
  setPeer(peer: IPeerLogic);
  getOrigOptions(): PeerRequestOptions;
}

@injectable()
export abstract class BaseRequest implements IAPIRequest {
  protected readonly method: 'GET' | 'POST';
  protected readonly baseUrl: string;
  protected readonly supportsProtoBuf: boolean = false;
  protected options: any;
  protected peer: IPeerLogic;

  @inject(Symbols.helpers.protoBuf)
  protected protoBufHelper: ProtoBufHelper;

  constructor(options: {data: any, query?: any} = {data: null}) {
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

  public getResponseData(res) {
    return this.isProtoBuf() ? this.decodeProtoBufResponse(res, 'APISuccess') : res.body;
  }

  public isProtoBuf() {
    // TODO Set correct version number
    return this.supportsProtoBuf && semver.gte(this.peer.version, '1.1.1');
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

  protected decodeProtoBufResponse(res: popsicle.Response, pbNamespace: string, pbMessageType?: string): any {
    if (res.status === 200) {
      if (this.protoBufHelper.validate(res.body, pbNamespace, pbMessageType)) {
        return this.protoBufHelper.decode(res.body, pbNamespace, pbMessageType);
      } else {
        throw new Error('Cannot decode response');
      }
    } else {
      if (this.protoBufHelper.validate(res.body, 'APIError')) {
        return this.protoBufHelper.decode(res.body, 'APIError');
      } else {
        throw new Error('Cannot decode error response');
      }
    }
  }
}