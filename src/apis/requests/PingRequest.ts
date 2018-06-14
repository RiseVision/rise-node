import { BaseRequest } from './BaseRequest';

export class PingRequest extends BaseRequest {
  protected readonly method = 'GET';
  protected readonly baseUrl = '/peer/ping';
}
