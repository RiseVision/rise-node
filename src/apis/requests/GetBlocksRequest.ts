import { inject, injectable } from 'inversify';
import { IBlockLogic } from '../../ioc/interfaces/logic';
import { Symbols } from '../../ioc/symbols';
import { SignedAndChainedBlockType } from '../../logic';
import { BaseRequest } from './BaseRequest';

// tslint:disable-next-line
export type GetBlocksRequestDataType = { blocks: SignedAndChainedBlockType[]};

@injectable()
export class GetBlocksRequest extends BaseRequest<GetBlocksRequestDataType, void> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.modules.blocksSubModules.utils)
  private blocksUtilsModule;

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
      const blocks = this.blocksUtilsModule.readDbRows(res.body.blocks);
      return { blocks };
    }
  }

  protected getBaseUrl(isProtoBuf) {
    const queryString = this.getQueryString();
    return isProtoBuf ? `/v2/peer/blocks${queryString}` : `/peer/blocks${queryString}`;
  }
}
