import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class AccountsModuleStub extends BaseStubClass {

  @stubMethod()
  public getAccount() {}

  @stubMethod()
  public getAccounts() {}

  @stubMethod()
  public setAccountAndGet() {}

  @stubMethod()
  public mergeAccountAndGetSQL() {}

  @stubMethod()
  public mergeAccountAndGet() {}

  @stubMethod()
  public generateAddressByPublicKey() {}
}
