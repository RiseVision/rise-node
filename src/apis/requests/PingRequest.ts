import { injectable } from 'inversify';
import { BaseRequest } from './BaseRequest';

@injectable()
export class PingRequest extends BaseRequest<void, void> {
  protected readonly method = 'GET';
  protected readonly baseUrl = '/peer/ping';
}
