import { injectable } from 'inversify';
import {allBuffersToHex, MyConvOptions } from '../../helpers';
import { BaseRequest } from './BaseRequest';

export type GetSignaturesRequestDataType = {
  signatures: Array<{
    transaction: string,
    signatures?: Buffer[],
  }>
};

@injectable()
export class GetSignaturesRequest extends BaseRequest<GetSignaturesRequestDataType, any> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  public getResponseData(res) {
    if (this.peerSupportsProtoBuf(res.peer)) {
      const rawRes = this.decodeProtoBufResponse(res, 'transportSignatures', 'getSignaturesResponse');
      return rawRes;
    } else {
      return res.body;
    }
  }

  protected getConversionOptions(): MyConvOptions<GetSignaturesRequestDataType> {
    return {
      ...super.getConversionOptions(),
      bytes: Buffer,
      longs: String,
      postProcess: allBuffersToHex,
    };
  }

  protected getBaseUrl(isProtoBuf) {
    return isProtoBuf ? '/v2/peer/signatures' : '/peer/signatures';
  }
}
