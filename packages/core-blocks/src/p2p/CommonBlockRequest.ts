import { Symbols } from '@risevision/core-interfaces';
import { inject, injectable } from 'inversify';
import { BaseRequest } from '@risevision/core-p2p';

// tslint:disable-next-line
export type CommonBlockRequestDataType = { common: { id: string, previousBlock: string, height: number } };

@injectable()
export class CommonBlockRequest extends BaseRequest<CommonBlockRequestDataType, void> {
  protected readonly method: 'GET'             = 'GET';
  protected readonly supportsProtoBuf: boolean = true;

  @inject(Symbols.logic.block)
  private blockLogic;

  public getResponseData(res) {
    if (this.peerSupportsProtoBuf(res.peer)) {
      const rawRes = this.decodeProtoBufResponse(res);
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

  protected decodeProtoBufValidResponse(buf: Buffer) {
    return this.protoBufHelper.decode(buf, 'blocks.transport', 'commonBlock');
  }
}
