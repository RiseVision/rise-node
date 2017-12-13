import { Request } from 'express';
import { Body, Get, JsonController, Post, Req } from 'routing-controllers';
import { constants } from '../../helpers/';
import { IBaseTransaction } from '../../logic/transactions/';
import { PeersModule } from '../peers';
import { TransportModule } from '../transport';

// TODO : this is not possible to create due to limitation of routing-controllers
// We'll need to set up dependency injection first to let this work properly.
@JsonController()
export class TransportAPI {
  public schema: any;

  constructor(private transportModule: TransportModule, private blocksModule: any,
              private peersModule: PeersModule,
              private transactionsModule: any) {
    this.schema = transportModule.schema;
  }

  @Get('/height')
  public height() {
    return { height: this.blocksModule.lastBlock.get().height };
  }

  @Get('/ping')
  public ping() {
    return {}; // Success true will be appended from middleware
  }

  @Get('/peers')
  public async list() {
    const { peers } = await this.peersModule.list({ limit: constants.maxPeers });
    return { peers };
  }

  @Get('/signatures')
  public signatures() {
    const txs: Array<IBaseTransaction<any>> =
            this.transactionsModule.getMultisignatureTransactionList(true, constants.maxSharedTxs);

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
    const transactions = this.transactionsModule.getMergedTransactionList(true, constants.maxSharedTxs);
    return { transactions };
  }

  @Post('/transactions')
  public async postTransactions(@Body() body: any, @Req() req: Request) {
    const thePeer = this.peersModule.library.logic.peers.create({
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
