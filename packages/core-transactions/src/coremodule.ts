import { BaseCoreModule } from '@risevision/core-launchpad';
import { APISymbols } from '@risevision/core-apis';
import { ModelSymbols } from '@risevision/core-models';
import { TXSymbols } from './txSymbols';
import { Symbols } from '@risevision/core-interfaces';
import { SendTx } from 'dpos-offline';
import { TransactionsAPI } from './httpApi';
import { TransactionsModel } from './TransactionsModel';
import { TransactionsModule } from './TransactionModule';
import { TransactionLogic } from './TransactionLogic';
import { TransactionPool } from './TransactionPool';

const schema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule {
  public configSchema = schema;
  public constants    = {};

  public addElementsToContainer(): void {
    this.container.bind(TXSymbols.transaction).to(SendTx)
      .inSingletonScope()
      .whenTargetNamed(TXSymbols.sendTX);

    this.container.bind(APISymbols.api).to(TransactionsAPI)
      .inSingletonScope()
      .whenTargetNamed(TXSymbols.api);

    this.container.bind(ModelSymbols.model)
      .toConstructor(TransactionsModel)
      .whenTargetNamed(TXSymbols.model);

    this.container.bind(Symbols.modules.transactions)
      .to(TransactionsModule).inSingletonScope();
    this.container.bind(Symbols.logic.transaction)
      .to(TransactionLogic).inSingletonScope();
    this.container.bind(Symbols.logic.txpool)
      .to(TransactionPool).inSingletonScope();

  }

  public async teardown() {
    const txPool = this.container.get<TransactionPool>(Symbols.logic.txpool);
    txPool.cleanup();
  }

}
