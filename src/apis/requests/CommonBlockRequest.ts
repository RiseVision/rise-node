import { BaseRequest } from './BaseRequest';
import { injectable } from 'inversify';

@injectable()
export class CommonBlockRequest extends BaseRequest<{ common: { id: string, previousBlock: string, height: number } }, void> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf: boolean = true;

  protected getBaseUrl() {
    const queryString = this.getQueryString();
    return `/peer/blocks/common${queryString}`;
  }
}
