import { Request } from 'express';
import { inject, injectable, named } from 'inversify';
import { ContentType, Controller, Get, Post, QueryParam, Req, UseBefore } from 'routing-controllers';
import { Op } from 'sequelize';
import * as z_schema from 'z-schema';
import { p2pSymbols, ProtoBufHelper, } from '../helpers';
import { HTTPError, IoCSymbol, SchemaValid, ValidateSchema } from '@risevision/core-utils';
import {
  IBlockLogic,
  IBlocksModel,
  IBlocksModule,
  IPeersLogic,
  IPeersModule,
  ITransactionLogic,
  ITransactionsModel,
  ITransactionsModule,
  ITransportModule,
  Symbols
} from '@risevision/core-interfaces';
import { ValidatePeerHeaders } from './validatePeerHeaders';
import { AttachPeerHeaders } from './attachPeerHeaders';
import { ConstantsType, IBytesBlock, IBytesTransaction, SignedAndChainedBlockType } from '@risevision/core-types';
import { ModelSymbols } from '@risevision/core-models';
import {
  PostBlocksRequest,
  PostBlocksRequestDataType,
  PostTransactionsRequest,
  PostTransactionsRequestDataType
} from '../requests/';
import { RequestFactoryType } from '../utils';

const transportSchema = require('../../schema/transport.json');

@Controller('/v2/peer')
@injectable()
@IoCSymbol(p2pSymbols.api.transportV2)
@UseBefore(ValidatePeerHeaders)
@UseBefore(AttachPeerHeaders)
@ContentType('application/octet-stream')
export class TransportV2API {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  // @inject(Symbols.modules.blocksSubModules.utils)
  // private blocksModuleUtils: IBlocksModuleUtils;
  // @inject(Symbols.helpers.bus)
  // private bus: Bus;
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(p2pSymbols.helpers.protoBuf)
  private protoBuf: ProtoBufHelper;
  @inject(Symbols.logic.peers)
  private peersLogic: IPeersLogic;
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.modules.transport)
  private transportModule: ITransportModule;

  // models
  @inject(ModelSymbols.model)
  @named(Symbols.models.blocks)
  private BlocksModel: typeof IBlocksModel;
  @inject(Symbols.models.transactions)
  @named(Symbols.models.transactions)
  private TransactionsModel: typeof ITransactionsModel;

  @inject(p2pSymbols.requests.postBlocks)
  private pblocksFactory: RequestFactoryType<PostBlocksRequestDataType, PostBlocksRequest>;
  @inject(p2pSymbols.requests.postTransactions)
  private ptFactory: RequestFactoryType<PostTransactionsRequestDataType, PostTransactionsRequest>;

  @Get('/list')
  public async list() {
    const { peers } = await this.peersModule.list({ limit: this.constants.maxPeers });
    return this.getResponse({ peers }, 'transportPeers');
  }

  // TODO: Move in multisignatures.
  // @Get('/signatures')
  // public signatures() {
  //   const txs: Array<IBaseTransaction<any>> = this.transactionsModule
  //     .getMultisignatureTransactionList(true, this.constants.maxSharedTxs);
  //   const signatures                        = [];
  //   for (const tx of txs) {
  //     if (tx.signatures && tx.signatures.length > 0) {
  //       signatures.push({
  //         signatures : tx.signatures.map((sig) => {
  //           return Buffer.from(sig, 'hex');
  //         }),
  //         transaction: Long.fromString(tx.id),
  //       });
  //     }
  //   }
  //   return this.getResponse({ signatures }, 'transportSignatures', 'getSignaturesResponse');
  // }

  // @Post('/signatures')
  // public async postSignatures(@Body() body: Buffer) {
  //   // tslint:disable-next-line
  //   type Signature = { transaction: Long, signature?: Buffer };
  //   const obj = this.parseRequest<{ signatures?: Signature[], signature?: Signature }>
  //   (body, 'transportSignatures', 'postSignatures');
  //
  //   const signatures: Signature[] = [];
  //
  //   if (Array.isArray(obj.signatures)) {
  //     signatures.push(...obj.signatures);
  //   }
  //
  //   if (typeof(obj.signature) !== 'undefined' && obj.signature !== null) {
  //     signatures.push(obj.signature);
  //   }
  //
  //   assertValidSchema(this.schema, signatures, {
  //     obj : transportSchema.signatures.properties.signatures,
  //     opts: { errorString: 'Error validating schema.' },
  //   });
  //
  //   const finalSigs: Array<{ signature: string, transaction: string }> = [];
  //   for (const sigEl of signatures) {
  //     finalSigs.push({
  //       signature  : sigEl.signature.toString('hex'),
  //       transaction: sigEl.transaction.toString(),
  //     });
  //   }
  //
  //   await this.transportModule.receiveSignatures(finalSigs);
  //
  //   return this.getResponse({ success: true }, 'APISuccess');
  // }

  @Get('/transactions')
  public transactions() {
    const transactions                 = this.transactionsModule.getMergedTransactionList(this.constants.maxSharedTxs);
    const tmpPT                        = this.ptFactory({ data: { transactions } });
    const byteTxs: IBytesTransaction[] = transactions
      .map((tx) => tmpPT.generateBytesTransaction(tx))
      .map((bt) => {
        delete bt.relays;
        return bt;
      });
    return this.getResponse({ transactions: byteTxs }, 'transportTransactions');
  }

  @Post('/transactions')
  public async postTransactions(@Req() req: Request) {
    let transactions  = [];
    const requestData = this.parseRequest<any>(req.body, 'transportTransactions');
    if (typeof requestData.transaction !== 'undefined' && requestData.transaction !== null) {
      transactions = [requestData.transaction];
    } else {
      transactions = requestData.transactions ? requestData.transactions : [];
    }
    const thePeer = this.peersLogic.create({
      ip  : req.ip,
      port: parseInt(req.headers.port as string, 10),
    });

    if (transactions.length > 0) {
      await this.transportModule.receiveTransactions(transactions.map(
        (tx: IBytesTransaction) =>
          this.TransactionsModel.toTransportTransaction(this.transactionLogic.fromBytes(tx))
      ), thePeer, true);
    }

    return this.getResponse({ success: true }, 'APISuccess');
  }

  @Get('/blocks/common')
  @ValidateSchema()
  public async getBlocksCommon(@SchemaValid(transportSchema.commonBlock.properties.ids)
                               @QueryParam('ids') ids: string,
                               @Req() req: Request) {
    const excapedIds = ids
    // Remove quotes
      .replace(/['"]+/g, '')
      // Separate by comma into an array
      .split(',')
      // Reject any non-numeric values
      .filter((id) => /^[0-9]+$/.test(id));
    if (excapedIds.length === 0 || excapedIds.length > 10) {
      this.peersModule.remove(req.ip, parseInt(req.headers.port as string, 10));
      throw new HTTPError('Invalid block id sequence', 200);
    }

    const common = await this.BlocksModel.findOne({
      limit: 1,
      order: [['height', 'DESC']],
      raw  : true,
      where: { id: { [Op.in]: excapedIds } },
    });

    const tmpPB      = this.pblocksFactory({ data: { block: common } });
    const bytesBlock = common !== null ? tmpPB.generateBytesBlock(common) : null;
    return this.getResponse({ common: bytesBlock }, 'transportBlocks', 'commonBlock');
  }

  @Post('/blocks')
  public async postBlock(@Req() req: Request) {
    let normalizedBlock: SignedAndChainedBlockType;
    try {
      const requestData = this.parseRequest<any>(req.body, 'transportBlocks', 'transportBlock');
      normalizedBlock   = this.blockLogic.objectNormalize(this.blockLogic.fromBytes(requestData.block));
    } catch (e) {
      this.peersModule.remove(req.ip, parseInt(req.headers.port as string, 10));
      throw e;
    }
    // TODO:
    // await this.bus.message('receiveBlock', normalizedBlock);
    return this.getResponse({ success: true, blockId: normalizedBlock.id },
      'transportBlocks', 'transportBlockResponse');
  }

  @Get('/blocks')
  @ValidateSchema()
  public async getBlocks(@SchemaValid(transportSchema.blocks.properties.lastBlockId)
                         @QueryParam('lastBlockId') lastBlockId: string) {
    // Get the block by ID
    const lastBlock = await this.BlocksModel.findOne({
      raw  : true,
      where: { id: lastBlockId },
    });
    if (lastBlock != null) {
      const blocksToLoad = await this.calcNumBlocksToLoad(lastBlock);
      // TODO: fix blocksmodule
      const dbBlocks     = [];
      // const dbBlocks = await this.blocksModuleUtils.loadBlocksData({
      //   lastId: lastBlockId,
      //   limit : blocksToLoad,
      // });
      const tmpPB  = this.pblocksFactory({ data: null });
      const blocks = await Promise.all(dbBlocks
        .map(async (block): Promise<IBytesBlock> => tmpPB.generateBytesBlock(block)));
      return this.getResponse({ blocks }, 'transportBlocks');
    } else {
      throw new Error(`Block ${lastBlockId} not found!`);
    }
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

  private getResponse(payload: any, pbNamespace: string, pbMessageType?: string) {
    if (this.protoBuf.validate(payload, pbNamespace, pbMessageType)) {
      return this.protoBuf.encode(payload, pbNamespace, pbMessageType);
    } else {
      throw new Error('Failed to encode response - ' + this.protoBuf.lastError);
    }
  }

  private parseRequest<T>(body: Buffer, pbNamespace: string, pbMessageType?: string): T {
    if (!Buffer.isBuffer(body)) {
      throw new Error('No binary data in request body');
    }
    let retVal: T;
    try {
      retVal = this.protoBuf.decode<T>(body, pbNamespace, pbMessageType);
    } catch (e) {
      throw new Error(`Invalid binary data for message ${pbNamespace} ${pbMessageType}`);
    }
    return retVal;
  }
}
