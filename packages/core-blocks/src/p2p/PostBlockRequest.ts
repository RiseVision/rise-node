import {
  IBlockLogic,
  IBlocksModel,
  IBlocksModule,
  ITransactionLogic,
  Symbols
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { BaseRequest, RequestFactoryType } from '@risevision/core-p2p';
import { SignedAndChainedBlockType, SignedBlockType } from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';

// tslint:disable-next-line
export type PostBlockRequestDataType = { block: SignedAndChainedBlockType };

@injectable()
export class PostBlockRequest extends BaseRequest<any, PostBlockRequestDataType> {
  protected readonly method: 'POST'   = 'POST';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;
  @inject(ModelSymbols.model)
  @named(Symbols.models.blocks)
  private blocksModel: typeof IBlocksModel;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  public getRequestOptions(peerSupportsProto) {
    const reqOptions = super.getRequestOptions(peerSupportsProto);
    if (peerSupportsProto) {
      const block = this.blockLogic.toProtoBuffer(this.options.data.block);
      reqOptions.data = this.protoBufHelper
        .encode({ block }, 'blocks.transport', 'transportBlock') as any;
    } else {
      reqOptions.data = {
        block: this.blocksModel.toStringBlockType(this.options.data.block) as any,
      };
    }
    return reqOptions;
  }

  protected getBaseUrl(isProto) {
    return isProto ? '/v2/peer/blocks' : '/peer/blocks';
  }

  protected decodeProtoBufValidResponse(res: Buffer) {
    return this.protoBufHelper.decode(res, 'blocks.transport', 'transportBlockResponse');
  }
}
