import {
  AccountDiffType,
  AccountFilterData,
  IAccountsModel,
  IAccountsModule
} from '@risevision/core-interfaces';
import { DBHelper, ModelSymbols } from '@risevision/core-models';
import { DBOp, IBaseTransaction } from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import { AccountLogic } from '../logic';
import { AccountsSymbols } from '../symbols';

@injectable()
export class AccountsModule implements IAccountsModule {
  // TODO: migrate to IAccountLogic
  @inject(AccountsSymbols.logic)
  private accountLogic: AccountLogic;

  @inject(ModelSymbols.helpers.db)
  private dbHelper: DBHelper;

  @inject(ModelSymbols.model)
  @named(AccountsSymbols.model)
  private AccountsModel: typeof IAccountsModel;

  public getAccount(filter: AccountFilterData): Promise<IAccountsModel> {
    if (filter.publicKey) {
      filter.address = this.accountLogic.generateAddressByPublicKey(
        filter.publicKey
      );
      delete filter.publicKey;
    }
    return this.accountLogic.get(filter);
  }

  public getAccounts(filter: AccountFilterData): Promise<IAccountsModel[]> {
    return this.accountLogic.getAll(filter);
  }

  public unfoldSenders(
    txs: Array<IBaseTransaction<any>>
  ): Array<{ publicKey: Buffer; address: string }> {
    const allSenders: Array<{ publicKey: Buffer; address: string }> = [];
    txs.forEach((tx) => {
      if (!allSenders.find((item) => item.address === tx.senderId)) {
        allSenders.push({
          address: tx.senderId,
          publicKey: tx.senderPublicKey
        });
      }
      if (tx.requesterPublicKey) {
        const requesterAddress = this.accountLogic.generateAddressByPublicKey(
          tx.requesterPublicKey
        );
        if (!allSenders.find((item) => item.address === requesterAddress)) {
          allSenders.push({
            address: requesterAddress,
            publicKey: tx.requesterPublicKey
          });
        }
      }
    });
    return allSenders;
  }

  public async txAccounts(
    txs: Array<IBaseTransaction<any>>
  ): Promise<{ [address: string]: IAccountsModel }> {
    if (txs.length === 0) {
      return {};
    }
    const allSenders = this.unfoldSenders(txs);

    const senderAccounts = await this.AccountsModel.findAll({
      where: { address: allSenders.map((s) => s.address) }
    });

    const sendersMap: { [address: string]: IAccountsModel } = {};
    for (const senderAccount of senderAccounts) {
      sendersMap[senderAccount.address] = senderAccount;
    }

    return sendersMap;
  }

  public async checkTXsAccountsMap(
    txs: Array<IBaseTransaction<any>>,
    accMap: { [add: string]: IAccountsModel }
  ) {
    const allSenders = this.unfoldSenders(txs);

    await Promise.all(
      allSenders.map(async ({ address, publicKey }) => {
        if (!accMap[address]) {
          throw new Error(`Account ${address} not found in db.`);
        }
        if (!accMap[address].publicKey) {
          accMap[address] = await this.assignPublicKeyToAccount({ publicKey });
        }
        // sanity checks. A transaction could be broadcasted
        if (accMap[address].address !== address) {
          throw new Error(`Stealing attempt type.1 for ${address}`);
        }
        if (!accMap[address].publicKey.equals(publicKey)) {
          throw new Error(`Stealing attempt type.2 for ${address}`);
        }
      })
    );
  }

  /**
   * Sets some data to specific account
   */
  // tslint:disable-next-line max-line-length
  public async assignPublicKeyToAccount(opts: {
    address?: string;
    publicKey: Buffer;
  }): Promise<IAccountsModel> {
    const { address, publicKey } = opts;
    if (!publicKey) {
      throw new Error(`Missing publicKey for ${address}`);
    }
    const data = this.fixAndCheckInputParams({ address, publicKey });
    if (data.address !== address && address) {
      throw new Error(
        `Attempting to assign publicKey to non correct address ${
          data.address
        } != ${address}`
      );
    }
    await this.accountLogic.set(data.address, { publicKey: data.publicKey });
    return this.accountLogic.get({ address: data.address });
  }

  public mergeAccountAndGetOPs(diff: AccountDiffType): Array<DBOp<any>> {
    diff = this.fixAndCheckInputParams(diff);
    const { address } = diff;
    delete diff.address;
    return this.accountLogic.merge(address, diff);
  }

  public generateAddressByPublicKey(pk: Buffer) {
    return this.accountLogic.generateAddressByPublicKey(pk);
  }

  private fixAndCheckInputParams<
    T extends { address?: string; publicKey?: Buffer } = any
  >(what: T): T & { address: string } {
    if (!what.address && !what.publicKey) {
      throw new Error('Missing address and public key');
    }
    // We calculate address in the case it was not provided or
    // in case publicKey was provided (even if address was provided for security reasons)
    if (what.publicKey || !what.address) {
      what.address = this.accountLogic.generateAddressByPublicKey(
        what.publicKey
      );
    }
    return what as any;
  }
}
