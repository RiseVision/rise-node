import { Request } from 'express';
import { inject, injectable } from 'inversify';
import { BodyParam, Get, JsonController, Post, QueryParam, Req, UseBefore } from 'routing-controllers';
import { Op } from 'sequelize';
import * as z_schema from 'z-schema';
import { Bus, constants as constantsType, TransactionType } from '../helpers';
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
import { SignedAndChainedBlockType, SignedAndChainedTransportBlockType } from '../logic';
import { IBaseTransaction, ITransportTransaction } from '../logic/transactions';
import { BlocksModel, DelegatesModel, MultiSignaturesModel, SignaturesModel, VotesModel } from '../models';
import transportSchema from '../schema/transport';
import { RawFullBlockListType } from '../types/rawDBTypes';
import { Partial } from '../types/utils';
import { APIError } from './errors';
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
    const { peers } = await this.peersModule.list({ limit: this.constants.maxPeers });
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
    return { signatures };
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
    return { transactions };
  }

  @Post('/transactions')
  public async postTransactions(@BodyParam('transactions') txs: Array<ITransportTransaction<any>>,
                                @BodyParam('transaction') tx: ITransportTransaction<any>,
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
    if (excapedIds.length === 0 || excapedIds.length > 10) {
      this.peersModule.remove(req.ip, parseInt(req.headers.port as string, 10));
      throw new APIError('Invalid block id sequence', 200);
    }

    return {
      common: await this.BlocksModel.findOne({
        raw       : true,
        attributes: ['height', 'id', 'previousBlock', 'timestamp'],
        where     : { id: { [Op.in]: excapedIds } },
        order     : [['height', 'DESC']],
        limit     : 1,
      }),
    };
  }

  @Post('/blocks')
  public async postBlock(@BodyParam('block') block: SignedAndChainedTransportBlockType, @Req() req: Request) {
    let normalizedBlock: SignedAndChainedBlockType;
    try {
      normalizedBlock = this.blockLogic.objectNormalize(block);
    } catch (e) {
      this.peersModule.remove(req.ip, parseInt(req.headers.port as string, 10));
      throw e;
    }
    await this.bus.message('receiveBlock', normalizedBlock);
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
    const dbBlocks = await this.blocksModuleUtils.loadBlocksData({
      lastId: lastBlockId,
      limit : 34,
    });
    const blocks   = (await Promise.all(dbBlocks.map(async (block) => {
      const transactions = block.transactions;

      const rawBlocks: RawFullBlockListType[] = [];
      for (const t of transactions) {
        const tmpBlock = genTransportBlock(block, {
          t_id             : t.id,
          t_rowId          : t.rowId,
          t_type           : t.type,
          t_timestamp      : t.timestamp,
          t_senderPublicKey: t.senderPublicKey.toString('hex'),
          t_senderId       : t.senderId,
          t_recipientId    : t.recipientId,
          t_amount         : t.amount,
          t_fee            : t.fee,
          t_signature      : t.signature.toString('hex'),
          t_signSignature  : t.signSignature.toString('hex'),
          t_signatures     : t.signatures.join(','),
        });
        switch (t.type) {
          case TransactionType.VOTE:
            rawBlocks.push({
              ...tmpBlock, ... {
                v_votes: (await VotesModel.findOne({ where: { transactionId: t.id } })).votes,
              },
            });
            break;
          case TransactionType.MULTI:
            const mr = await MultiSignaturesModel.findOne({ where: { transactionId: t.id } });
            rawBlocks.push({
              ...tmpBlock, ... {
                m_min      : mr.min,
                m_lifetime : mr.lifetime,
                m_keysgroup: mr.keysgroup,
              },
            });
            break;
          case TransactionType.DELEGATE:
            const dr = await DelegatesModel.findOne({ where: { transactionId: t.id } });
            rawBlocks.push({
              ...tmpBlock, ... {
                d_username: dr.username,
              },
            });
            break;
          case TransactionType.SIGNATURE:
            const sr = await SignaturesModel.findOne({ where: { transactionId: t.id } });
            rawBlocks.push({
              ...tmpBlock, ... {
                s_publicKey: sr.publicKey.toString('hex'),
              },
            });
            break;
        }
        rawBlocks.push(tmpBlock);
      }
      if (rawBlocks.length === 0) {
        // no txs add one block with empty tx data.
        rawBlocks.push(genTransportBlock(block, {}));
      }
      return rawBlocks;
    }))).reduce((a, b) => a.concat(b), []);
    return { blocks };
  }

}
