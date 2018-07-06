import { BaseRequest } from './BaseRequest';
import { inject, injectable } from 'inversify';

@injectable()
export class GetTransactionsRequest extends BaseRequest<void, void> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  public getResponseData(res) {
    return this.isProtoBuf() ? this.decodeProtoBufResponse(res, 'transportTransactions') : res.body;
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/transactions' : '/peer/transactions';
  }
}
