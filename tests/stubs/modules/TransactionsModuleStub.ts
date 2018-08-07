import { injectable } from 'inversify';
import { ITransactionsModule } from '../../../src/ioc/interfaces/modules';
import { SignedBlockType } from '../../../src/logic';
import { IBaseTransaction, IConfirmedTransaction } from '../../../src/logic/transactions';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import { AccountsModel, TransactionsModel } from '../../../src/models/';

@injectable()
export class TransactionsModuleStub extends BaseStubClass implements ITransactionsModule {

  @stubMethod()
  public cleanup() {
    return undefined;
  }

  @stubMethod()
  public transactionInPool(id: string): boolean {
    return undefined;
  }

  @stubMethod()
  public filterConfirmedIds(ids: string[]): Promise<string[]> {
    return null;
  }

  @stubMethod()
  public transactionUnconfirmed(id: string): boolean {
    return undefined;
  }

  @stubMethod()
  public getUnconfirmedTransaction<T = any>(id: string): IBaseTransaction<T> {
    return undefined;
  }

  @stubMethod()
  public getQueuedTransaction<T = any>(id: string): IBaseTransaction<T> {
    return undefined;
  }

  @stubMethod()
  public getMultisignatureTransaction<T = any>(id: string): IBaseTransaction<T> {
    return undefined;
  }

  @stubMethod()
  public getUnconfirmedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return undefined;
  }

  @stubMethod()
  public getQueuedTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return undefined;
  }

  @stubMethod()
  public getMultisignatureTransactionList(reverse: boolean, limit?: number): Array<IBaseTransaction<any>> {
    return undefined;
  }

  @stubMethod()
  public getMergedTransactionList(limit?: number): Array<IBaseTransaction<any>> {
    return undefined;
  }

  @stubMethod()
  public removeUnconfirmedTransaction(id: string): boolean {
    return undefined;
  }

  @stubMethod()
  public processUnconfirmedTransaction(transaction: IBaseTransaction<any>, broadcast: boolean): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public undoUnconfirmedList(): Promise<string[]> {
    return undefined;
  }

  @stubMethod()
  public applyUnconfirmed(transaction: IBaseTransaction<any> & { blockId?: string }, sender: any): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public undoUnconfirmed(transaction): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public count(): Promise<{ confirmed: number, multisignature: number, queued: number, unconfirmed: number }> {
    return undefined;
  }

  @stubMethod()
  public fillPool(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public isLoaded(): boolean {
    return undefined;
  }

  @stubMethod()
  public list(filter): Promise<{ count: number, transactions: Array<IConfirmedTransaction<any>> }> {
    return undefined;
  }

  @stubMethod()
  public getByID<T = any>(id: string): Promise<TransactionsModel> {
    return undefined;
  }

  @stubMethod()
  public checkTransaction(tx: IBaseTransaction<any>, accountsMap: { [p: string]: AccountsModel }, height: number): Promise<void> {
    return undefined;
  }


}
