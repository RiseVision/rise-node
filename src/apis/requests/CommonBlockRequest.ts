import { BaseRequest } from './BaseRequest';

export class CommonBlockRequest extends BaseRequest {
  protected readonly method = 'GET';

  protected getBaseUrl() {
    const queryString = this.getQueryString();
    return `/peer/blocks/common${queryString}`;
  }
}
