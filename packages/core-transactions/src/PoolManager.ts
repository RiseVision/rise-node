import {
  IAccountsModel,
  IAccountsModule,
  IJobsQueue,
  ILogger,
  ISequence,
  Symbols,
} from '@risevision/core-interfaces';
import { BroadcasterLogic, p2pSymbols } from '@risevision/core-p2p';
import { ConstantsType, IBaseTransaction } from '@risevision/core-types';
import { logOnly, WrapInBalanceSequence } from '@risevision/core-utils';
import { inject, injectable, named, postConstruct } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import { TXAppConfig } from './helpers/appconfig';
import { OnNewUnconfirmedTransation } from './hooks/actions';
import { TxExpireTimeout } from './hooks/filters';
import { PostTransactionsRequest } from './p2p';
import { TransactionLogic } from './TransactionLogic';
import { TransactionsModule } from './TransactionModule';
import { TransactionPool } from './TransactionPool';
import { TXSymbols } from './txSymbols';

@injectable()
export class PoolManager {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.balancesSequence)
  public balancesSequence: ISequence;
  @inject(Symbols.generic.appConfig)
  private config: TXAppConfig;
  @inject(Symbols.generic.constants)
  private constants: ConstantsType & { blocks: { maxTxsPerBlock: number } };

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.helpers.jobsQueue)
  private jobsQueue: IJobsQueue;
  @inject(Symbols.logic.broadcaster)
  private broadcasterLogic: BroadcasterLogic;
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;

  @inject(TXSymbols.module)
  private module: TransactionsModule;
  @inject(TXSymbols.logic)
  private logic: TransactionLogic;
  @inject(TXSymbols.pool)
  private pool: TransactionPool;
  @inject(p2pSymbols.transportMethod)
  @named(TXSymbols.p2p.postTxRequest)
  private postTransactionMethod: PostTransactionsRequest;

  @postConstruct()
  public postConstruct() {
    this.jobsQueue.register(
      'poolManager',
      () => this.processPool(),
      this.config.transactions.processQueueInterval
    );
  }

  public cleanup() {
    this.jobsQueue.unregister('poolManager');
  }

  public async processPool() {
    await this.removeExpiredTransactions();
    await this.processQueuedTransactions();
    await this.checkPendingTransactions();
    await this.applyUnconfirmed();
  }

  protected async removeExpiredTransactions() {
    const elements = this.pool.allQueues
      .map((q) => q.list())
      .reduce((a, b) => a.concat(b), []);
    for (const txP of elements) {
      const { tx, payload } = txP;
      if (!tx) {
        continue;
      }
      const now = Math.floor(Date.now() / 1000);
      const timeOut = await this.hookSystem.apply_filters(
        TxExpireTimeout.name,
        this.constants.unconfirmedTransactionTimeOut,
        tx
      );
      const seconds = now - Math.floor(payload.receivedAt.getTime() / 1000);
      if (seconds > timeOut) {
        this.pool.removeFromPool(tx.id);
        this.logger.info(
          `Expired transaction: ${
            tx.id
          } received at: ${payload.receivedAt.toUTCString()}`
        );
      }
    }
  }

  @WrapInBalanceSequence
  protected async processQueuedTransactions() {
    // Fetch txs from queue in order of appearance.
    const bundledTxs = await this.pool.queued.list({
      limit: this.config.transactions.bundleLimit,
      sortFn: (a, b) =>
        b.payload.receivedAt.getTime() - a.payload.receivedAt.getTime(),
    });

    const accMap = await this.accountsModule.txAccounts(
      bundledTxs.map((btx) => btx.tx)
    );

    // Either discard or move to ready/pending
    for (const btx of bundledTxs) {
      await this.processQueued(btx.tx, accMap).catch(logOnly(this.logger));
    }
  }

  @WrapInBalanceSequence
  protected async checkPendingTransactions() {
    // Check if some of the pending are now ready.
    const pendingTxs = await this.pool.pending.list();
    const accMap = await this.accountsModule.txAccounts(
      pendingTxs.map((a) => a.tx)
    );
    for (const ptx of pendingTxs) {
      const ready = await this.logic.ready(ptx.tx, accMap[ptx.tx.senderId]);
      if (ready) {
        await this.pool.moveTx(ptx.tx.id, 'pending', 'ready');
      }
    }
  }

  @WrapInBalanceSequence
  protected async applyUnconfirmed() {
    // Unconfirm some txs.
    const missingUnconfirmed =
      this.constants.blocks.maxTxsPerBlock - this.pool.unconfirmed.count;
    const readyTxs = this.pool.ready
      .list({
        limit: missingUnconfirmed,
        sortFn: (a, b) =>
          parseInt(a.tx.fee as any, 10) - parseInt(b.tx.fee as any, 10),
      })
      .map((t) => t.tx);

    const accMap = await this.accountsModule.txAccounts(readyTxs);

    const confirmedIDs = await this.module.filterConfirmedIds(
      readyTxs.map((t) => t.id)
    );
    const unconfirmedInCycle: Array<
      IBaseTransaction<any> & { relays: number }
    > = [];
    for (const readyTx of readyTxs) {
      if (confirmedIDs.indexOf(readyTx.id) !== -1) {
        this.logger.warn(
          `Transaction ${readyTx.id} was ready but already confirmed`
        );
        this.pool.removeFromPool(readyTx.id);
        continue;
      }
      try {
        // Check transaction is still valid.
        await this.module.checkTransaction(readyTx, accMap, null);
        // ApplyUnconfirm the transaction
        await this.module.applyUnconfirmed(readyTx, accMap[readyTx.senderId]);
        // Move it from one queue to another
        this.pool.moveTx(readyTx.id, 'ready', 'unconfirmed');

        unconfirmedInCycle.push(readyTx as any);

        // Notify
        await this.hookSystem
          .do_action(OnNewUnconfirmedTransation.name, readyTx)
          .catch(logOnly(this.logger, 'debug'));
        await this.hookSystem.do_action(
          'pushapi/onNewMessage',
          'transactions/change',
          readyTx
        );
      } catch (e) {
        // IF tx failed to apply for some reason lets move it back in queued state.
        this.pool.moveTx(readyTx.id, 'ready', 'queued');
      }
    }

    // Enqueue broadcasts
    if (unconfirmedInCycle.length > 0) {
      const toBroadcastTxs = unconfirmedInCycle
        .map((t) => {
          return { ...t, relays: (t.relays || 0) + 1 };
        })
        .filter((t) => t.relays < this.broadcasterLogic.maxRelays());
      if (toBroadcastTxs.length > 0) {
        this.broadcasterLogic.enqueue(
          { body: { transactions: toBroadcastTxs } },
          this.postTransactionMethod
        );
      }
    }
  }

  protected async processQueued(
    tx: IBaseTransaction<any>,
    accMap: { [add: string]: IAccountsModel }
  ) {
    try {
      await this.accountsModule.checkTXsAccountsMap([tx], accMap);
      if (!(await this.logic.ready(tx, accMap[tx.senderId]))) {
        await this.pool.moveTx(tx.id, 'queued', 'pending');
        const p = await this.pool.pending.getPayload(tx);
        p.ready = false;
      } else {
        await this.module.checkTransaction(tx, accMap, null);
        await this.pool.moveTx(tx.id, 'queued', 'ready');
      }
    } catch (e) {
      await this.pool.removeFromPool(tx.id);
      this.logger.warn(`Processing Transaction ${tx.id} resulted in error`, e);
      return;
    }
  }
}
