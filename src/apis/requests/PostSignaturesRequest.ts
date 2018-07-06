import { BaseRequest } from './BaseRequest';
import { injectable } from 'inversify';

export type PostSignaturesRequestDataType = {
  signatures: Array<{
    transaction: string,
    signatures: Buffer[]
  }>
};

@injectable()
export class PostSignaturesRequest extends BaseRequest<any, PostSignaturesRequestDataType> {
  protected readonly method = 'POST';
  protected readonly supportsProtoBuf = true;
  public getRequestOptions() {
    const reqOptions = super.getRequestOptions();
    if (this.isProtoBuf()) {
      if (this.protoBufHelper.validate(reqOptions.data, 'transportSignatures')) {
        reqOptions.data = this.protoBufHelper.encode(reqOptions.data, 'transportSignatures') as any;
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
    } else {
      reqOptions.data.signatures = reqOptions.data.signatures.map((s) => {
        s.signatures = s.signatures.map((ss) => ss.toString('hex')) as any;
        return s;
      });
    }
    return reqOptions;
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/signatures' : '/peer/signatures';
  }


}
