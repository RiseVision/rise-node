import { inject, injectable } from 'inversify';
import { Symbols } from '../../ioc/symbols';
import { BaseRequest } from './BaseRequest';

@injectable()
export class CommonBlockRequest extends BaseRequest<{ common: { id: string, previousBlock: string, height: number } }, void> {
  protected readonly method                    = 'GET';
  protected readonly supportsProtoBuf: boolean = true;

  @inject(Symbols.logic.block)
  private blockLogic;

  public getResponseData(res) {
    if (this.peerSupportsProtoBuf(res.peer)) {
      const rawRes = this.decodeProtoBufResponse(res, 'transportBlocks', 'commonBlock');
      rawRes.common = (typeof rawRes.common !== 'undefined') ? this.blockLogic.fromBytes(rawRes.common) : null;
      return rawRes;
    } else {
      return res.body;
    }
  }

  protected getBaseUrl(isProto) {
    const queryString = this.getQueryString();
    return isProto ? `/v2/peer/blocks/common${queryString}` : `/peer/blocks/common${queryString}`;
  }
}
