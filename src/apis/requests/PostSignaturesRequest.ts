import { BaseRequest } from './BaseRequest';

export class PostSignaturesRequest extends BaseRequest {
  protected readonly method = 'POST';
  protected readonly supportsProtoBuf = true;
  public getRequestOptions() {
    const reqOptions = super.getRequestOptions();
    if (this.isProtoBuf()) {
      if (BaseRequest.protoBufHelper.validate(reqOptions.data, 'transportSignatures', 'transportBlock')) {
        reqOptions.data = BaseRequest.protoBufHelper.encode(reqOptions.data, 'transportSignatures');
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
    }
    return reqOptions;
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/signatures' : '/peer/signatures';
  }
}
