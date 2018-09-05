import { IBlockLogic, Symbols } from '@risevision/core-interfaces';
import { BaseRequest, RequestFactoryType } from '@risevision/core-p2p';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';

// tslint:disable-next-line
export type PostBlockRequestDataType = { block: SignedAndChainedBlockType };

@injectable()
export class PostBlockRequest extends BaseRequest<{ blockId: string }, PostBlockRequestDataType> {
  protected readonly method: 'POST'   = 'POST';
  protected readonly supportsProtoBuf = true;
  protected readonly baseUrl          = '/v2/peer/blocks';

  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;

  protected encodeRequestData(data: PostBlockRequestDataType): Buffer {
    return this.protoBufHelper.encode(
      {
        block: this.blockLogic.toProtoBuffer(data.block),
      },
      'blocks.transport',
      'transportBlock'
    );
  }

  protected decodeProtoBufValidResponse(res: Buffer) {
    return this.protoBufHelper.decode(res, 'blocks.transport', 'transportBlockResponse');
  }
}
