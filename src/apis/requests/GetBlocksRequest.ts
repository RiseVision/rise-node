import { BaseRequest } from './BaseRequest';

export class GetBlocksRequest extends BaseRequest {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  public getResponseData(res) {
    return this.isProtoBuf() ? this.decodeProtoBufResponse(res, 'transportBlocks') : res.body;
  }

  protected getBaseUrl() {
    const queryString = this.getQueryString();
    return this.isProtoBuf() ? `/v2/peer/blocks${queryString}` : `/peer/blocks${queryString}`;
  }
}
