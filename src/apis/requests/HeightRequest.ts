import { BaseRequest } from './BaseRequest';

export class HeightRequest extends BaseRequest {
  protected readonly method = 'GET';
  protected readonly baseUrl = '/peer/height';
}
