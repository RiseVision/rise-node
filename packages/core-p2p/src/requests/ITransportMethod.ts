import { PeerRequestOptions } from '@risevision/core-types';
import { Peer } from '../peer';

export type SingleTransportPayload<Body, Query> = {
  headers?: { [h: string]: string };
  body?: Body;
  query?: Query;
  requester?: Peer;
} | null;

export interface ITransportMethod<Data, Query, Out> {
  batchable: boolean;
  method: 'GET' | 'POST';
  baseUrl: string;

  /**
   * For batchable requests this method could be called to batch different requests together.
   * It will bundle requests together if possible to reduce the amount of requests to perform.
   */
  mergeRequests(
    reqs: Array<SingleTransportPayload<Data, Query>>
  ): Array<SingleTransportPayload<Data, Query>>;

  /**
   * Check if such envelope request is expired or not.
   */
  isRequestExpired(req: SingleTransportPayload<Data, Query>): any;

  /**
   * The handler of the request. It's being called upon a request.
   * @param req the request object
   * NOTE: all errors should be handled here.
   */
  handleRequest(req: SingleTransportPayload<Data, Query>): Promise<Buffer>;

  /**
   * handles response
   * @param peer the peer to query
   * @param body the buffer containing the response
   */
  handleResponse(peer: Peer, body: Buffer): Promise<Out>;

  /**
   * Creates request options
   * @param req
   */
  createRequestOptions(
    req?: SingleTransportPayload<Data, Query>
  ): Promise<PeerRequestOptions<Buffer>>;
}
