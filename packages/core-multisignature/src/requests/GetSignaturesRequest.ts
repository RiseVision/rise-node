import { BaseRequest, MyConvOptions } from '@risevision/core-p2p';
import { injectable } from 'inversify';

// tslint:disable-next-line
export type GetSignaturesRequestDataType = {
  signatures: Array<{
    transaction: string,
    signatures?: Buffer[],
  }>
};

@injectable()
export class GetSignaturesRequest extends BaseRequest<GetSignaturesRequestDataType, any> {
  protected readonly method: 'GET' = 'GET';
  protected readonly supportsProtoBuf = true;

  public getResponseData(res) {
    if (this.peerSupportsProtoBuf(res.peer)) {
      return this.decodeProtoBufResponse(res, 'transportSignatures', 'getSignaturesResponse');
    } else {
      return res.body;
    }
  }

  protected getConversionOptions(): MyConvOptions<GetSignaturesRequestDataType> {
    return {
      ...super.getConversionOptions(),
      bytes: Buffer,
      longs: String,
      // postProcess: allBuffersToHex, // TODO: Check me?
    };
  }

  protected getBaseUrl(isProtoBuf) {
    return isProtoBuf ? '/v2/peer/signatures' : '/peer/signatures';
  }
}
