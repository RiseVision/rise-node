import BigNumber from 'bignumber.js';
import { Request, Response } from 'express';
import { inject, injectable } from 'inversify';
import { Body, Controller, Get, Post, QueryParam, Req, Res, UseBefore } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { Bus, constants as constantsType, ProtoBufHelper, } from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { IBlockLogic, IPeersLogic } from '../ioc/interfaces/logic';
import {
  IBlocksModule,
  IBlocksModuleUtils,
  IPeersModule,
  ITransactionsModule,
  ITransportModule
} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { IBaseTransaction } from '../logic/transactions';
import { BlocksModel } from '../models';
import transportSchema from '../schema/transport';
import { AttachPeerHeaders } from './utils/attachPeerHeaders';
import { ValidatePeerHeaders } from './utils/validatePeerHeaders';

@Controller('/v2/peer')
@injectable()
@IoCSymbol(Symbols.api.transport)
@UseBefore(ValidatePeerHeaders)
@UseBefore(AttachPeerHeaders)
export class TransportV2API {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.logic.block)
  private blockLogic: IBlockLogic;
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
    // const { peers } = await this.peersModule.list({ limit: this.constants.maxPeers });
    // return { peers };
  }

  @Get('/signatures')
  public signatures(@Res() res: Response) {
    const txs: Array<IBaseTransaction<any>> =
            this.transactionsModule.getMultisignatureTransactionList(true, this.constants.maxSharedTxs);
    const signatures = [];
    for (const tx of txs) {
      if (tx.signatures && tx.signatures.length > 0) {
        signatures.push({
          signatures : tx.signatures.map((sig) => {
            return Buffer.from(sig, 'hex');
          }),
          transaction: new BigNumber(tx.id),
        });
      }
    }
    return this.sendResponse(res, { signatures }, 'tranportSignatures');
  }

  @Post('/signatures')
  public async postSignatures(@Body() data: Buffer, @Res() res: Response) {
    // TODO validate data after decoding
    // return this.transportModule.receiveSignatures(signatures);
  }

  @Get('/transactions')
  public transactions(@Res() res: Response) {
    // const transactions = this.transactionsModule.getMergedTransactionList(this.constants.maxSharedTxs);
    // return { transactions };
  }

  @Post('/transactions')
  public async postTransactions(@Body() data: Buffer, @Req() req: Request, @Res() res: Response) {
    // TODO validate data after decoding
    // const thePeer = this.peersLogic.create({
    //   ip  : req.ip,
    //   port: parseInt(req.headers.port as string, 10),
    // });
    // txs = txs || (tx ? [tx] : [] );
    // if (txs.length > 0) {
    //   await this.transportModule.receiveTransactions(txs, thePeer, true);
    // }
    // return {};
  }

  @Post('/blocks')
  public async postBlock(@Body() data: Buffer, @Req() req: Request, @Res() res: Response) {
    // TODO validate data after decoding
    // let normalizedBlock: SignedAndChainedBlockType;
    // try {
    //   normalizedBlock = this.blockLogic.objectNormalize(block);
    // } catch (e) {
    //   this.peersModule.remove(req.ip, parseInt(req.headers.port as string, 10));
    //   throw e;
    // }
    // await this.bus.message('receiveBlock', normalizedBlock);
    // return { blockId: normalizedBlock.id };
  }

  @Get('/blocks')
  @ValidateSchema()
  public async getBlocks(@SchemaValid(transportSchema.blocks.properties.lastBlockId)
                         @QueryParam('lastBlockId') lastBlockId: string,
                         @Res() res: Response) {
    // Get 34 blocks with all data (joins) from provided block id
    // According to maxium payload of 58150 bytes per block with every transaction being a vote
    // Discounting maxium compression setting used in middleware
    // Maximum transport payload = 2000000 bytes
    // const dbBlocks = await this.blocksModuleUtils.loadBlocksData({
    //   lastId: lastBlockId,
    //   limit : 34,
    // });
    // ....
  }

  private sendResponse(res: Response,  payload: any, pbNamespace: string, pbMessageType?: string) {
    res.contentType('application/octet-stream');
    if (this.protoBuf.validate(payload, pbNamespace, pbMessageType)) {
      return res.status(200).end(this.protoBuf.encode(payload, pbNamespace, pbMessageType), 'binary');
    } else {
      return this.error(res, 'Failed to encode response');
    }
  }

  private error(res: Response, message: string, code = 500) {
    const payload = { message };
    return res.status(code).end(this.protoBuf.encode(payload, 'APIError'), 'binary');
  }
}
