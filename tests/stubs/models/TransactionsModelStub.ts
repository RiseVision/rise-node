import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod, stubStaticMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export class TransactionsModelStub extends BaseStubClass {
  @stubStaticMethod()
  public static toTransportTransaction() {

  }
}
