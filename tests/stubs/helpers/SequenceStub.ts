import { injectable } from 'inversify';
import { Sequence } from '../../../src/helpers';
import { BaseStubClass } from '../BaseStubClass';
import { spyMethod, stubMethod } from '../stubDecorator';

@injectable()
export class SequenceStub extends BaseStubClass {
  private realImplementation: Sequence = new Sequence({});

  @spyMethod
  public addAndPromise(w) {
    return this.realImplementation.addAndPromise(w);
  }

  @spyMethod
  public count() {
    return this.realImplementation.count();
  }

  @stubMethod()
  public ____noiop() {
  }
}
