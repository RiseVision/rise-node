import { injectable } from 'inversify';
import { IBaseTransaction } from '../../../src/logic/transactions';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class InnerTXQueueStub<T = { receivedAt: Date }> extends BaseStubClass {
  @stubMethod()
  public has(id: string) {
    return undefined;
  }

  @stubMethod()
  public get count() {
    return undefined;
  }

  @stubMethod(true)
  public remove(id: string) {
    return;
  }

  @stubMethod(true)
  public add(tx: IBaseTransaction<any>, payload?: { receivedAt: Date }) {
    return;
  }

  @stubMethod()
  public get(txID: string): IBaseTransaction<any> {
    return undefined;
  }

  @stubMethod(true)
  public reindex() {
    return;
  }

  @stubMethod()
  public list(reverse: boolean, limit?: number,
              filterFn?: (tx: IBaseTransaction<any>) => boolean): Array<IBaseTransaction<any>> {
    return undefined;
  }

  @stubMethod()
  // tslint:disable-next-line
  public listWithPayload(reverse: boolean, limit?: number, filterFn?: (tx: IBaseTransaction<any>) => boolean): Array<{ tx: IBaseTransaction<any>, payload: { receivedAt: Date } }> {
    return [];
  }
}
