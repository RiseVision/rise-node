import { ITransactionsModule } from '@risevision/core-interfaces';
import { IBaseTransaction } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import { InnerTXQueueStub } from './InnerTXQueueStub';

@injectable()
export class TransactionPoolStub extends BaseStubClass {
  public unconfirmed: InnerTXQueueStub;
  public bundled: InnerTXQueueStub;
  public queued: InnerTXQueueStub;
  public multisignature: InnerTXQueueStub;

  constructor() {
    super();
    this.unconfirmed    = new InnerTXQueueStub();
    this.bundled        = new InnerTXQueueStub();
    this.queued         = new InnerTXQueueStub();
    this.multisignature = new InnerTXQueueStub();
  }

  @stubMethod()
  public queueTransaction(tx: IBaseTransaction<any>, bundled: boolean) {
    return;
  }

  @stubMethod()
  public fillPool(): Promise<Array<IBaseTransaction<any>>> {
    return undefined;
  }

  @stubMethod()
  public transactionInPool(txID: string) {
    return undefined;
  }

  @stubMethod()
  public getMergedTransactionList(limit: number): Array<IBaseTransaction<any>> {
    return undefined;
  }

  @stubMethod()
  public expireTransactions(): string[] {
    return undefined;
  }

  @stubMethod()
  public processBundled(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public receiveTransactions(txs: Array<IBaseTransaction<any>>,
                             broadcast: boolean, bundled: boolean): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public processNewTransaction(tx: IBaseTransaction<any>, broadcast: boolean): Promise<void> {
    return undefined;
  }

  @stubMethod()
  // tslint:disable-next-line
  public applyUnconfirmedList(txs: Array<IBaseTransaction<any> | string>, txModule: ITransactionsModule): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public undoUnconfirmedList(txModule: ITransactionsModule): Promise<string[]> {
    return undefined;
  }
}
