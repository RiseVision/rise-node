import { inject, injectable } from 'inversify';
import { IBlockLogic, ITransactionLogic } from '../../ioc/interfaces/logic';
import { IBlocksModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { IBytesBlock, SignedBlockType } from '../../logic';
import { IBaseTransaction, IBytesTransaction } from '../../logic/transactions';
import { BlocksModel, TransactionsModel } from '../../models';
import { BaseRequest } from './BaseRequest';

// tslint:disable-next-line
export type PostBlocksRequestDataType = { block: SignedBlockType<Buffer> };

@injectable()
export class PostBlocksRequest extends BaseRequest<any, PostBlocksRequestDataType> {
  protected readonly method = 'POST';
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

  public getRequestOptions(peerSupportsProto) {
    const reqOptions = super.getRequestOptions(peerSupportsProto);
    if (peerSupportsProto) {
      if (this.protoBufHelper.validate(reqOptions.data, 'transportBlocks', 'transportBlock')) {
        const newData = {
          ...reqOptions.data,
          block: this.generateBytesBlock(reqOptions.data.block as BlocksModel),
        };
        reqOptions.data =
          this.protoBufHelper.encode(newData, 'transportBlocks', 'transportBlock') as any;
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
    } else {
      reqOptions.data.block = this.blocksModel.toStringBlockType(
        reqOptions.data.block ,
        this.transactionsModel,
        this.blocksModule
      ) as any;
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

  protected getBaseUrl(isProto) {
    return isProto ? '/v2/peer/blocks' : '/peer/blocks';
  }

  private generateBytesTransaction(tx: IBaseTransaction<any>): IBytesTransaction {
    return {
      bytes                : this.transactionLogic.getBytes(tx),
      fee                  : tx.fee,
      hasRequesterPublicKey: typeof tx.requesterPublicKey !== 'undefined' && tx.requesterPublicKey != null,
      hasSignSignature     : typeof tx.signSignature !== 'undefined' && tx.signSignature != null,
    };
  }

  private generateBytesBlock(block: BlocksModel): IBytesBlock {
    return {
      bytes       : this.blockLogic.getBytes(block),
      height      : block.height,
      transactions: block.transactions.map((tx) => this.generateBytesTransaction(tx)),
    };
  }
}
