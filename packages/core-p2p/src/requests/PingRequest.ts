import { injectable } from 'inversify';
import { BaseRequest } from './BaseRequest';

/* istanbul ignore next */
@injectable()
export class PingRequest extends BaseRequest<void, void> {
  protected readonly method: 'GET' = 'GET';
  protected readonly baseUrl = '/peer/ping';
}
