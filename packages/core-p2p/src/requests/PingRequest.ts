import { injectable } from 'inversify';
import { BaseTransportMethod } from './BaseTransportMethod';

// tslint:disable-next-line
@injectable()
export class PingRequest extends BaseTransportMethod<null, null, null> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl = '/v2/peer/ping';
}
