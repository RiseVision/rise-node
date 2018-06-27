import { IBaseTransaction } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

@injectable()
export class InnerTXQueueStub<T = { receivedAt: Date }> extends BaseStubClass {
  public count = 0;

  @stubMethod()
  public has(id: string) {
    return undefined;
  }

  @stubMethod(true)
  public remove(id: string) {
    return;
  }

  @stubMethod(true)
  public getPayload() {
    return {};
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
