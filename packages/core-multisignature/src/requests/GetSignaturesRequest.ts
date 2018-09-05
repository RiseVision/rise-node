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
  protected readonly method: 'GET'    = 'GET';
  protected readonly supportsProtoBuf = true;
  protected readonly baseUrl          = '/v2/peer/signatures';

  protected decodeProtoBufValidResponse(res: Buffer) {
    return this.protoBufHelper.decodeToObj(
      res,
      'multisig',
      'getSignaturesResponse',
      { longs: String }
    );
  }
}
