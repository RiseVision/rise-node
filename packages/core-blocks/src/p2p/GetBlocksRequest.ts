import { IBlockLogic, Symbols } from '@risevision/core-interfaces';
import { BaseRequest } from '@risevision/core-p2p';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';

// tslint:disable-next-line
export type GetBlocksRequestDataType = { blocks: SignedAndChainedBlockType[]};

@injectable()
export class GetBlocksRequest extends BaseRequest<GetBlocksRequestDataType, void> {
  protected readonly method: 'GET' = 'GET';
  protected readonly supportsProtoBuf = true;
  protected readonly baseUrl = '/v2/peer/blocks';

  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;

  protected decodeProtoBufValidResponse(buf: Buffer) {
    const {blocks} = this.protoBufHelper.decode<{blocks: Buffer[]}>(buf, 'blocks.transport', 'transportBlocks');
    return {
      blocks: blocks.map((b) => this.blockLogic.fromProtoBuffer(b)),
    };
  }
}
