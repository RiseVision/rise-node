import { injectable } from 'inversify';
import { cback } from '../../../src/helpers';
import { IAccountLogic } from '../../../src/ioc/interfaces/logic';
import { AccountFilterData, MemAccountsData } from '../../../src/logic';
import { publicKey } from '../../../src/types/sanityTypes';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';
import { AccountsModel } from '../../../src/models/AccountsModel';
import { FieldsInModel } from '../../../src/types/utils';

// tslint:disable no-empty

@injectable()
export default class AccountLogicStub extends BaseStubClass implements IAccountLogic {

  @stubMethod()
  public merge(address: string, diff: any, cb?: cback<any>): any {

  }

  @stubMethod()
  public objectNormalize(account: any) {
  }

  @stubMethod()
  public createTables(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public removeTables(): Promise<void> {
    return undefined;
  }

  @stubMethod()
  public assertPublicKey(pk: publicKey, allowUndefined?: boolean) {
  }

  @stubMethod()
  public toDB(raw: any): any {
    return undefined;
  }

  @stubMethod()
  public get(filter: AccountFilterData, fields?: FieldsInModel<AccountsModel>): Promise<AccountsModel> {
    return undefined;
  }

  @stubMethod()
  public getAll(filter: AccountFilterData, fields?: Array<keyof AccountsModel>): Promise<any[]> {
    return undefined;
  }

  @stubMethod()
  public set(address: string, fields: { [p: string]: any }) {
  }

  @stubMethod()
  public remove(address: string): Promise<number> {
    return undefined;
  }

  @stubMethod()
  public generateAddressByPublicKey(pk: publicKey): string {
    return undefined;
  }

  @stubMethod()
  assertValidAddress(address: string): void {
  }

}
