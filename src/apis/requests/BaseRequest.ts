import { inject, injectable } from 'inversify';
import * as querystring from 'querystring';
import * as semver from 'semver';
import { MyConvOptions, ProtoBufHelper } from '../../helpers';
import { IPeerLogic } from '../../ioc/interfaces/logic';
import { Symbols } from '../../ioc/symbols';
import { PeerRequestOptions } from '../../modules';

export interface IAPIRequest<Out, In> {
  getRequestOptions(): PeerRequestOptions;
  getResponseData(res: {body: Buffer | Out, peer: IPeerLogic}): Out;
  setPeer(peer: IPeerLogic);
  getOrigOptions(): { data: In, query?: any};
  mergeIntoThis(...objs: this[]): void;
}

@injectable()
export abstract class BaseRequest<Out, In> implements IAPIRequest<Out, In> {
  public options: { data: In, query?: any} = {data: null};
  // AppManager will inject the dependency here
  protected readonly method: 'GET' | 'POST';
  protected readonly baseUrl: string;
  protected readonly supportsProtoBuf: boolean = false;
  protected peer: IPeerLogic;

  @inject(Symbols.helpers.protoBuf)
  protected protoBufHelper: ProtoBufHelper;

  public getRequestOptions(): PeerRequestOptions<In> {
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

  public getResponseData(res: { body: Buffer | Out, peer: IPeerLogic }): Out {
    return this.isProtoBuf() ?
      this.decodeProtoBufResponse(res as any, 'APISuccess') :
      res.body as Out
      ;
  }

  public isProtoBuf() {
    // TODO Set correct version number
    return this.supportsProtoBuf && semver.gte(this.peer.version, '1.1.1');
  }

  public setPeer(peer: IPeerLogic) {
    this.peer = peer;
  }

  public mergeIntoThis(...objs: this[]) {
    throw new Error('This is not mergiable - or logic is not implemented in subclass');
  }

  public getOrigOptions(): { data: In, query?: any} {
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

  /**
   * Specifies how to convert message to plain object
   * @returns {MyConvOptions<Out>}
   */
  protected getConversionOptions(): MyConvOptions<Out> {
    const retSelf = (a) => a;
    return {
      arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
      bytes: retSelf, // bytes as Buffers
      defaults: false, // includes default values
      enums: String,  // enums as string names
      longs: retSelf, // longs as long.js
      objects: true,  // populates empty objects (map fields) even if defaults=false
      oneofs: true,   // includes virtual oneof fields set to the present field's name
    };
  }

  protected decodeProtoBufResponse(res: {body: Buffer, peer: IPeerLogic}, pbNamespace: string, pbMessageType?: string): Out {
    return this.protoBufHelper
      .decodeToObj(res.body, pbNamespace, pbMessageType, this.getConversionOptions());
  }
}
