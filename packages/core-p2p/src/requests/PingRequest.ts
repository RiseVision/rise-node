import { injectable } from 'inversify';
import { Peer } from '../peer';
import { BaseTransportMethod } from './BaseTransportMethod';
import { SingleTransportPayload } from './ITransportMethod';

// tslint:disable-next-line
@injectable()
export class PingRequest extends BaseTransportMethod<null, null, null> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl = '/v2/peer/ping';

  // protected encodeRequest(data: null, peer: Peer): Promise<Buffer> {
  //   return Promise.resolve(Buffer.alloc(0));
  // }

  protected encodeResponse(
    data: null,
    req: SingleTransportPayload<null, null>
  ): Promise<Buffer> {
    return Promise.resolve(Buffer.alloc(0));
  }

  protected decodeResponse(res: Buffer, peer: Peer): Promise<null> {
    return Promise.resolve(null);
  }
}
