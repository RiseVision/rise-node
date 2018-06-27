import { BaseRequest } from './BaseRequest';

export class PostTransactionsRequest extends BaseRequest {
  protected readonly method = 'POST';
  protected readonly supportsProtoBuf = true;

  public getRequestOptions() {
    const reqOptions = super.getRequestOptions();
    if (this.isProtoBuf()) {
      if (BaseRequest.protoBufHelper.validate(reqOptions.data, 'transportTransactions')) {
        reqOptions.data = BaseRequest.protoBufHelper.encode(reqOptions.data, 'transportBlocks', 'transportBlock');
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
    }
    return reqOptions;
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/transactions' : '/peer/transactions';
  }
}
