import { Peer } from '../peer';
export type SingleTransportPayload<Body, Query> = { body?: Body, query?: Query, requester?: Peer } | null;

export type WrappedTransportMessage = { error: true, message: string } |
  { error: false, wrappedResponse: Buffer };


export interface ITransportMethod<Data, Query, Out> {
  batchable: boolean;
  method: 'GET' | 'POST';
  baseUrl: string;
  /**
   * Performs request to a specific peer.
   * @param peer the peer to query
   * @param req payload & query
   */
  makeRequest(peer: Peer, req: SingleTransportPayload<Data, Query>): Promise<Out>;

  /**
   * For batchable requests this method could be called to batch different requests together.
   * It will bundle requests together if possible to reduce the amount of requests to perform.
   */
  mergeRequests(reqs: Array<SingleTransportPayload<Data, Query>>): Array<SingleTransportPayload<Data, Query>>;

  /**
   * Check if such envelope request is expired or not.
   */
  isRequestExpired(req: SingleTransportPayload<Data, Query>): any;

  /**
   * The handler of the request. It's being called upon a request.
   * @param buf the input buffer containing the request payload.
   * @param query query object.
   * NOTE: all errors should be handled here.
   */
  requestHandler(buf: Buffer, query: Query | null): Promise<Buffer>;

  wrapResponse(r: WrappedTransportMessage): Promise<Buffer>;

  unwrapResponse(b: Buffer): Promise<WrappedTransportMessage>;
}
