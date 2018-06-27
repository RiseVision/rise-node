import { AccountFilterData, IAccountLogic, IAccountsModel } from '@risevision/core-interfaces';
import { FieldsInModel, publicKey } from '@risevision/core-types';
import { injectable } from 'inversify';
import { BaseStubClass } from '../BaseStubClass';
import { stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class AccountLogicStub extends BaseStubClass implements IAccountLogic {

  @stubMethod()
  public merge(address: string, diff: any, cb?: any): any {

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
  public get(filter: AccountFilterData, fields?: FieldsInModel<IAccountsModel>): Promise<IAccountsModel> {
    return undefined;
  }

  @stubMethod()
  public getAll(filter: AccountFilterData, fields?: Array<keyof IAccountsModel>): Promise<any[]> {
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

}
