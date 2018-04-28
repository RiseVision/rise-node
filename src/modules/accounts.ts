import { inject, injectable } from 'inversify';
import { AccountDiffType, IAccountLogic } from '../ioc/interfaces/logic';
import { IAccountsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { AccountFilterData, MemAccountsData } from '../logic/';
import { AccountsModel } from '../models/';
import { FieldsInModel } from '../types/utils';
import { DBHelper } from '../helpers';
import { DBOp } from '../types/genericTypes';

@injectable()
export class AccountsModule implements IAccountsModule {

  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;
  @inject(Symbols.helpers.db)
  private dbHelper: DBHelper;

  public cleanup() {
    return Promise.resolve();
  }

  public getAccount(filter: AccountFilterData, fields?: FieldsInModel<AccountsModel>): Promise<AccountsModel> {
    if (filter.publicKey) {
      filter.address = this.accountLogic.generateAddressByPublicKey(filter.publicKey);
      delete filter.publicKey;
    }
    return this.accountLogic.get(filter, fields);
  }

  public getAccounts(filter: AccountFilterData, fields: FieldsInModel<AccountsModel>): Promise<AccountsModel[]> {
    return this.accountLogic.getAll(filter, fields);
  }

  /**
   * Sets some data to specific account
   * @param {MemAccountsData} data
   * @returns {Promise<MemAccountsData>}
   */
  // tslint:disable-next-line max-line-length
  public async setAccountAndGet(data: ({ publicKey: string } | { address: string }) & Partial<AccountsModel>): Promise<AccountsModel> {
    data              = this.fixAndCheckInputParams(data);
    // no need to reset address!
    const { address } = data;
    delete data.address;

    await this.accountLogic.set(address, data);
    return this.accountLogic.get({ address });
  }

  public mergeAccountAndGetOPS(diff: any): Array<DBOp<any>> {
    diff              = this.fixAndCheckInputParams(diff);
    const { address } = diff;
    delete diff.address;
    return this.accountLogic.merge(address, diff);
  }

  /**
   * merge some data on the account
   * @param {MemAccountsData} diff
   * @returns {Promise<MemAccountsData>}
   */

  public async mergeAccountAndGet(diff: AccountDiffType): Promise<AccountsModel> {
    diff = this.fixAndCheckInputParams(diff);

    const { address } = diff;
    delete diff.address;
    const ops = this.accountLogic.merge(address, diff);
    await this.dbHelper.performOps(ops);
    return this.getAccount({ address });
  }

  /**
   * @deprecated
   */
  public generateAddressByPublicKey(pk: string | Buffer) {
    return this.accountLogic.generateAddressByPublicKey(pk);
  }

  private fixAndCheckInputParams<T extends { address?: string, publicKey?: Buffer } = any>(what: T): T {
    if (!what.address && !what.publicKey) {
      throw new Error('Missing address and public key');
    }
    if (!what.address) {
      what.address = this.accountLogic.generateAddressByPublicKey(what.publicKey);
    }
    return what;
  }
}
