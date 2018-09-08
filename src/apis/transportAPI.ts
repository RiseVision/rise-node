import { Request } from 'express';
import { inject, injectable } from 'inversify';
import { BodyParam, Get, JsonController, Post, QueryParam, Req, UseBefore } from 'routing-controllers';
import { Op } from 'sequelize';
import * as z_schema from 'z-schema';
import { Bus, constants as constantsType, TransactionType } from '../helpers';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { assertValidSchema, SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
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
import { BlocksModel, TransactionsModel } from '../models';
import transportSchema from '../schema/transport';
import { RawFullBlockListType } from '../types/rawDBTypes';
import { Partial } from '../types/utils';
import { APIError } from './errors';
import { AttachPeerHeaders } from './utils/attachPeerHeaders';
import { ValidatePeerHeaders } from './utils/validatePeerHeaders';

function genTransportBlock(block: BlocksModel, extra: Partial<RawFullBlockListType>): RawFullBlockListType {
  // tslint:disable object-literal-sort-keys
  return {
    ...{
      b_id                  : block.id,
      b_version             : block.version,
      b_timestamp           : block.timestamp,
      b_height              : block.height,
      b_previousBlock       : block.previousBlock,
      b_numberOfTransactions: block.numberOfTransactions,
      b_totalAmount         : block.totalAmount,
      b_totalFee            : block.totalFee,
      b_reward              : block.reward,
      b_payloadLength       : block.payloadLength,
      b_payloadHash         : block.payloadHash.toString('hex'),
      b_generatorPublicKey  : block.generatorPublicKey.toString('hex'),
      b_blockSignature      : block.blockSignature.toString('hex'),
      t_id                  : null,
      // t_rowId: 350034,
      t_type                : null,
      t_timestamp           : null,
      t_senderPublicKey     : null,
      t_senderId            : null,
      t_recipientId         : null,
      t_amount              : null,
      t_fee                 : null,
      t_signature           : null,
      t_signSignature       : null,
      s_publicKey           : null,
      d_username            : null,
      v_votes               : null,
      m_min                 : null,
      m_lifetime            : null,
      m_keysgroup           : null,
      dapp_name             : null,
      dapp_description      : null,
      dapp_tags             : null,
      dapp_type             : null,
      dapp_link             : null,
      dapp_category         : null,
      dapp_icon             : null,
      in_dappId             : null,
      ot_dappId             : null,
      ot_outTransactionId   : null,
      t_requesterPublicKey  : null,
      t_signatures          : null,
    } as any,
    ...extra,
  };
}

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
  @inject(Symbols.models.transactions)
  private TransactionsModel: typeof TransactionsModel;

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
    return { peers: peers.map(((peer) => peer.object())) };
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
  public async postSignatures(
    @BodyParam('signatures') signatures: Array<{ transaction: string, signature: string }>,
    @BodyParam('signature') signature: { transaction: string, signature: string }
  ) {

    if (!Array.isArray(signatures)) {
      signatures = [];
    } else {
      assertValidSchema(this.schema, signatures, { obj: transportSchema.signatures.properties.signatures });
    }
    if (typeof(signature) !== 'undefined') {
      assertValidSchema(this.schema, signature, { obj: transportSchema.signature });
      signatures.push(signature);
    }
    return this.transportModule.receiveSignatures(signatures);
  }

  @Get('/transactions')
  public transactions() {
    const transactions = this.transactionsModule.getMergedTransactionList(this.constants.maxSharedTxs);

    return {
      transactions: transactions
        .map((tx) => this.TransactionsModel.toTransportTransaction(tx, this.blocksModule)),
    };
  }

  @Post('/transactions')
  public async postTransactions(@BodyParam('transactions') txs: Array<ITransportTransaction<any>>,
                                @BodyParam('transaction') tx: ITransportTransaction<any>,
                                @Req() req: Request) {
    const thePeer = this.peersLogic.create({
      ip  : req.ip,
      port: parseInt(req.headers.port as string, 10),
    });
    txs           = txs || (tx ? [tx] : []);
    if (txs.length > 0) {
      await this.transportModule.receiveTransactions(txs, thePeer, true);
    }
    return {};
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

    const common = await this.BlocksModel.findOne({
      raw       : true,
      attributes: ['height', 'id', 'previousBlock', 'timestamp'],
      where     : { id: { [Op.in]: excapedIds } },
      order     : [['height', 'DESC']],
      limit     : 1,
    });
    return { common };
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
    return { blockId: normalizedBlock.id };
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
          t_signSignature  : t.signSignature ? t.signSignature.toString('hex') : null,
          t_signatures     : t.signatures.join(','),
        });
        switch (t.type) {
          case TransactionType.VOTE:
            rawBlocks.push({
              ...tmpBlock,
              ... {
                v_votes: t.asset.votes.join(','),
              },
            });
            break;
          case TransactionType.MULTI:
            rawBlocks.push({
              ...tmpBlock, ... {
                m_min      : t.asset.multisignature.min,
                m_lifetime : t.asset.multisignature.lifetime,
                m_keysgroup: t.asset.multisignature.keysgroup,
              },
            });
            break;
          case TransactionType.DELEGATE:
            rawBlocks.push({
              ...tmpBlock, ... {
                d_username: t.asset.delegate.username,
              },
            });
            break;
          case TransactionType.SIGNATURE:
            rawBlocks.push({
              ...tmpBlock, ... {
                s_publicKey: t.asset.signature.publicKey,
              },
            });
            break;
          case TransactionType.SEND:
            rawBlocks.push(tmpBlock);
            break;
        }
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
