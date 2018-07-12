import { inject, injectable } from 'inversify';
import { IBlockLogic } from '../../ioc/interfaces/logic';
import { Symbols } from '../../ioc/symbols';
import { SignedAndChainedBlockType } from '../../logic';
import { RawFullBlockListType } from '../../types/rawDBTypes';
import { BaseRequest } from './BaseRequest';

export type GetBlocksRequestDataType = { blocks: SignedAndChainedBlockType[] | RawFullBlockListType[] };

@injectable()
export class GetBlocksRequest extends BaseRequest<GetBlocksRequestDataType, void> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;

  public getResponseData(res) {
    if (this.peerSupportsProtoBuf(res.peer)) {
      const rawRes = this.decodeProtoBufResponse(res, 'transportBlocks') as any;
      if (typeof rawRes.blocks === 'undefined' || rawRes.blocks === null) {
        rawRes.blocks = [];
      } else {
        rawRes.blocks = rawRes.blocks.map((b) => this.blockLogic.fromBytes(b));
      }
      return rawRes;
    } else {
      return res.body;
    }
  }

  protected getBaseUrl(isProtoBuf) {
    const queryString = this.getQueryString();
    return isProtoBuf ? `/v2/peer/blocks${queryString}` : `/peer/blocks${queryString}`;
  }
}
