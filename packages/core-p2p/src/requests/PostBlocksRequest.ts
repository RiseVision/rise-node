import { inject, injectable } from 'inversify';
import { IBlockLogic, ITransactionLogic } from '../../ioc/interfaces/logic';
import { IBlocksModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { IBytesBlock, SignedBlockType } from '../../logic';
import { BlocksModel, TransactionsModel } from '../../models';
import { BaseRequest } from './BaseRequest';
import { requestSymbols } from './requestSymbols';
import { RequestFactoryType } from './requestFactoryType';
import { PostTransactionsRequest, PostTransactionsRequestDataType } from './PostTransactionsRequest';

// tslint:disable-next-line
export type PostBlocksRequestDataType = { block: SignedBlockType<Buffer> };

@injectable()
export class PostBlocksRequest extends BaseRequest<any, PostBlocksRequestDataType> {
  protected readonly method           = 'POST';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;
  @inject(Symbols.models.blocks)
  private blocksModel: typeof BlocksModel;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.models.transactions)
  private transactionsModel: typeof TransactionsModel;
  @inject(requestSymbols.postTransactions)
  private ptrFactory: RequestFactoryType<PostTransactionsRequestDataType, PostTransactionsRequest>;

  public getRequestOptions(peerSupportsProto) {
    const reqOptions = super.getRequestOptions(peerSupportsProto);
    if (peerSupportsProto) {
      if (this.protoBufHelper.validate(this.options.data, 'transportBlocks', 'transportBlock')) {
        const newData   = {
          ...this.options.data,
          block: this.generateBytesBlock(this.options.data.block),
        };
        reqOptions.data =
          this.protoBufHelper.encode(newData, 'transportBlocks', 'transportBlock') as any;
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
    } else {
      reqOptions.data = {
        block: this.blocksModel.toStringBlockType(
          this.options.data.block,
          this.transactionsModel,
          this.blocksModule
        ) as any,
      };
    }
    return reqOptions;
  }

  public getResponseData(res) {
    if (this.peerSupportsProtoBuf(res.peer)) {
      return this.decodeProtoBufResponse(res, 'transportBlocks', 'transportBlockResponse');
    } else {
      return res.body;
    }
  }

  public generateBytesBlock(block: SignedBlockType & { relays?: number}): IBytesBlock {
    const tmpTrxReq = this.ptrFactory({data: null});
    return {
      bytes       : this.blockLogic.getBytes(block),
      height      : block.height,
      relays      : Number.isInteger(block.relays) ? block.relays : 1,
      transactions: (block.transactions || []).map((tx) => tmpTrxReq.generateBytesTransaction(tx)),
    };
  }

  protected getBaseUrl(isProto) {
    return isProto ? '/v2/peer/blocks' : '/peer/blocks';
  }
}
