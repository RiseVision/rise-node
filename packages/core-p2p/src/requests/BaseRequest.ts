import { IAPIRequest, IPeerLogic, ITransportModule, Symbols } from '@risevision/core-interfaces';
import { PeerRequestOptions } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import * as querystring from 'querystring';
import { p2pSymbols, ProtoBufHelper } from '../helpers';

@injectable()
export class BaseRequest<Out, In> implements IAPIRequest<Out, In> {
  public options: { data: In, query?: any } = { data: null };
  // AppManager will inject the dependency here
  protected readonly method: 'GET' | 'POST';
  protected readonly baseUrl: string;

  @inject(p2pSymbols.helpers.protoBuf)
  protected protoBufHelper: ProtoBufHelper;

  @inject(Symbols.modules.transport)
  protected transportModule: ITransportModule;

  public getRequestOptions(): PeerRequestOptions<Buffer> {
    const reqOptions: PeerRequestOptions = {
      method: this.method,
      url   : `${this.baseUrl}${this.getQueryString()}`,
    };
    if (this.options.data) {
      reqOptions.data = this.encodeRequestData(this.options.data);
    }
    return reqOptions;
  }

  public getResponseData(res: { body: Buffer, peer: IPeerLogic }): Out {
    return this.decodeProtoBufResponse(res.body as Buffer);
  }

  public makeRequest(peer: IPeerLogic): Promise<Out> {
    const requestOptions = this.getRequestOptions();
    return this.transportModule.getFromPeer<Buffer>(peer, requestOptions)
      .then((res) => this.getResponseData(res));
  }

  public mergeIntoThis(...objs: this[]) {
    throw new Error('This is not mergiable - or logic is not implemented in subclass');
  }

  public isRequestExpired() {
    return Promise.resolve(false);
  }

  public getOrigOptions(): { data: In, query?: any } {
    return this.options;
  }

  protected encodeRequestData(data: In): Buffer {
    return null;
  }

  protected getQueryString(): string {
    let qs = '';
    if (typeof this.options.query !== 'undefined') {
      qs = querystring.stringify(this.options.query);
    }
    return qs.length === 0 ? '' : `?${qs}`;
  }

  protected decodeProtoBufResponse(buf: Buffer): Out {
    let error: { success: false, error: string };
    try {
      error = this.protoBufHelper.decode(buf, 'APIError');
    } catch (e) {
      // NOOP;
    }
    if (error && !error.success && error.error) {
      throw new Error(error.error);
    } else {
      return this.decodeProtoBufValidResponse(buf);
    }
  }

  protected decodeProtoBufValidResponse(res: Buffer): Out {
    throw new Error('Implement ME!');
  }
}
