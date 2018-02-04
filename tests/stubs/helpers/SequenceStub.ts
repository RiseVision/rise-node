import { injectable } from 'inversify';
import { Sequence } from '../../../src/helpers';
import { BaseStubClass } from '../BaseStubClass';
import { spyMethod } from '../stubDecorator';

@injectable()
export class SequenceStub extends BaseStubClass {
  private realImplementation: Sequence = new Sequence({});

  @spyMethod
  public addAndPromise() {
  }

  @spyMethod
  public count() {

  }

}
