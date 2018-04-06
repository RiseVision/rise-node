import { Request } from 'express';
import { inject, injectable } from 'inversify';
import { IDatabase } from 'pg-promise';
import { BodyParam, Get, JsonController, Post, QueryParam, Req, UseBefore } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { Bus, constants as constantsType } from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { IBlockLogic, IPeersLogic } from '../ioc/interfaces/logic';
import {
  IBlocksModule, IBlocksModuleUtils, IPeersModule, ITransactionsModule,
  ITransportModule
} from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { SignedAndChainedBlockType } from '../logic';
import { IBaseTransaction } from '../logic/transactions';
import transportSchema from '../schema/transport';
import transportSQL from '../sql/transport';
import { AttachPeerHeaders } from './utils/attachPeerHeaders';
import { ValidatePeerHeaders } from './utils/validatePeerHeaders';
import { APIError } from './errors';

@JsonController('/peer')
@injectable()
@IoCSymbol(Symbols.api.transport)
@UseBefore(ValidatePeerHeaders)
@UseBefore(AttachPeerHeaders)
export class TransportAPI {
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
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
  @inject(Symbols.logic.peers)
  private peersLogic: IPeersLogic;
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;
  @inject(Symbols.modules.transport)
  private transportModule: ITransportModule;

  @Get('/height')
  public height() {
    return { height: this.blocksModule.lastBlock.height };
  }

  @Get('/ping')
  public ping() {
    return {}; // Success true will be appended from middleware
  }

  @Get('/list')
  public async list() {
    const {peers} = await this.peersModule.list({limit: this.constants.maxPeers});
    return { peers };
  }

  @Get('/signatures')
  public signatures() {
    const txs: Array<IBaseTransaction<any>> =
            this.transactionsModule.getMultisignatureTransactionList(true, this.constants.maxSharedTxs);

    const signatures = [];
    for (const tx of txs) {
      if (tx.signatures && tx.signatures.length > 0) {
        signatures.push({
          signatures : tx.signatures,
          transaction: tx.id,
        });
      }
    }
    return {signatures};
  }

  @Post('/signatures')
  @ValidateSchema()
  public async postSignatures(
    @SchemaValid(transportSchema.signatures, 'Invalid signatures body')
    @BodyParam('signatures') signatures: Array<{ transaction: string, signature: string }>) {

    return this.transportModule.receiveSignatures(signatures);
  }

  @Get('/transactions')
  public transactions() {
    const transactions = this.transactionsModule.getMergedTransactionList(this.constants.maxSharedTxs);
    return {transactions};
  }

  @Post('/transactions')
  public async postTransactions(@BodyParam('transactions') txs: Array<IBaseTransaction<any>>,
                                @BodyParam('transaction') tx: IBaseTransaction<any>,
                                @Req() req: Request) {
    const thePeer = this.peersLogic.create({
      ip  : req.ip,
      port: parseInt(req.headers.port as string, 10),
    });
    if (txs) {
      await this.transportModule.receiveTransactions(txs, thePeer, `${req.method} ${req.url}`);
      return {};
    } else if (tx) {
      await this.transportModule.receiveTransaction(tx, thePeer, false, `${req.method} ${req.url}`);

    }
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
    if (excapedIds.length === 0 ) {
      this.peersModule.remove(req.ip, parseInt(req.headers.port as string, 10));
      throw new APIError('Invalid block id sequence', 200);
    }
    const rows = await this.db.query(transportSQL.getCommonBlock, excapedIds);
    return { common: rows[0] || null };
  }

  @Post('/blocks')
  public async postBlock(@BodyParam('block') block: SignedAndChainedBlockType, @Req() req: Request) {
    try {
      block = this.blockLogic.objectNormalize(block);
    } catch (e) {
      this.peersModule.remove(req.ip, parseInt(req.headers.port as string, 10));
      throw e;
    }
    await this.bus.message('receiveBlock', block);
    return { blockId: block.id };
  }

  @Get('/blocks')
  @ValidateSchema()
  public async getBlocks(@SchemaValid(transportSchema.blocks.properties.lastBlockId)
                           @QueryParam('lastBlockId') lastBlockId: string) {
    // Get 34 blocks with all data (joins) from provided block id
    // According to maxium payload of 58150 bytes per block with every transaction being a vote
    // Discounting maxium compression setting used in middleware
    // Maximum transport payload = 2000000 bytes
    const blocks = await this.blocksModuleUtils.loadBlocksData({
      lastId: lastBlockId,
      limit: 34,
    });
    return { blocks };
  }

}
