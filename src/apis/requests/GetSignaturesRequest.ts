import { BaseRequest } from './BaseRequest';
import { injectable } from 'inversify';


export type GetSignaturesRequestDataType = {
  signatures: Array<{
    transaction: string,
    signature?: Buffer,
    signatures?: Buffer[],
  }>
};

@injectable()
export class GetSignaturesRequest extends BaseRequest<GetSignaturesRequestDataType, any> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  public getResponseData(res) {
    if (this.isProtoBuf()) {
      const rawRes = this.decodeProtoBufResponse(res, 'transportSignatures');
      if (typeof rawRes.signatures !== 'undefined') {
        rawRes.signatures = rawRes.signatures.map((s) => {
          if (typeof s.signature !== 'undefined') {
            s.signature = s.signature.toString('hex') as any;
          }
          if (typeof s.signatures !== 'undefined') {
            s.signatures = s.signatures.map((sig) => sig.toString('hex')) as any;
          }
          s.transaction = s.transaction.toString() as any;
          return s;
        });
      }
      return rawRes;
    } else {
      return res.body;
    }
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/signatures' : '/peer/signatures';
  }
}
