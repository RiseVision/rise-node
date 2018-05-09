import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class AccountsModelStub extends BaseStubClass {

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

}
