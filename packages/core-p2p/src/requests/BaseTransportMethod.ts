import { PeerRequestOptions, Symbols } from '@risevision/core-types';
import * as assert from 'assert';
import { inject, injectable } from 'inversify';
import * as querystring from 'querystring';
import * as z_schema from 'z-schema';
import { p2pSymbols, ProtoBufHelper } from '../helpers';
import { Peer } from '../peer';
import { ITransportMethod, SingleTransportPayload } from './ITransportMethod';

@injectable()
export class BaseTransportMethod<Data, Query, Out>
  implements ITransportMethod<Data, Query, Out> {
  public readonly batchable: boolean = false;
  // AppManager will inject the dependency here
  public readonly method!: 'GET' | 'POST';
  public readonly baseUrl!: string;
  public readonly requestSchema?: any;
  public readonly responseSchema?: any;

  @inject(p2pSymbols.helpers.protoBuf)
  public protoBufHelper: ProtoBufHelper;

  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  get isRequestEncodable() {
    return true;
  }
  get isResponseEncodable() {
    return true;
  }

  public async createRequestOptions(
    payload: SingleTransportPayload<Data, Query> & { body: Data }
  ): Promise<PeerRequestOptions<Buffer>> {
    assert(payload, 'payload param required');
    const queryString =
      payload && payload.query
        ? `?${querystring.stringify(payload.query)}`
        : '';
    const data = this.isRequestEncodable
      ? await this.encodeRequest(payload.body, payload.requester || null)
      : undefined;
    return {
      data,
      headers: payload.headers || {},
      method: this.method,
      url: `${this.baseUrl}${queryString}`,
    };
  }

  /**
   * handles response
   * @param peer the peer to query
   * @param body the buffer containing the response
   */
  public async handleResponse(peer: Peer, body: Buffer): Promise<Out | null> {
    if (!this.isResponseEncodable) {
      return null;
    }
    const decodedResponse = await this.decodeResponse(body, peer);
    await this.assertValidResponse(decodedResponse);
    return decodedResponse;
  }

  /**
   * The handler of the request. It's being called upon a request.
   * @param req the request object
   * NOTE: all errors should be handled here.
   */
  public async handleRequest(
    req: SingleTransportPayload<Buffer, Query>
  ): Promise<Buffer> {
    const body =
      this.isRequestEncodable && req.body
        ? await this.decodeRequest(req)
        : undefined;
    // Rewrite body so that further
    // er calls can process pojo data.
    const newReq = {
      ...req,
      body,
    };
    await this.assertValidRequest(newReq);
    const response = await this.produceResponse(newReq);
    return this.isResponseEncodable && response
      ? this.encodeResponse(response, newReq)
      : new Buffer(0);
  }

  /**
   * For batchable requests this method could be called to batch different requests together.
   * It will bundle requests together if possible to reduce the amount of requests to perform.
   */
  public mergeRequests(
    reqs: Array<SingleTransportPayload<Data, Query>>
  ): Array<SingleTransportPayload<Data, Query>> {
    return reqs;
  }

  /**
   * Check if such envelope request is expired or not.
   */
  public isRequestExpired(req: SingleTransportPayload<Data, Query> = {}) {
    return Promise.resolve(false);
  }

  /**
   * Given input request it produces a response.
   * @param request input body data object
   * @param query Query object.
   */
  protected async produceResponse(
    request: SingleTransportPayload<Data, Query>
  ): Promise<Out> {
    throw new Error('Implement the request');
  }

  /**
   * Encodes request from pojo to buffer
   */
  protected async encodeRequest(
    data: Data,
    // TODO can be null?
    peer: Peer | null
  ): Promise<Buffer> {
    throw new Error('Implement a request encoder');
  }

  /**
   * Decodes requests from buffer to pojo
   */
  protected async decodeRequest(
    req: SingleTransportPayload<Buffer, Query>
  ): Promise<Data> {
    throw new Error('Implement a request decoder');
  }

  /**
   * Decodes Response from buffer to Out Pojo
   */
  protected decodeResponse(res: Buffer, peer: Peer): Promise<Out> {
    throw new Error('Implement a response decoder');
  }

  /**
   * Encodes response from Out to Buffer
   */
  protected encodeResponse(
    data: Out,
    req: SingleTransportPayload<Data, Query>
  ): Promise<Buffer> {
    throw new Error('Implement a response encoder');
  }

  /**
   * Validate request is valid (aka formerly valid)
   * should throw if request is invalid
   */
  protected async assertValidRequest(
    request: SingleTransportPayload<Data, Query>
  ): Promise<void> {
    if (this.requestSchema) {
      const res = this.schema.validate(
        { ...request, body: request.body || null },
        this.requestSchema
      );
      if (!res) {
        throw new Error(
          this.schema
            .getLastErrors()
            .map((e) => `${e.path} - ${e.message}`)
            .join(' - ')
        );
      }
    }
  }

  /**
   * Validate desererialized response is valid (aka formerly valid)
   * should throw if response is invalid
   */
  protected async assertValidResponse(data: Out): Promise<void> {
    if (this.responseSchema) {
      const res = this.schema.validate(data, this.responseSchema);
      if (!res) {
        throw new Error(
          this.schema
            .getLastErrors()
            .map((e) => `${e.path} - ${e.message}`)
            .join(' - ')
        );
      }
    }
  }
}
