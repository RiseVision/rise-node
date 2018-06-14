import { inject, injectable } from 'inversify';
import { ProtoBufHelper } from '../../helpers';
import { Symbols } from '../../ioc/symbols';
import { BaseRequest } from './BaseRequest';

@injectable()
export class PostBlocksRequest extends BaseRequest {
  protected readonly method = 'POST';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.helpers.protoBuf)
  private protoBufHelper: ProtoBufHelper;

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

  public getResponseData(res) {
    // TODO Implement me! :)
    return res.body;
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/blocks' : '/peer/blocks';
  }
}
