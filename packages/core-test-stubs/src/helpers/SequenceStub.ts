import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { spyMethod, stubMethod } from '../stubDecorator';

@injectable()
export class SequenceStub extends BaseStubClass {

  @spyMethod
  public addAndPromise(w) {
    return w();
  }

  @spyMethod
  public count() {
    return 1;
  }

  @stubMethod()
  public ____noiop() {
    return;
  }
}
