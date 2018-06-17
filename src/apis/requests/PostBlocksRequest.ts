import { BaseRequest } from './BaseRequest';

export class PostBlocksRequest extends BaseRequest {
  protected readonly method = 'POST';
  protected readonly supportsProtoBuf = true;

  public getRequestOptions() {
    const reqOptions = super.getRequestOptions();
    if (this.isProtoBuf()) {
      if (this.protoBufHelper.validate(reqOptions.data, 'transportBlocks', 'transportBlock')) {
        reqOptions.data = this.protoBufHelper.encode(reqOptions.data, 'transportBlocks', 'transportBlock');
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
    }
    return reqOptions;
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/blocks' : '/peer/blocks';
  }
}
