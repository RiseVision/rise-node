import * as crypto from 'crypto';
import * as z_schema from 'z-schema';
import { Ed, emptyCB, ILogger, Sequence } from '../helpers/';
import { IAccountLogic } from '../ioc/interfaces/logic';
import { IAccountsModule } from '../ioc/interfaces/modules';
import { AccountFilterData, MemAccountsData } from '../logic/';

// tslint:disable-next-line
type AccountLibrary = {
  ed: Ed,
  logger: ILogger,
  schema: z_schema,
  balancesSequence: Sequence,
  logic: {
    account: IAccountLogic,
  }
};

export class AccountsModule implements IAccountsModule {

  constructor(public library: AccountLibrary) {
  }

  public cleanup() {
    return Promise.resolve();
  }

  public onBind() {
  }

  public getAccount(filter: AccountFilterData, fields?: Array<(keyof MemAccountsData)>): Promise<MemAccountsData> {
    if (filter.publicKey) {
      filter.address = this.library.logic.account.generateAddressByPublicKey(filter.publicKey);
      delete filter.publicKey;
    }
    return this.library.logic.account.get(filter, fields);
  }

  public getAccounts(filter: AccountFilterData, fields: Array<(keyof MemAccountsData)>): Promise<MemAccountsData[]> {
    return this.library.logic.account.getAll(filter, fields);
  }

  /**
   * Avoid using this.
   * @deprecated
   */
  public async openAccount(secret: string): Promise<MemAccountsData> {
    const hash      = crypto.createHash('sha256').update(secret, 'utf8').digest();
    const keypair   = this.library.ed.makeKeypair(hash);
    const publicKey = keypair.publicKey.toString('hex');

    const account = await this.getAccount({ publicKey });
    if (account) {
      if (account.publicKey === null) {
        account.publicKey = publicKey;
      }
      return account;
    } else {
      return {
        address          : this.library.logic.account.generateAddressByPublicKey(publicKey),
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

  public async setAccountAndGet(data: ({ publicKey: string } | { address: string }) & { [k: string]: any }): Promise<MemAccountsData> {
    if (!data.address && !data.publicKey) {
      throw new Error('Missing address and public key');
    }
    if (!data.address) {
      data.address = this.library.logic.account.generateAddressByPublicKey(data.publicKey);
    }
    // no need to reset address!
    const { address } = data;
    delete data.address;

    await this.library.logic.account.set(address, data);
    return this.library.logic.account.get({ address });
  }

  public mergeAccountAndGetSQL(diff: any): string {
    if (!diff.address && !diff.publicKey) {
      throw new Error('Missing address and public key');
    }
    if (!diff.address) {
      diff.address = this.library.logic.account.generateAddressByPublicKey(diff.publicKey);
    }
    const { address } = diff;
    delete diff.address;
    return this.library.logic.account.merge(address, diff);
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
      diff.address = this.library.logic.account.generateAddressByPublicKey(diff.publicKey);
    }
    const { address } = diff;
    delete diff.address;

    return this.library.logic.account.merge(address, diff, emptyCB);
  }

  /**
   * @deprecated
   */
  public generateAddressByPublicKey(pk: string) {
    return this.library.logic.account.generateAddressByPublicKey(pk);
  }
}
