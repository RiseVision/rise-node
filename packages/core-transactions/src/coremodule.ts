import { APISymbols } from '@risevision/core-apis';
import {
  IBaseTransactionType,
  ITransactionLogic,
  Symbols,
} from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { p2pSymbols } from '@risevision/core-p2p';
import { TransactionsAPI } from './api';
import { TXLoader } from './loader';
import { SendTxAssetModel, TransactionsModel } from './models';
import { GetTransactionsRequest, PostTransactionsRequest } from './p2p';
import { PoolManager } from './PoolManager';
import { InnerTXQueue } from './poolTXsQueue';
import { SendTransaction } from './sendTransaction';
import { TransactionLogic } from './TransactionLogic';
import { TransactionsModule } from './TransactionModule';
import { TransactionPool } from './TransactionPool';
import { TXBytes } from './txbytes';
import { TXSymbols } from './txSymbols';

// tslint:disable-next-line
const schema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule {
  public configSchema = schema;
  public constants = {};

  public addElementsToContainer(): void {
    this.container
      .bind(TXSymbols.transaction)
      .to(SendTransaction)
      .inSingletonScope()
      .whenTargetNamed(TXSymbols.sendTX);

    this.container
      .bind(APISymbols.api)
      .toConstructor(TransactionsAPI)
      .whenTargetNamed(TXSymbols.api.api);

    this.container
      .bind(ModelSymbols.model)
      .toConstructor(TransactionsModel)
      .whenTargetNamed(TXSymbols.models.model);

    this.container
      .bind(ModelSymbols.model)
      .toConstructor(SendTxAssetModel)
      .whenTargetNamed(TXSymbols.models.sendTxAsset);

    this.container
      .bind(Symbols.modules.transactions)
      .to(TransactionsModule)
      .inSingletonScope();
    this.container
      .bind(Symbols.logic.transaction)
      .to(TransactionLogic)
      .inSingletonScope();
    this.container
      .bind(Symbols.logic.txpool)
      .to(TransactionPool)
      .inSingletonScope();

    this.container
      .bind(p2pSymbols.transportMethod)
      .to(GetTransactionsRequest)
      .inSingletonScope()
      .whenTargetNamed(TXSymbols.p2p.getTransactions);

    this.container
      .bind(p2pSymbols.transportMethod)
      .to(PostTransactionsRequest)
      .inSingletonScope()
      .whenTargetNamed(TXSymbols.p2p.postTxRequest);

    this.container.bind(TXSymbols.poolQueue).toConstructor(InnerTXQueue);
    this.container
      .bind(TXSymbols.poolManager)
      .to(PoolManager)
      .inSingletonScope();

    this.container
      .bind(TXSymbols.loader)
      .to(TXLoader)
      .inSingletonScope();

    this.container
      .bind(TXSymbols.txBytes)
      .to(TXBytes)
      .inSingletonScope();
  }

  public async initAppElements() {
    // initializes pool manager through postConstruct
    this.container.get<PoolManager>(TXSymbols.poolManager);

    await this.container.get<TXLoader>(TXSymbols.loader).hookMethods();
  }

  public async teardown() {
    await this.container.get<PoolManager>(TXSymbols.poolManager).cleanup();
    await this.container.get<TXLoader>(TXSymbols.loader).unHook();
  }
}
