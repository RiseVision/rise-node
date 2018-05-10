import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod, stubStaticMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export class BlocksModelStub extends BaseStubClass {

  @stubMethod()
  public isMultisignature() {}

  @stubMethod()
  public hexPublicKey() {}

  @stubMethod()
  public toPOJO() {}

  @stubMethod()
  public searchDelegate() {}

  @stubMethod()
  public restoreUnconfirmedEntries() {}

  @stubStaticMethod()
  public static findMeow() {
  }
}
