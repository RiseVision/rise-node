import { BaseRequest } from './BaseRequest';
import { injectable } from 'inversify';
import * as Long from 'long';

export type PostSignaturesRequestDataType = {
  signatures: Array<{
    transaction: string,
    signature?: Buffer,
    signatures?: Buffer[],
  }>
};

@injectable()
export class PostSignaturesRequest extends BaseRequest<any, PostSignaturesRequestDataType> {
  protected readonly method = 'POST';
  protected readonly supportsProtoBuf = true;
  public getRequestOptions() {
    const reqOptions = super.getRequestOptions();
    if (this.isProtoBuf()) {
      reqOptions.data.signatures = reqOptions.data.signatures.map((sig) => {
        sig.transaction = Long.fromString(sig.transaction, true) as any;
        return sig;
      }) as any;
      if (this.protoBufHelper.validate(reqOptions.data, 'transportSignatures')) {
        reqOptions.data = this.protoBufHelper.encode(reqOptions.data, 'transportSignatures') as any;
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
    } else {
      reqOptions.data.signatures = reqOptions.data.signatures.map((s) => {
        if (typeof s.signature !== 'undefined') {
          s.signature = s.signature.toString('hex') as any;
        }
        if (typeof s.signatures !== 'undefined') {
          s.signatures = s.signatures.map((sig) => sig.toString('hex')) as any;
        }
        return s;
      });
    }
    return reqOptions;
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/signatures' : '/peer/signatures';
  }


}
