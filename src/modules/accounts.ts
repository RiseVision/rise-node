import { inject, injectable } from 'inversify';
import { DBHelper } from '../helpers';
import { AccountDiffType, IAccountLogic } from '../ioc/interfaces/logic';
import { IAccountsModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { AccountFilterData, MemAccountsData } from '../logic/';
import { IBaseTransaction } from '../logic/transactions';
import { AccountsModel } from '../models/';
import { DBOp } from '../types/genericTypes';
import { FieldsInModel } from '../types/utils';

@injectable()
export class AccountsModule implements IAccountsModule {

  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;
  @inject(Symbols.helpers.db)
  private dbHelper: DBHelper;

  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;

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

  public async resolveAccountsForTransactions(txs: Array<IBaseTransaction<any>>): Promise<{ [address: string]: AccountsModel }> {
    const allSenders: Array<{ publicKey: Buffer, address: string }> = [];
    txs.forEach((tx) => {
      if (!allSenders.find((item) => item.address === tx.senderId)) {
        allSenders.push({ address: tx.senderId, publicKey: tx.senderPublicKey });
      }
      if (tx.requesterPublicKey) {
        const requesterAddress = this.accountLogic.generateAddressByPublicKey(tx.requesterPublicKey);
        if (!allSenders.find((item) => item.address === requesterAddress)) {
          allSenders.push({ address: requesterAddress, publicKey: tx.requesterPublicKey });
        }
      }
    });

    const senderAccounts = await this.AccountsModel.scope('full')
        .findAll({where: {address: allSenders.map((s) => s.address)}});

    const sendersMap: { [address: string]: AccountsModel } = {};
    for (const senderAccount of senderAccounts) {
      sendersMap[senderAccount.address] = senderAccount;
    }

    await Promise.all(allSenders.map(async ({ address, publicKey }) => {
      if (!sendersMap[address]) {
        throw new Error(`Account ${address} not found in db.`);
      }
      if (!sendersMap[address].publicKey) {
        sendersMap[address] = await this.setAccountAndGet({ publicKey });
      }
      // sanity checks. A transaction could be broadcasted
      if (sendersMap[address].address !== address) {
        throw new Error(`Stealing attempt type.1 for ${address}`);
      }
      if (!sendersMap[address].publicKey.equals(publicKey)) {
        throw new Error(`Stealing attempt type.2 for ${address}`);
      }
    }));

    return sendersMap;
  }

  /**
   * Sets some data to specific account
   * @param {MemAccountsData} data
   * @returns {Promise<MemAccountsData>}
   */
  // tslint:disable-next-line max-line-length
  public async setAccountAndGet(data: ({ publicKey: Buffer } | { address: string }) & Partial<AccountsModel>): Promise<AccountsModel> {
    data              = this.fixAndCheckInputParams(data);
    // no need to reset address!
    const { address } = data;
    delete data.address;

    await this.accountLogic.set(address, data);
    return this.accountLogic.get({ address });
  }

  public mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>> {
    diff              = this.fixAndCheckInputParams(diff);
    const { address } = diff;
    delete diff.address;
    return this.accountLogic.merge(address, diff);
  }

  /**
   * @deprecated
   */
  public generateAddressByPublicKey(pk: string | Buffer) {
    return this.accountLogic.generateAddressByPublicKey(pk);
  }

  private fixAndCheckInputParams<T extends { address?: string, publicKey?: Buffer } = any>(what: T): T & {address: string} {
    if (!what.address && !what.publicKey) {
      throw new Error('Missing address and public key');
    }
    // We calculate address in the case it was not provided or
    // in case publicKey was provided (even if address was provided for security reasons)
    if (what.publicKey || !what.address) {
      what.address = this.accountLogic.generateAddressByPublicKey(what.publicKey);
    }
    return what as any;
  }
}
