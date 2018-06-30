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

export abstract class BaseRequest implements IAPIRequest {
  // AppManager will inject the dependency here
  public static protoBufHelper: ProtoBufHelper;

  protected readonly method: 'GET' | 'POST';
  protected readonly baseUrl: string;
  protected readonly supportsProtoBuf: boolean = false;
  protected options: any;
  protected peer: IPeerLogic;

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
    let retVal: any;
    if (res.status === 200) {
      try {
        retVal = BaseRequest.protoBufHelper.decode(res.body, pbNamespace, pbMessageType);
      } catch (e) {
        throw new Error('Cannot decode response');
      }
    } else {
      try {
        retVal = BaseRequest.protoBufHelper.decode(res.body, 'APIError');
      } catch (e) {
        throw new Error('Cannot decode error response');
      }
    }
    return retVal;
  }
}
