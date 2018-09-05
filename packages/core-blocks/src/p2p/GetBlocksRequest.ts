import { inject, injectable } from 'inversify';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { IBlockLogic, Symbols } from '@risevision/core-interfaces';
import { BaseRequest } from '@risevision/core-p2p';

// tslint:disable-next-line
export type GetBlocksRequestDataType = { blocks: SignedAndChainedBlockType[]};

@injectable()
export class GetBlocksRequest extends BaseRequest<GetBlocksRequestDataType, void> {
  protected readonly method: 'GET' = 'GET';
  protected readonly supportsProtoBuf = true;

// TODO: How to migrate this?
  // @inject(Symbols.modules.blocksSubModules.utils)
  private blocksUtilsModule;

  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;

  public getResponseData(res) {
    if (this.peerSupportsProtoBuf(res.peer)) {
      const rawRes: {blocks: Buffer[]} = this.decodeProtoBufResponse(res) as any;
      if (typeof rawRes.blocks === 'undefined' || rawRes.blocks === null) {
        return { blocks: [] };
      } else {
        return {
          blocks: rawRes.blocks
            .map((b) => this.blockLogic.fromProtoBuffer(b)),
        };
      }
    } else {
      const blocks = this.blocksUtilsModule.readDbRows(res.body.blocks);
      return { blocks };
    }
  }

  protected getBaseUrl(isProtoBuf) {
    const queryString = this.getQueryString();
    return isProtoBuf ? `/v2/peer/blocks${queryString}` : `/peer/blocks${queryString}`;
  }

  protected decodeProtoBufValidResponse(buf: Buffer) {
    return this.protoBufHelper.decode(buf, 'blocks.transport', 'transportBlocks');
  }
}
