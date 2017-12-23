import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { Ed, emptyCB } from '../helpers/';
import { IAccountLogic } from '../ioc/interfaces/logic';
import { IAccountsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { AccountFilterData, MemAccountsData } from '../logic/';

@injectable()
export class AccountsModule implements IAccountsModule {
  @inject(Symbols.helpers.ed)
  private ed: Ed;

  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  public cleanup() {
    return Promise.resolve();
  }

  public getAccount(filter: AccountFilterData, fields?: Array<(keyof MemAccountsData)>): Promise<MemAccountsData> {
    if (filter.publicKey) {
      filter.address = this.accountLogic.generateAddressByPublicKey(filter.publicKey);
      delete filter.publicKey;
    }
    return this.accountLogic.get(filter, fields);
  }

  public getAccounts(filter: AccountFilterData, fields: Array<(keyof MemAccountsData)>): Promise<MemAccountsData[]> {
    return this.accountLogic.getAll(filter, fields);
  }

  /**
   * Avoid using this.
   * @deprecated
   */
  public async openAccount(secret: string): Promise<MemAccountsData> {
    const hash      = crypto.createHash('sha256').update(secret, 'utf8').digest();
    const keypair   = this.ed.makeKeypair(hash);
    const publicKey = keypair.publicKey.toString('hex');

    const account = await this.getAccount({publicKey});
    if (account) {
      if (account.publicKey === null) {
        account.publicKey = publicKey;
      }
      return account;
    } else {
      return {
        address          : this.accountLogic.generateAddressByPublicKey(publicKey),
        balance          : 0,
        multisignatures  : null,
        publicKey,
        secondPublicKey  : null,
        secondSignature  : 0,
        u_balance        : 0,
        u_multisignatures: null,
        u_secondSignature: 0,
      } as any;
    }
  }

  /**
   * Sets some data to specific account
   * @param {MemAccountsData} data
   * @returns {Promise<MemAccountsData>}
   */
  // tslint:disable-next-line max-line-length
  public async setAccountAndGet(data: ({ publicKey: string } | { address: string }) & { [k: string]: any }): Promise<MemAccountsData> {
    if (!data.address && !data.publicKey) {
      throw new Error('Missing address and public key');
    }
    if (!data.address) {
      data.address = this.accountLogic.generateAddressByPublicKey(data.publicKey);
    }
    // no need to reset address!
    const {address} = data;
    delete data.address;

    await this.accountLogic.set(address, data);
    return this.accountLogic.get({address});
  }

  public mergeAccountAndGetSQL(diff: any): string {
    if (!diff.address && !diff.publicKey) {
      throw new Error('Missing address and public key');
    }
    if (!diff.address) {
      diff.address = this.accountLogic.generateAddressByPublicKey(diff.publicKey);
    }
    const {address} = diff;
    delete diff.address;
    return this.accountLogic.merge(address, diff);
  }

  /**
   * merge some data on the account
   * @param {MemAccountsData} data
   * @returns {Promise<MemAccountsData>}
   */

  public async mergeAccountAndGet(diff: any): Promise<MemAccountsData> {
    if (!diff.address && !diff.publicKey) {
      throw new Error('Missing address and public key');
    }
    if (!diff.address) {
      diff.address = this.accountLogic.generateAddressByPublicKey(diff.publicKey);
    }
    const {address} = diff;
    delete diff.address;

    return this.accountLogic.merge(address, diff, emptyCB);
  }

  /**
   * @deprecated
   */
  public generateAddressByPublicKey(pk: string) {
    return this.accountLogic.generateAddressByPublicKey(pk);
  }
}
