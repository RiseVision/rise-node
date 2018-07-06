import { BaseRequest } from './BaseRequest';
import { injectable } from 'inversify';

@injectable()
export class GetSignaturesRequest extends BaseRequest<void, void> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  public getResponseData(res) {
    return this.isProtoBuf() ? this.decodeProtoBufResponse(res, 'transportSignatures') : res.body;
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/signatures' : '/peer/signatures';
  }
}
