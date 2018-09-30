import { ILogger, ITransactionsModule, Symbols } from '@risevision/core-interfaces';
import { p2pSymbols, Peer } from '@risevision/core-p2p';
import { decorate, inject, injectable, named } from 'inversify';
import { OnWPAction, WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import * as promiseRetry from 'promise-retry';
import { GetTransactionsRequest } from './p2p';
import { TXSymbols } from './txSymbols';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class TXLoader extends Extendable {

  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(TXSymbols.module)
  private txModule: ITransactionsModule;

  @inject(p2pSymbols.transportMethod)
  @named(TXSymbols.p2p.getTransactions)
  private getTransactionsRequest: GetTransactionsRequest;

  // @OnWPFilter('core/loader/whatToSync')
  // public async whatToSync(toSync: string[]) {
  //   return toSync;
  // }

  @OnWPAction('core/loader/onSyncRequested')
  public async onSyncRequested(what: string, peerFactory: () => Promise<Peer>) {
    if (what !== 'transactions') {
      return;
    }
    try {
      await promiseRetry(async (retry) => {
        try {
          await this.loadTransactions(await peerFactory());
        } catch (e) {
          this.logger.warn('Error loading transactions... Retrying... ', e);
          retry(e);
        }
      }, { retries: 3 });
    } catch (e) {
      this.logger.log('Unconfirmed transactions loader error', e);
    }
  }

  /**
   * Load transactions from a random peer.
   * Validates each transaction from peer and eventually remove the peer if invalid.
   */
  private async loadTransactions(peer: Peer) {
    this.logger.log(`Loading transactions from: ${peer.string}`);
    const body = await peer.makeRequest(this.getTransactionsRequest);

    const { transactions } = body;

    const trans = transactions || [];
    while (trans.length > 0) {
      try {
        await this.txModule.processIncomingTransactions(
          trans.splice(0, 25),
          peer
        );
      } catch (err) {
        this.logger.warn(err);
      }
    }
  }

}
