import { injectable } from 'inversify';
import { BaseRequest } from './BaseRequest';

@injectable()
export class HeightRequest extends BaseRequest<void, void> {
  protected readonly method: 'GET' = 'GET';
  protected readonly baseUrl = '/v2/peer/height';

  protected decodeProtoBufValidResponse(buf: Buffer) {
    return this.protoBufHelper.decodeToObj(buf, 'p2p.height', 'height');
  }
}
