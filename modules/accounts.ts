import * as crypto from 'crypto';
import { Ed } from '../helpers/ed';
import { emptyCB } from '../helpers/promiseToCback';
import { TransactionType } from '../helpers/transactionTypes';
import { ILogger } from '../logger';
import { AccountFilterData, AccountLogic, MemAccountsData } from '../logic/account';
import { TransactionLogic } from '../logic/transaction';
import { VoteTransaction } from '../logic/transactions/vote';

// tslint:disable-next-line
type AccountLibrary = { ed: Ed, logger: ILogger, schema: any, balancesSequence: any, logic: { account: AccountLogic, transaction: TransactionLogic } }

export class AccountsModule {
  public modules: {delegates: any, rounds: any, system: any, transactions: any};
  private voteAsset: VoteTransaction;

  constructor(public library: AccountLibrary) {
    this.voteAsset = this.library.logic.transaction.attachAssetType(
      TransactionType.VOTE,
      new VoteTransaction({
        account: this.library.logic.account,
        logger : this.library.logger,
        schema : this.library.schema,
      })
    );
  }

  public onBind(modules: {delegates: any, rounds: any, system: any, transactions: any}) {
    this.modules = modules;
    this.voteAsset.bind(modules.delegates, modules.rounds, modules.system);
  }

  public getAccount(filter: AccountFilterData, fields?: Array<(keyof MemAccountsData)>): Promise<MemAccountsData> {
    if (filter.publicKey) {
      filter.address = this.library.logic.account.generateAddreddByPublicKey(filter.publicKey);
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

    const account = await this.getAccount({publicKey});
    if (account) {
      if (account.publicKey === null) {
        account.publicKey = publicKey;
      }
      return account;
    } else {
      return {
        address          : this.library.logic.account.generateAddreddByPublicKey(publicKey),
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
  public async setAccountAndGet(data: MemAccountsData): Promise<MemAccountsData> {
    if (!data.address && !data.publicKey) {
      throw new Error('Missing address and public key');
    }
    if (!data.address) {
      data.address = this.library.logic.account.generateAddreddByPublicKey(data.publicKey);
    }
    // no need to reset address!
    const {address} = data;
    delete data.address;

    await this.library.logic.account.set(address, data);
    return this.library.logic.account.get({address});
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
      diff.address = this.library.logic.account.generateAddreddByPublicKey(diff.publicKey);
    }
    const {address} = diff;
    delete diff.address;

    return this.library.logic.account.merge(address, diff, emptyCB);
  }
}
