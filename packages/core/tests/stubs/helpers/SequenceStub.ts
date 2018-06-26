
import { injectable } from 'inversify';
import { Sequence } from '../../../src/helpers';
import { BaseStubClass } from '../BaseStubClass';
import { spyMethod, stubMethod } from '../stubDecorator';

@injectable()
export class SequenceStub extends BaseStubClass {
  public realImplementation: Sequence = new Sequence(Symbol.for(`${Math.random()}`), {});

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
    return;
  }
}
