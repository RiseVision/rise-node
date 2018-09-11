import {
  IBlockLogic,
  IBlocksModel,
  IBlocksModule,
  ITransactionLogic,
  ITransactionsModel,
  Symbols
} from '@risevision/core-interfaces';
import { BaseProtobufTransportMethod, SingleTransportPayload } from '@risevision/core-p2p';
import { ConstantsType, SignedAndChainedBlockType } from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import { Op } from 'sequelize';
import { BlocksModuleUtils } from '../modules';
import { BlocksSymbols } from '../blocksSymbols';
import { ModelSymbols } from '@risevision/core-models';

// tslint:disable-next-line
export type GetBlocksRequestDataType = { blocks: SignedAndChainedBlockType[] };

@injectable()
export class GetBlocksRequest extends BaseProtobufTransportMethod<null, { lastBlockId: string }, GetBlocksRequestDataType> {

  public readonly method: 'GET' = 'GET';
  public readonly baseUrl       = '/v2/peer/blocks';

  protected readonly protoResponse = {
    messageType: 'blocks.transport',
    namespace  : 'transportBlocks',
  };

  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;

  @inject(BlocksSymbols.modules.utils)
  private blocksModuleUtils: BlocksModuleUtils;

  @inject(ModelSymbols.model)
  @named(BlocksSymbols.model)
  private BlocksModel: typeof IBlocksModel;
  @inject(ModelSymbols.model)
  @named(BlocksSymbols.model)
  private TransactionsModel: typeof ITransactionsModel;

  @inject(Symbols.generic.constants)
  private constants: ConstantsType;

  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  protected async produceResponse(request: SingleTransportPayload<null, { lastBlockId: string }>): Promise<GetBlocksRequestDataType> {
    const { lastBlockId } = request.query;
    // Get the block by ID
    const lastBlock       = await this.BlocksModel.findOne({
      raw  : true,
      where: { id: lastBlockId },
    });
    if (lastBlock != null) {
      const blocksToLoad = await this.calcNumBlocksToLoad(lastBlock);
      const blocks       = await this.blocksModuleUtils.loadBlocksData({
        lastId: lastBlockId,
        limit : blocksToLoad,
      });
      return { blocks };
    } else {
      throw new Error(`Block ${lastBlockId} not found!`);
    }
  }

  protected encodeResponse(data: GetBlocksRequestDataType): Promise<Buffer> {
    return super.encodeResponse({
      blocks: data.blocks.map((b) => this.blockLogic.toProtoBuffer(b)) as any,
    });
  }

  protected async decodeResponse(res: Buffer): Promise<GetBlocksRequestDataType> {
    const d = await super.decodeResponse(res);
    return {
      blocks: d.blocks.map((b) => this.blockLogic.fromProtoBuffer(b as any)),
    };
  }

  private async calcNumBlocksToLoad(lastBlock: IBlocksModel): Promise<number> {
    // TODO Move me to a constant maybe?
    const maxPayloadSize = 2000000;
    // We take 98% of the theoretical value to allow for some overhead
    const maxBytes       = maxPayloadSize * 0.98;
    // Best case scenario: we find 2MB of empty blocks.
    const maxHeightDelta = Math.ceil(maxBytes / this.blockLogic.getMinBytesSize());
    // We can also limit the number of transactions, with a very rough estimation of the max number of txs that will fit
    // in maxPayloadSize. We assume a stream blocks completely full of the smallest transactions.
    // In RISE the value is about 8000 TXs
    const txLimit = Math.ceil(
      (maxBytes * this.constants.maxTxsPerBlock) /
      (this.transactionLogic.getMinBytesSize() * this.constants.maxTxsPerBlock + this.blockLogic.getMinBytesSize())
    );

    // Get only height and type for all the txs in this height range
    const txsInRange = await this.TransactionsModel.findAll({
      attributes: ['type', 'height'],
      limit     : txLimit,
      order     : [
        ['height', 'ASC'],
      ],
      where     : {
        height: {
          [Op.and]: {
            [Op.gt] : lastBlock.height,
            [Op.lte]: lastBlock.height + maxHeightDelta,
          },
        },
      },
    });

    // Calculate the number of blocks to load
    let blocksToLoad: number;
    if (txsInRange.length > 0) {
      blocksToLoad       = 0;
      let previousHeight = lastBlock.height;
      let blocksSize     = 0;
      let txsSize        = 0;
      for (const tx of txsInRange) {
        // If the size for all txs in previous blocks have been added to total.
        if (previousHeight !== tx.height && blocksSize > 0) {
          if (blocksSize + txsSize <= maxBytes) {
            blocksToLoad++;
          } else {
            // This block doesn't fit, break the cycle
            break;
          }
        }
        const heightDelta = tx.height - previousHeight;
        previousHeight    = tx.height;
        // Add blocks size one by one
        for (let i = 0; i < heightDelta; i++) {
          // First add the empty block's size
          blocksSize += this.blockLogic.getMinBytesSize();
          // If it doesn't fit already, don't increase the number of blocks to load.
          if (blocksSize + txsSize > maxBytes) {
            break;
          } else if (i !== heightDelta) {
            // If this is not the block where this transaction is, it is empty, so we can increase the number now
            blocksToLoad++;
          }
        }
        txsSize += this.transactionLogic.getByteSizeByTxType(tx.type);
      }
      // If arrived here we didn't fill the payload enough, add enough empty blocks
      if (maxBytes - blocksSize - txsSize > this.blockLogic.getMinBytesSize()) {
        blocksToLoad += Math.ceil((maxBytes - blocksSize - txsSize) / this.blockLogic.getMinBytesSize());
      }
    } else {
      blocksToLoad = maxHeightDelta;
    }
    return Math.max(1, blocksToLoad);
  }
}
