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
import { ModelSymbols } from '@risevision/core-models';
import { AttachPeerHeaders, p2pSymbols, ProtoBufHelper, ValidatePeerHeaders } from '@risevision/core-p2p';
import { ConstantsType, SignedAndChainedBlockType } from '@risevision/core-types';
import { HTTPError, IoCSymbol, SchemaValid, ValidateSchema } from '@risevision/core-utils';
import { Request } from 'express';
import { inject, injectable, named } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import { ContentType, Controller, Get, Post, QueryParam, Req, UseBefore } from 'routing-controllers';

import * as z_schema from 'z-schema';
import { TXSymbols } from '../txSymbols';

const transportSchema = require('../../schema/transport.json');

@Controller('/v2/peer')
@injectable()
@IoCSymbol(TXSymbols.api.transport)
@UseBefore(ValidatePeerHeaders)
@UseBefore(AttachPeerHeaders)
@ContentType('application/octet-stream')
export class TransactionTransport {
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  // TODO: lerna remove me and use tx type constants. (But check if used in transport. )
  private constants: ConstantsType;

  // @inject(Symbols.helpers.bus)
  // private bus: Bus;
  @inject(p2pSymbols.helpers.protoBuf)
  private protoBuf: ProtoBufHelper;
  @inject(Symbols.logic.peers)
  private peersLogic: IPeersLogic;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;


  @Get('/transactions')
  public transactions() {
    const transactions = this.transactionsModule.getMergedTransactionList(this.constants.maxSharedTxs);

    const byteTxs = transactions
      .map((tx) => this.transactionLogic.toProtoBuffer(tx));

    return this.protoBuf.encode(
      { transactions: byteTxs },
      'transactions.transport',
      'transportTransactions'
    );
  }

  @Post('/transactions')
  public async postTransactions(@Req() req: Request) {
    const requestData = this.protoBuf
      .decode<{ transactions: Buffer[] }>(
        req.body,
        'transactions.transport',
        'transportTransactions'
      );

    const thePeer = this.peersLogic.create({
      ip  : req.ip,
      port: parseInt(req.headers.port as string, 10),
    });

    if (requestData.transactions.length > 0) {
      await this.transactionsModule.processIncomingTransactions(
        requestData.transactions.map(
          (tx) => this.transactionLogic.fromProtoBuffer(tx)
        ),
        thePeer,
        true
      );
    }

    return this.protoBuf.encode({ success: true }, 'APISuccess');
  }

}
