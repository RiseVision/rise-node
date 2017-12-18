import { Request } from 'express';
import { inject, injectable } from 'inversify';
import { Body, Get, JsonController, Post, Req } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { constants as constantsType } from '../helpers';
import { IPeersLogic } from '../ioc/interfaces/logic';
import { IBlocksModule, IPeersModule, ITransactionsModule, ITransportModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { IBaseTransaction } from '../logic/transactions';

@JsonController()
@injectable()
export class TransportAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.helpers.constants)
  private constants: typeof constantsType;

  @inject(Symbols.logic.peers)
  private peersLogic: IPeersLogic;

  @inject(Symbols.modules.transport)
  private transportModule: ITransportModule;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.transactions)
  private transactionsModule: ITransactionsModule;

  @Get('/height')
  public height() {
    return { height: this.blocksModule.lastBlock.height };
  }

  @Get('/ping')
  public ping() {
    return {}; // Success true will be appended from middleware
  }

  @Get('/peers')
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

  @Get('/transactions')
  public transactions() {
    const transactions = this.transactionsModule.getMergedTransactionList(true, this.constants.maxSharedTxs);
    return { transactions };
  }

  @Post('/transactions')
  public async postTransactions(@Body() body: any, @Req() req: Request) {
    const thePeer = this.peersLogic.create({
      ip  : req.ip,
      port: parseInt(req.headers.port as string, 10),
    });
    if (body.transactions) {
      await this.transportModule.receiveTransactions(body, thePeer, `${req.method} ${req.url}`);
      return {};
    } else if (body.transaction) {
      await this.transportModule.receiveTransaction(body.transaction, thePeer, false, `${req.method} ${req.url}`);

    }
  }
}
