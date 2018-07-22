import { injectable } from 'inversify';
import { BaseRequest } from './BaseRequest';

@injectable()
export class HeightRequest extends BaseRequest<void, void> {
  protected readonly method = 'GET';
  protected readonly baseUrl = '/peer/height';
}
