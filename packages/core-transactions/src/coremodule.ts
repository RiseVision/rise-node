import { APISymbols } from '@risevision/core-apis';
import { IBaseTransactionType, ITransactionLogic, Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ModelSymbols } from '@risevision/core-models';
import { SendTransaction } from './sendTransaction';
import { TransactionLogic } from './TransactionLogic';
import { TransactionsModule } from './TransactionModule';
import { TransactionPool } from './TransactionPool';
import { TransactionsModel } from './TransactionsModel';
import { TXSymbols } from './txSymbols';
import { GetTransactionsRequest, PostTransactionsRequest } from './p2p';
import { TransactionsAPI  } from './api';
import { p2pSymbols } from '@risevision/core-p2p';

const schema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule {
  public configSchema = schema;
  public constants    = {};

  public addElementsToContainer(): void {
    this.container.bind(TXSymbols.transaction).to(SendTransaction)
      .inSingletonScope()
      .whenTargetNamed(TXSymbols.sendTX);

    this.container.bind(APISymbols.api).to(TransactionsAPI)
      .inSingletonScope()
      .whenTargetNamed(TXSymbols.api.api);

    this.container.bind(ModelSymbols.model)
      .toConstructor(TransactionsModel)
      .whenTargetNamed(TXSymbols.model);

    this.container.bind(Symbols.modules.transactions)
      .to(TransactionsModule).inSingletonScope();
    this.container.bind(Symbols.logic.transaction)
      .to(TransactionLogic).inSingletonScope();
    this.container.bind(Symbols.logic.txpool)
      .to(TransactionPool).inSingletonScope();

    this.container.bind(p2pSymbols.transportMethod)
      .to(GetTransactionsRequest)
      .inSingletonScope()
      .whenTargetNamed(TXSymbols.p2p.getTransactions);

    this.container.bind(p2pSymbols.transportMethod)
      .to(PostTransactionsRequest)
      .inSingletonScope()
      .whenTargetNamed(TXSymbols.p2p.postTxRequest);
  }

  public async initAppElements() {
    const TXTypes = this.container.getAll<IBaseTransactionType<any, any>>(TXSymbols.transaction);
    const txLogic = this.container.get<ITransactionLogic>(Symbols.logic.transaction);

    for (const txType of TXTypes) {
      txLogic.attachAssetType(txType);
    }
    const txModule = this.container.get<TransactionsModule>(TXSymbols.module);
    await txModule.hookMethods();
  }

  public async teardown() {
    const txPool = this.container.get<TransactionPool>(Symbols.logic.txpool);
    await txPool.cleanup();
    const txModule = this.container.get<TransactionsModule>(TXSymbols.module);
    await txModule.cleanup();
    await txModule.unHook();
  }

}
