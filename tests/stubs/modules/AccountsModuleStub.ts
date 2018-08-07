import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import { IAccountsModule } from '../../../src/ioc/interfaces/modules';
import { FieldsInModel } from '../../../src/types/utils';
import { publicKey } from '../../../src/types/sanityTypes';
import { AccountFilterData } from '../../../src/logic';
import { AccountsModel } from '../../../src/models';
import { AccountDiffType } from '../../../src/ioc/interfaces/logic';
import { DBOp } from '../../../src/types/genericTypes';
import { IBaseTransaction } from '../../../src/logic/transactions';

// tslint:disable no-empty

@injectable()
export default class AccountsModuleStub extends BaseStubClass implements IAccountsModule {

  @stubMethod()
  public cleanup() {
    return null;
  }

  @stubMethod()
  public resolveAccountsForTransactions(txs: Array<IBaseTransaction<any>>): Promise<{ [address: string]: AccountsModel }>{
    return null;
  }

  @stubMethod()
  public getAccount(filter: AccountFilterData, fields?: FieldsInModel<AccountsModel>): Promise<AccountsModel>{
    return null;
  }

  @stubMethod()
  public getAccounts(filter: AccountFilterData, fields: FieldsInModel<AccountsModel>): Promise<AccountsModel[]>{
    return null;
  }

  @stubMethod()
  public setAccountAndGet(data: Partial<AccountsModel>  & ({ publicKey: Buffer } | { address: string })): Promise<AccountsModel>{
    return null;
  }

  @stubMethod()
  public mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>>{
    return null;
  }

  @stubMethod()
  public generateAddressByPublicKey(pk: publicKey|Buffer): string{
    return null;
  }

}
