import * as Long from 'long';
import { Request, Response } from 'express';
import { inject, injectable } from 'inversify';
import { Body, Controller, Get, Post, QueryParam, Req, Res, UseBefore } from 'routing-controllers';
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
import { AttachPeerHeaders } from './utils/attachPeerHeaders';
import { ValidatePeerHeaders } from './utils/validatePeerHeaders';
import { TransactionsModule } from '../modules';
import { APIError } from './errors';
import { Op } from 'sequelize';

@Controller('/v2/peer')
@injectable()
@IoCSymbol(Symbols.api.transportV2)
@UseBefore(ValidatePeerHeaders)
@UseBefore(AttachPeerHeaders)
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
  public async list(@Res() res: Response) {
    const { peers } = await this.peersModule.list({ limit: this.constants.maxPeers });
    return this.sendResponse(res, { peers }, 'transportPeers');
  }

  @Get('/signatures')
  public signatures(@Res() res: Response) {
    const txs: Array<IBaseTransaction<any>> =
            this.transactionsModule.getMultisignatureTransactionList(true, this.constants.maxSharedTxs);
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
    return this.sendResponse(res, { signatures }, 'transportSignatures');
  }

  @Post('/signatures')
  public async postSignatures(@Req() req: Request, @Res() res: Response) {
    let signatures;
    try {
      signatures = this.parseRequest(req, 'transportSignatures').signatures;
      signatures = signatures.map((sig) =>  {
        if (typeof sig.signature !== 'undefined') {
          sig.signature = sig.signature.toString('hex');
        }
        if (typeof sig.signatures !== 'undefined') {
          sig.signatures = sig.signatures.map((s) => s.toString('hex'));
        }
        sig.transaction = sig.transaction.toString();
        return sig;
      });
      assertValidSchema(this.schema, signatures, {obj: transportSchema.signatures.properties.signatures,
        opts:{errorString: 'Error validating schema.'}});
    } catch (err) {
      return this.error(res, err.message);
    }
    await this.transportModule.receiveSignatures(signatures);
    return this.sendResponse(res, {success: true}, 'APISuccess');
  }

  @Get('/transactions')
  public transactions(@Res() res: Response) {
    const transactions                 = this.transactionsModule.getMergedTransactionList(this.constants.maxSharedTxs);
    const byteTxs: IBytesTransaction[] = transactions.map((tx) => this.generateBytesTransaction(tx));
    return this.sendResponse(res, { transactions: byteTxs }, 'transportTransactions');
  }

  @Post('/transactions')
  public async postTransactions(@Req() req: Request, @Res() res: Response) {
    let transactions = [];
    try {
      const requestData = this.parseRequest(req, 'transportTransactions');
      if (typeof requestData.transaction !== 'undefined' && requestData.transaction !== null) {
        transactions = [requestData.transaction];
      } else {
        transactions = requestData.transactions ? requestData.transactions : [];
      }
    } catch (err) {
      return this.error(res, err.message);
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

    return this.sendResponse(res, {success: true}, 'APISuccess');
  }

  @Get('/blocks/common')
  @ValidateSchema()
  public async getBlocksCommon(@SchemaValid(transportSchema.commonBlock.properties.ids)
                               @QueryParam('ids') ids: string,
                               @Req() req: Request, @Res() res: Response) {
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

    const common = await this.BlocksModel.findOne({
      raw       : true,
      attributes: ['height', 'id', 'previousBlock', 'timestamp'],
      where     : { id: { [Op.in]: excapedIds } },
      order     : [['height', 'DESC']],
      limit     : 1,
    });
    return this.sendResponse(res, { common: this.generateBytesBlock(common) }, 'APISuccess');
  }

  @Post('/blocks')
  public async postBlock(@Req() req: Request, @Res() res: Response) {
    let normalizedBlock: SignedAndChainedBlockType;
    try {
      const requestData = this.parseRequest(req, 'transportBlocks', 'transportBlock');
      normalizedBlock = this.blockLogic.objectNormalize(this.blockLogic.fromBytes(requestData.block));
    } catch (e) {
      this.peersModule.remove(req.ip, parseInt(req.headers.port as string, 10));
      throw e;
    }
    await this.bus.message('receiveBlock', normalizedBlock);
    return this.sendResponse(res, {success: true, blockId: normalizedBlock.id},
      'transportBlocks', 'transportBlockResponse');
  }

  @Get('/blocks')
  @ValidateSchema()
  public async getBlocks(@SchemaValid(transportSchema.blocks.properties.lastBlockId)
                         @QueryParam('lastBlockId') lastBlockId: string,
                         @Res() res: Response) {
    // TODO define number of blocks to get per response dynamically, based on max payload size and lastBlockId
    const dbBlocks = await this.blocksModuleUtils.loadBlocksData({
      lastId: lastBlockId,
      limit : 2000,
    });
    const blocks   = await Promise.all(dbBlocks
      .map(async (block): Promise<IBytesBlock> => this.generateBytesBlock(block)));
    return this.sendResponse(res, { blocks }, 'transportBlocks');
  }

  private sendResponse(res: Response, payload: any, pbNamespace: string, pbMessageType?: string) {
    res.contentType('application/octet-stream');
    if (this.protoBuf.validate(payload, pbNamespace, pbMessageType)) {
      return res.status(200).end(this.protoBuf.encode(payload, pbNamespace, pbMessageType), 'binary');
    } else {
      return this.error(res, 'Failed to encode response - ' + this.protoBuf.lastError);
    }
  }

  private error(res: Response, message: string, code = 500) {
    throw new Error(message);
    // res.contentType('application/octet-stream');
    // const payload = { message };
    // return res.status(code).end(this.protoBuf.encode(payload, 'APIError'), 'binary');
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

  private parseRequest(req: Request, pbNamespace: string, pbMessageType?: string): any {
    if (!Buffer.isBuffer(req.body)) {
      throw new Error('No binary data in request body');
    }
    const payload = req.body;
    let retVal: any;
    try {
      retVal = this.protoBuf.decode(payload, pbNamespace, pbMessageType);
    } catch (e) {
      throw new Error(`Invalid binary data for message ${pbNamespace} ${pbMessageType}`);
    }
    return retVal;
  }
}
