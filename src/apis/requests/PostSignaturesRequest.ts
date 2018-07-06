import { BaseRequest } from './BaseRequest';
import { injectable } from 'inversify';

export type PostSignaturesRequestDataType = {
  signatures: Array<{
    transaction: string,
    signatures: Buffer[]
  }>
};
@injectable()
export class PostSignaturesRequest extends BaseRequest<PostSignaturesRequestDataType, void> {
  protected readonly method = 'POST';
  protected readonly supportsProtoBuf = true;
  public getRequestOptions() {
    const reqOptions = super.getRequestOptions();
    if (this.isProtoBuf()) {
      if (this.protoBufHelper.validate(reqOptions.data, 'transportSignatures')) {
        reqOptions.data = this.protoBufHelper.encode(reqOptions.data, 'transportSignatures');
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
