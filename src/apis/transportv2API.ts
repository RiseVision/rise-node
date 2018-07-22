import { Request } from 'express';
import { inject, injectable } from 'inversify';
import * as Long from 'long';
import { Body, ContentType, Controller, Get, Post, QueryParam, Req, UseBefore } from 'routing-controllers';
import { Op } from 'sequelize';
import * as z_schema from 'z-schema';
import { Bus, constants as constantsType, ProtoBufHelper, } from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { assertValidSchema, SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { IBlockLogic, IPeersLogic, ITransactionLogic } from '../ioc/interfaces/logic';
import {
  IBlocksModule,
  IBlocksModuleUtils,
  IPeersModule,
  ITransactionsModule,
  ITransportModule
} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { IBytesBlock, SignedAndChainedBlockType } from '../logic';
import { IBaseTransaction, IBytesTransaction } from '../logic/transactions';
import { BlocksModel, TransactionsModel } from '../models';
import transportSchema from '../schema/transport';
import { APIError } from './errors';
import { AttachPeerHeaders } from './utils/attachPeerHeaders';
import { ValidatePeerHeaders } from './utils/validatePeerHeaders';

@Controller('/v2/peer')
@injectable()
@IoCSymbol(Symbols.api.transportV2)
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
  @inject(Symbols.modules.blocksSubModules.utils)
  private blocksModuleUtils: IBlocksModuleUtils;
  @inject(Symbols.helpers.bus)
  private bus: Bus;
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;
  @inject(Symbols.helpers.protoBuf)
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
  @inject(Symbols.models.blocks)
  private BlocksModel: typeof BlocksModel;

  @Get('/list')
  public async list() {
    const { peers } = await this.peersModule.list({ limit: this.constants.maxPeers });
    return this.getResponse({ peers }, 'transportPeers');
  }

  @Get('/signatures')
  public signatures() {
    const txs: Array<IBaseTransaction<any>> = this.transactionsModule
      .getMultisignatureTransactionList(true, this.constants.maxSharedTxs);
    const signatures                        = [];
    for (const tx of txs) {
      if (tx.signatures && tx.signatures.length > 0) {
        signatures.push({
          signatures : tx.signatures.map((sig) => {
            return Buffer.from(sig, 'hex');
          }),
          transaction: Long.fromString(tx.id),
        });
      }
    }
    return this.getResponse({ signatures }, 'transportSignatures', 'getSignaturesResponse');
  }

  @Post('/signatures')
  public async postSignatures(@Body() body: Buffer) {
    // tslint:disable-next-line
    type Signature = { transaction: Long, signature?: Buffer };
    const obj = this.parseRequest<{ signatures?: Signature[], signature?: Signature }>
    (body, 'transportSignatures', 'postSignatures');

    const signatures: Signature[] = [];

    if (Array.isArray(obj.signatures)) {
      signatures.push(...obj.signatures);
    }

    if (typeof(obj.signature) !== 'undefined' && obj.signature !== null) {
      signatures.push(obj.signature);
    }

    assertValidSchema(this.schema, signatures, {
      obj : transportSchema.signatures.properties.signatures,
      opts: { errorString: 'Error validating schema.' },
    });

    const finalSigs: Array<{ signature: string, transaction: string }> = [];
    for (const sigEl of signatures) {
      finalSigs.push({
        signature  : sigEl.signature.toString('hex'),
        transaction: sigEl.transaction.toString(),
      });
    }

    await this.transportModule.receiveSignatures(finalSigs);

    return this.getResponse({ success: true }, 'APISuccess');
  }

  @Get('/transactions')
  public transactions() {
    const transactions                 = this.transactionsModule.getMergedTransactionList(this.constants.maxSharedTxs);
    const byteTxs: IBytesTransaction[] = transactions.map((tx) => this.generateBytesTransaction(tx));
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
          TransactionsModel.toTransportTransaction(this.transactionLogic.fromBytes(tx), this.blocksModule)
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
      throw new APIError('Invalid block id sequence', 200);
    }

    const common     = await this.BlocksModel.findOne({
      limit: 1,
      order: [['height', 'DESC']],
      raw  : true,
      where: { id: { [Op.in]: excapedIds } },
    });
    const bytesBlock = common !== null ? this.generateBytesBlock(common) : null;
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
    await this.bus.message('receiveBlock', normalizedBlock);
    return this.getResponse({ success: true, blockId: normalizedBlock.id },
      'transportBlocks', 'transportBlockResponse');
  }

  @Get('/blocks')
  @ValidateSchema()
  public async getBlocks(@SchemaValid(transportSchema.blocks.properties.lastBlockId)
                         @QueryParam('lastBlockId') lastBlockId: string) {
    // TODO define number of blocks to get per response dynamically, based on max payload size and lastBlockId
    const dbBlocks = await this.blocksModuleUtils.loadBlocksData({
      lastId: lastBlockId,
      limit : 2000,
    });
    const blocks   = await Promise.all(dbBlocks
      .map(async (block): Promise<IBytesBlock> => this.generateBytesBlock(block)));
    return this.getResponse({ blocks }, 'transportBlocks');
  }

  private getResponse(payload: any, pbNamespace: string, pbMessageType?: string) {
    if (this.protoBuf.validate(payload, pbNamespace, pbMessageType)) {
      return this.protoBuf.encode(payload, pbNamespace, pbMessageType);
    } else {
      throw new Error('Failed to encode response - ' + this.protoBuf.lastError);
    }
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
    const bb = {
      bytes       : this.blockLogic.getBytes(block),
      height      : block.height,
      transactions: [],
    };
    if (block.transactions) {
      bb.transactions = block.transactions.map((tx) => this.generateBytesTransaction(tx));
    }
    return bb;
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
