import { BaseRequest } from './BaseRequest';
import { injectable } from 'inversify';
import { SignedBlockType } from '../../logic';

export type PostBlocksRequestDataType = { block: SignedBlockType<Buffer> };

// TODO: Convert to SignedBlockType<string> in case of nonprotobuf call
@injectable()
export class PostBlocksRequest extends BaseRequest<PostBlocksRequestDataType, void> {
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
