import { inject, injectable } from 'inversify';
import * as querystring from 'querystring';
import * as semver from 'semver';
import { MyConvOptions, ProtoBufHelper } from '../../helpers';
import { IPeerLogic } from '../../ioc/interfaces/logic';
import { ITransportModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { PeerRequestOptions } from '../../modules';

export interface IAPIRequest<Out, In> {
  getRequestOptions(peerSupportsProto: boolean): PeerRequestOptions;
  getResponseData(res: {body: Buffer | Out, peer: IPeerLogic}): Out;
  getOrigOptions(): { data: In, query?: any};
  mergeIntoThis(...objs: this[]): void;
  makeRequest(peer: IPeerLogic): Promise<Out>;
}

@injectable()
export abstract class BaseRequest<Out, In> implements IAPIRequest<Out, In> {
  public options: { data: In, query?: any} = {data: null};
  // AppManager will inject the dependency here
  protected readonly method: 'GET' | 'POST';
  protected readonly baseUrl: string;
  protected readonly supportsProtoBuf: boolean = false;
  // protected peer: IPeerLogic;

  @inject(Symbols.helpers.protoBuf)
  protected protoBufHelper: ProtoBufHelper;

  @inject(Symbols.modules.transport)
  protected transportModule: ITransportModule;

  public getRequestOptions(peerSupportsProto: boolean): PeerRequestOptions<In> {
    const isProtoBuf = this.supportsProtoBuf && peerSupportsProto;
    const reqOptions: PeerRequestOptions = {
      isProtoBuf,
      method: this.getMethod(),
      url: this.getBaseUrl(isProtoBuf),
    };
    if (this.options.data) {
      reqOptions.data = this.options.data;
    }
    return reqOptions;
  }

  public getResponseData(res: { body: Buffer | Out, peer: IPeerLogic }): Out {
    return this.supportsProtoBuf && this.peerSupportsProtoBuf(res.peer) ?
        this.decodeProtoBufResponse(res as any, 'APISuccess') :
        res.body as Out;
  }

  public makeRequest(peer: IPeerLogic): Promise<Out> {
    const requestOptions = this.getRequestOptions(this.peerSupportsProtoBuf(peer));
    return this.transportModule.getFromPeer<Buffer | Out>(peer, requestOptions)
      .then((res) => this.getResponseData(res));
  }

  public mergeIntoThis(...objs: this[]) {
    throw new Error('This is not mergiable - or logic is not implemented in subclass');
  }

  public getOrigOptions(): { data: In, query?: any} {
    return this.options;
  }

  protected getBaseUrl(isProtoBuf: boolean): string {
    return this.baseUrl;
  }

  protected getMethod(): 'GET' | 'POST' {
    return this.method;
  }

  protected peerSupportsProtoBuf(peer: IPeerLogic) {
    return semver.gte(peer.version, '1.1.1');
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
    let error: { success: false, error: string };
    try {
      error = this.protoBufHelper.decode(res.body, 'APIError');
    } catch (e) {
      // NOOP;
    }
    if (error && !error.success && error.error) {
      throw new Error(error.error);
    } else {
      return this.protoBufHelper
        .decodeToObj(res.body, pbNamespace, pbMessageType, this.getConversionOptions());
    }
  }
}
