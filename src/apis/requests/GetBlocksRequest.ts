import { BaseRequest } from './BaseRequest';
import { injectable } from 'inversify';

@injectable()
export class GetBlocksRequest extends BaseRequest<void, void> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  public getResponseData(res) {
    return this.peerSupportsProtoBuf(res.peer) ? this.decodeProtoBufResponse(res, 'transportBlocks') : res.body;
  }

  protected getBaseUrl(isProtoBuf) {
    const queryString = this.getQueryString();
    return isProtoBuf ? `/v2/peer/blocks${queryString}` : `/peer/blocks${queryString}`;
  }
}
