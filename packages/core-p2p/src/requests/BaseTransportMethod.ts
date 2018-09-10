import { Symbols } from '@risevision/core-interfaces';
import { inject, injectable } from 'inversify';
import * as querystring from 'querystring';
import { p2pSymbols, ProtoBufHelper } from '../helpers';
import { Peer } from '../peer';
import { TransportModule } from '../transport';

export type SingleTransportPayload<Body, Query> = { body?: Body, query?: Query } | null;

export type WrappedTransportMessage = { error: true, message: string } |
  { error: false, wrappedResponse: Buffer };

@injectable()
export class BaseTransportMethod<Data, Query, Out> {
  public readonly batchable: boolean = false;
  // AppManager will inject the dependency here
  public readonly method!: 'GET' | 'POST';
  public readonly baseUrl!: string;

  @inject(p2pSymbols.helpers.protoBuf)
  protected protoBufHelper: ProtoBufHelper;

  @inject(Symbols.modules.transport)
  protected transportModule: TransportModule;

  /**
   * Performs request to a specific peer.
   * @param peer the peer to query
   * @param req payload & query
   */
  public async makeRequest(peer: Peer, req: SingleTransportPayload<Data, Query> = {}): Promise<Out> {
    const queryString = req.query !==
    null ? `?${querystring.stringify(req.query)}` : '';
    return this.transportModule.getFromPeer<Buffer>(peer, {
      data  : await this.encodeRequest(req.body),
      method: this.method,
      url   : `${this.baseUrl}${queryString}`,
    })
      .then(({ body }) => this.unwrapResponse(body))
      .then((r) => {
        if (r.error) {
          throw new Error(r.message);
        } else {
          return this.decodeResponse((r as any).wrappedResponse);
        }
      });
  }

  /**
   * For batchable requests this method could be called to batch different requests together.
   * It will bundle requests together if possible to reduce the amount of requests to perform.
   */
  public mergeRequests(reqs: Array<SingleTransportPayload<Data, Query>>): Array<SingleTransportPayload<Data, Query>> {
    return reqs;
  }

  /**
   * Check if such envelope request is expired or not.
   */
  public isRequestExpired(req: SingleTransportPayload<Data, Query>) {
    return Promise.resolve(false);
  }

  /**
   * The handler of the request. It's being called upon a request.
   * @param buf the input buffer containing the request payload.
   * @param query query object.
   * NOTE: all errors should be handled here.
   */
  public async requestHandler(buf: Buffer, query: Query | null): Promise<Buffer> {
    const body     = await this.decodeRequest(buf);
    const response = await this.produceResponse({ body, query });
    return this.encodeResponse(response);
  }

  public async wrapResponse(r: WrappedTransportMessage): Promise<Buffer> {
    return this.protoBufHelper.encode(r, 'p2p.transport', 'transportMethod');
  }

  public async unwrapResponse(b: Buffer): Promise<WrappedTransportMessage> {
    return this.protoBufHelper.decode(b, 'p2p.transport', 'transportMethod');
  }

  /**
   * Given input request it produces a response.
   * @param request input body data object
   * @param query Query object.
   */
  protected produceResponse(request: SingleTransportPayload<Data, Query>): Promise<Out> {
    return null;
  }

  /**
   * Encodes request from pojo to buffer
   */
  protected encodeRequest(data: Data | null): Promise<Buffer> {
    return null;
  }

  /**
   * Decodes requests from buffer to pojo
   */
  protected decodeRequest(buf: Buffer): Promise<Data> {
    return null;
  }

  /**
   * Decodes Response from buffer to Out Pojo
   */
  protected decodeResponse(res: Buffer): Promise<Out> {
    throw new Error('Implement decoder!');
  }

  /**
   * Encodes response from Out to Buffer
   */
  protected encodeResponse(data: Out): Promise<Buffer> {
    throw new Error('Implement encoder');
  }
}
