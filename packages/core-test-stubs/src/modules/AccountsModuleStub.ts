import { AccountDiffType, AccountFilterData, IAccountsModel, IAccountsModule } from '@risevision/core-interfaces';
import { DBOp, FieldsInModel, IBaseTransaction, publicKey } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class AccountsModuleStub extends BaseStubClass implements IAccountsModule {

  @stubMethod()
  public cleanup() {
    return null;
  }

  @stubMethod()
  public resolveAccountsForTransactions(txs: Array<IBaseTransaction<any>>): Promise<{ [address: string]: IAccountsModel }> {
    return null;
  }

  @stubMethod()
  public getAccount(filter: AccountFilterData, fields?: FieldsInModel<IAccountsModel>): Promise<IAccountsModel> {
    return null;
  }

  @stubMethod()
  public getAccounts(filter: AccountFilterData, fields: FieldsInModel<IAccountsModel>): Promise<IAccountsModel[]> {
    return null;
  }

  @stubMethod()
  public setAccountAndGet(data: Partial<IAccountsModel> & ({ publicKey: Buffer } | { address: string })): Promise<IAccountsModel> {
    return null;
  }

  @stubMethod()
  public mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>> {
    return null;
  }

  @stubMethod()
  public generateAddressByPublicKey(pk: publicKey | Buffer): string {
    return null;
  }

}
