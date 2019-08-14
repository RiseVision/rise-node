import { DBHelper, ModelSymbols } from '@risevision/core-models';
import { PeersModule } from '@risevision/core-p2p';
import {
  IAccountsModel,
  IAccountsModule,
  IBaseTransaction,
  ILogger,
  ISequence,
  ITransactionLogic,
  ITransactionsModel,
  ITransactionsModule,
  PeerType,
  SignedAndChainedBlockType,
  Symbols,
} from '@risevision/core-types';
import { WrapInBalanceSequence } from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import { WordPressHookSystem } from 'mangiafuoco';
import { TransactionPool } from './TransactionPool';

@injectable()
export class TransactionsModule implements ITransactionsModule {
  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.balancesSequence)
  public balancesSequence: ISequence;

  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.generic.genesisBlock)
  private genesisBlock: SignedAndChainedBlockType;

  @inject(Symbols.helpers.db)
  private dbHelper: DBHelper;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.logic.txpool)
  private transactionPool: TransactionPool;
  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  @inject(ModelSymbols.model)
  @named(Symbols.models.transactions)
  private TXModel: typeof ITransactionsModel;

  @inject(Symbols.modules.peers)
  private peersModule: PeersModule;

  public transactionInPool(id: string) {
    return this.transactionPool.transactionInPool(id);
  }

  /**
   * filters the provided input ids returning only the ids that are already confirmed
   * @param {string[]} ids transaction ids.
   * @return {Promise<string[]>} already existing ids
   */
  public async filterConfirmedIds(ids: string[]): Promise<string[]> {
    const idObjs = await this.TXModel.findAll({
      attributes: ['id'],
      raw: true,
      where: { id: ids },
    });
    return idObjs.map((idObj) => idObj.id);
  }

  /**
   * Entry point for external modules to call in order to initiate the tx processing logic.
   * @param transactions
   * @param peer
   */
  @WrapInBalanceSequence
  public async processIncomingTransactions(
    transactions: Array<IBaseTransaction<any, bigint>>,
    peer: PeerType | null
  ) {
    // normalize transactions
    const txs: Array<IBaseTransaction<any, bigint>> = [];
    for (const tx of transactions) {
      try {
        txs.push(this.transactionLogic.objectNormalize(tx));
      } catch (e) {
        this.logger.debug('Transaction normalization failed', {
          err: e.toString(),
          id: tx.id,
          module: 'transport',
          tx,
        });
        if (peer) {
          this.peersModule.remove(peer.ip, peer.port);
        }
        throw new Error(`Invalid transaction body ${e.message}`);
      }
    }

    // filter out already confirmed transactions
    const confirmedIDs = await this.filterConfirmedIds(txs.map((tx) => tx.id));

    for (const tx of txs) {
      if (confirmedIDs.indexOf(tx.id) !== -1) {
        continue; // Transaction already confirmed.
      }
      // tslint:disable no-nested-template-literals
      this.logger.debug(
        `Received transaction ${tx.id} ${
          peer ? `from peer ${peer.string}` : ' '
        }`
      );
      await this.transactionPool.queued.add(tx, { receivedAt: new Date() });
    }
  }

  /**
   * Gets requester if requesterPublicKey and calls applyUnconfirmed.
   */
  // tslint:disable-next-line max-line-length
  public async applyUnconfirmed(
    transaction: IBaseTransaction<any, bigint> & { blockId?: string },
    sender: IAccountsModel
  ): Promise<void> {
    if (!sender) {
      throw new Error('Invalid sender');
    }
    // tslint:disable-next-line max-line-length
    this.logger.debug(
      `Applying unconfirmed transaction ${transaction.id} - AM: ${
        transaction.amount
      } - SB: ${(sender || ({} as any)).u_balance}`
    );

    if (!sender && transaction.blockId !== this.genesisBlock.id) {
      throw new Error('Invalid block id');
    } else {
      await this.dbHelper.performOps(
        await this.transactionLogic.applyUnconfirmed(transaction, sender)
      );
    }
  }

  /**
   * Validates account and Undoes unconfirmed transaction.
   */
  public async undoUnconfirmed(transaction): Promise<void> {
    const sender = await this.accountsModule.getAccount({
      address: transaction.senderId,
    });
    // tslint:disable-next-line max-line-length
    this.logger.debug(
      `Undoing unconfirmed transaction ${transaction.id} - AM: ${transaction.amount} - SB: ${sender.u_balance}`
    );
    await this.dbHelper.performOps(
      await this.transactionLogic.undoUnconfirmed(transaction, sender)
    );
  }

  public async count() {
    return {
      confirmed: await this.TXModel.count(),
      pending: this.transactionPool.pending.count,
      queued: this.transactionPool.queued.count,
      ready: this.transactionPool.ready.count,
      unconfirmed: this.transactionPool.unconfirmed.count,
    };
  }

  /**
   * Get transaction by id
   */
  public async getByID<T = any>(id: string): Promise<ITransactionsModel> {
    const tx = await this.TXModel.findByPk(id);
    if (tx === null) {
      throw new Error('Transaction not found');
    }
    return tx;
  }

  /**
   * Check transaction - perform transaction validation when processing block
   * If it does not throw the tx should be valid.
   * NOTE: this must be called with an unconfirmed transaction
   */
  public async checkTransaction(
    tx: IBaseTransaction<any, bigint>,
    accountsMap: { [address: string]: IAccountsModel },
    height: number
  ): Promise<void> {
    const acc = accountsMap[tx.senderId];
    if (!acc) {
      throw new Error('Cannot find account from accounts');
    }
    await this.transactionLogic.verify(tx, acc, height);
  }
}
